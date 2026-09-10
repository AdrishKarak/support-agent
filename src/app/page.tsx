'use client';

import React, { useState } from 'react';

interface RetrievedThread {
  threadId: string;
  initialMessage: string;
  resolutionReply: string;
  similarity: number;
}

interface PipelineResponse {
  customerMessage: string;
  intent: string;
  confidence: number;
  reasoning: string;
  retrievedThreads: RetrievedThread[];
  reply: string;
  groundednessConfidence: number;
  escalate: boolean;
  escalationReason: string;
  priority: string;
  targetTeam: string;
  latencyMs: number;
  _cached?: boolean;
}

const PRESETS = [
  {
    icon: '🎧',
    label: 'Playback Issue',
    text: '@SpotifyCares my shuffle and repeat buttons are frozen on iOS after the latest app update. Help!',
  },
  {
    icon: '🔐',
    label: 'Account Hacked',
    text: '@SpotifyCares someone hacked into my account and changed my email address to an unauthorized domain!',
  },
  {
    icon: '💳',
    label: 'Double Charge',
    text: '@SpotifyCares I got charged twice for my Premium Family plan this month. Please issue a refund.',
  },
  {
    icon: '⚖️',
    label: 'Legal Threat',
    text: '@SpotifyCares you refuse to process my cancellation. My attorney is filing an official FTC complaint today.',
  },
  {
    icon: '📱',
    label: 'Offline Syncing',
    text: '@SpotifyCares my downloaded tracks keep disappearing when I switch to offline mode on Android.',
  },
  {
    icon: '📁',
    label: 'Feature Request',
    text: '@SpotifyCares is there any plan to support folder organization for custom playlists in the mobile app?',
  },
];

const INTENT_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  playback_issue: { label: 'Playback Issue', bg: '#1e3a8a', text: '#93c5fd' },
  offline_download: { label: 'Offline & Download', bg: '#312e81', text: '#c7d2fe' },
  account_access: { label: 'Account Access', bg: '#581c87', text: '#e9d5ff' },
  subscription_billing: { label: 'Billing & Subscriptions', bg: '#701a75', text: '#f5d0fe' },
  audio_quality: { label: 'Audio Quality & Devices', bg: '#064e3b', text: '#a7f3d0' },
  playlist_library: { label: 'Playlists & Library', bg: '#065f46', text: '#6ee7b7' },
  app_bug_crash: { label: 'App Bug & Crashes', bg: '#7f1d1d', text: '#fca5a5' },
  feature_inquiry: { label: 'Feature Inquiries', bg: '#78350f', text: '#fde68a' },
  human_escalation_required: { label: 'Human Escalation', bg: '#991b1b', text: '#f87171' },
};

export default function Home() {
  const [message, setMessage] = useState(PRESETS[0].text);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);

  async function handleRun() {
    if (!message.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Pipeline request execution failed');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCopyReply() {
    if (!result?.reply) return;
    navigator.clipboard.writeText(result.reply);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ padding: '2rem 1rem', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header Bar */}
      <header className="glass-panel" style={{ padding: '1.5rem 2rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              backgroundColor: '#1DB954',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '1.4rem',
              color: '#000',
              boxShadow: '0 0 20px rgba(29, 185, 84, 0.4)',
            }}>
              approx
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: '#FFF' }}>
                  Spotify AI Support Agent
                </h1>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  backgroundColor: 'rgba(29, 185, 84, 0.15)',
                  border: '1px solid rgba(29, 185, 84, 0.3)',
                  color: '#1DB954',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}>
                  <span className="pulsing-dot" /> Live Pipeline
                </span>
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
                Production RAG Support System &bull; 9-Intent Taxonomy &bull; Deterministic Multi-Tier Safety Rules
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid var(--border-color)',
                color: '#FFF',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {showExplanation ? 'Hide Architecture ✖' : 'How It Works 💡'}
            </button>
            <a
              href="https://github.com/AdrishKarak/support-agent"
              target="_blank"
              rel="noreferrer"
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38BDF8',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              GitHub ↗
            </a>
          </div>
        </div>

        {/* Architecture Explainer Accordion */}
        {showExplanation && (
          <div className="animate-fade-in" style={{
            marginTop: '1.5rem',
            paddingTop: '1.5rem',
            borderTop: '1px solid var(--border-color)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '1rem',
          }}>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: '#38BDF8', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                1A. Intent Classification
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', lineHeight: '1.4' }}>
                High-speed Groq LLM (<code>openai/gpt-oss-20b</code>) classifies customer queries into 9 empirical intents with confidence scores and reasoning.
              </p>
            </div>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: '#1DB954', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                1B. Dense Vector Search (RAG)
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', lineHeight: '1.4' }}>
                Query embedded via Gemini 768-dim model & searched against Neon PostgreSQL <code>pgvector</code> HNSW index to fetch top resolved support threads.
              </p>
            </div>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: '#A855F7', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                2. Grounded Reply Synthesis
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', lineHeight: '1.4' }}>
                Merges classified intent and retrieved historical Spotify resolution steps to draft an accurate, empathetic public Twitter reply.
              </p>
            </div>
            <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem' }}>
                3. Multi-Tier Escalation Safety
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.825rem', lineHeight: '1.4' }}>
                Evaluates fast regex heuristics (legal/security/human demands), confidence thresholds (&lt;0.65), and RAG similarity (&lt;0.50) before sending.
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Interactive Pipeline Stepper Header */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>
          PIPELINE EXECUTION FLOW
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', position: 'relative' }}>
          {[
            { step: 'Stage 1A', name: 'Intent Classifier', detail: 'Groq LLM / Gemini Fallback', activeColor: '#38BDF8' },
            { step: 'Stage 1B', name: 'Dense Retrieval', detail: 'pgvector Cosine Search', activeColor: '#1DB954' },
            { step: 'Stage 2', name: 'Grounded Reply', detail: 'Contextual RAG Synthesis', activeColor: '#A855F7' },
            { step: 'Stage 3', name: 'Safety Guardrails', detail: 'Multi-Tier Escalation Heuristics', activeColor: '#F59E0B' },
          ].map((s, idx) => {
            const isDone = !!result;
            const isRunning = loading;
            return (
              <div key={idx} style={{
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                border: `1px solid ${isDone ? s.activeColor : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '10px',
                padding: '0.75rem 1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                transition: 'all 0.3s ease',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: s.activeColor }}>{s.step}</span>
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.4rem',
                    borderRadius: '4px',
                    backgroundColor: isDone ? `${s.activeColor}22` : isRunning ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.05)',
                    color: isDone ? s.activeColor : isRunning ? '#F59E0B' : 'var(--text-dim)',
                  }}>
                    {isDone ? 'COMPLETED' : isRunning ? 'PROCESSING...' : 'READY'}
                  </span>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: '#FFF' }}>{s.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{s.detail}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Preset Quick Test Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '1px' }}>
            SELECT PRESET TEST SCENARIO
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click any scenario to auto-populate</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {PRESETS.map((p, idx) => {
            const isSelected = message === p.text;
            return (
              <button
                key={idx}
                onClick={() => setMessage(p.text)}
                style={{
                  backgroundColor: isSelected ? 'rgba(29, 185, 84, 0.15)' : 'rgba(22, 27, 34, 0.8)',
                  color: isSelected ? '#1DB954' : 'var(--text-main)',
                  border: `1px solid ${isSelected ? '#1DB954' : 'var(--border-color)'}`,
                  borderRadius: '20px',
                  padding: '0.4rem 0.9rem',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  transition: 'all 0.2s ease',
                  boxShadow: isSelected ? '0 0 12px rgba(29, 185, 84, 0.25)' : 'none',
                }}
              >
                <span>{p.icon}</span>
                <span>{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Input Section */}
      <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFF' }}>
            Incoming Customer Tweet (@SpotifyCares):
          </label>
          <span style={{
            fontSize: '0.75rem',
            color: message.length > 280 ? '#EF4444' : 'var(--text-muted)',
            fontFamily: 'var(--font-mono)'
          }}>
            {message.length} / 280 chars
          </span>
        </div>

        <textarea
          rows={3}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type an incoming customer support inquiry..."
          style={{
            width: '100%',
            backgroundColor: 'rgba(9, 13, 20, 0.9)',
            color: '#FFF',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '1rem',
            fontSize: '0.95rem',
            fontFamily: 'var(--font-sans)',
            lineHeight: '1.5',
            resize: 'vertical',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--spotify-green)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border-color)')}
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <span>⚡ Automated Sanitization (PII Scrubbing Enabled)</span>
          </div>

          <button
            onClick={handleRun}
            disabled={loading || !message.trim()}
            style={{
              backgroundColor: loading ? '#15803d' : '#1DB954',
              color: '#000',
              border: 'none',
              borderRadius: '10px',
              padding: '0.75rem 2rem',
              fontSize: '0.95rem',
              fontWeight: 800,
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.5px',
              cursor: loading ? 'wait' : 'pointer',
              boxShadow: loading ? 'none' : '0 4px 20px rgba(29, 185, 84, 0.4)',
              transition: 'all 0.2s ease',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            {loading ? (
              <>
                <span className="pulsing-dot" style={{ backgroundColor: '#FFF' }} />
                <span>Running Pipeline...</span>
              </>
            ) : (
              <>
                <span>Run AI Pipeline</span>
                <span>🚀</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Card */}
      {error && (
        <div className="animate-fade-in" style={{
          backgroundColor: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '12px',
          padding: '1.25rem',
          marginBottom: '2rem',
          color: '#FCA5A5',
        }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span>⚠️</span> Pipeline Processing Error
          </div>
          <div style={{ fontSize: '0.875rem' }}>{error}</div>
        </div>
      )}

      {/* Loading Skeleton View */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem' }}>
          <div className="glass-panel skeleton-shimmer" style={{ height: '90px' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="glass-panel skeleton-shimmer" style={{ height: '140px' }} />
            <div className="glass-panel skeleton-shimmer" style={{ height: '140px' }} />
          </div>
          <div className="glass-panel skeleton-shimmer" style={{ height: '160px' }} />
        </div>
      )}

      {/* Results Section */}
      {result && !loading && (
        <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Triage Status Banner */}
          <div style={{
            backgroundColor: result.escalate ? 'rgba(239, 68, 68, 0.12)' : 'rgba(29, 185, 84, 0.12)',
            border: `1.5px solid ${result.escalate ? '#EF4444' : '#1DB954'}`,
            borderRadius: '16px',
            padding: '1.5rem',
            boxShadow: result.escalate ? '0 0 25px rgba(239, 68, 68, 0.15)' : '0 0 25px rgba(29, 185, 84, 0.15)',
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{
                  fontSize: '1.25rem',
                  fontWeight: 900,
                  fontFamily: 'var(--font-heading)',
                  color: result.escalate ? '#F87171' : '#4ADE80',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  {result.escalate ? '🚨 ESCALATION REQUIRED' : '✅ AUTO-HANDLED VIA RAG'}
                </span>
                {result._cached && (
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    backgroundColor: 'rgba(56, 189, 248, 0.2)',
                    color: '#38BDF8',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    padding: '0.2rem 0.6rem',
                    borderRadius: '999px',
                  }}>
                    ⚡ Cached Response (&lt;1ms)
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '0.25rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: result.priority === 'urgent' ? '#7f1d1d' : result.priority === 'high' ? '#7c2d12' : '#14532d',
                  color: result.priority === 'urgent' ? '#fca5a5' : result.priority === 'high' ? '#fdba74' : '#86efac',
                  textTransform: 'uppercase',
                }}>
                  {result.priority} PRIORITY
                </span>

                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.25rem 0.75rem',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: '#E5E7EB',
                }}>
                  Team: <strong>{result.targetTeam}</strong>
                </span>

                <span style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  marginLeft: '0.4rem'
                }}>
                  ⏱️ {result.latencyMs}ms
                </span>
              </div>
            </div>

            <div style={{ fontSize: '0.95rem', color: '#F3F4F6', lineHeight: '1.5' }}>
              <strong>Triage Decision Rationale:</strong> {result.escalationReason}
            </div>
          </div>

          {/* Metrics & Confidence Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
            {/* Intent Classification Card */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  STAGE 1A: INTENT TAXONOMY
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '0.15rem 0.6rem',
                  borderRadius: '999px',
                  backgroundColor: INTENT_BADGES[result.intent]?.bg || '#1f2937',
                  color: INTENT_BADGES[result.intent]?.text || '#d1d5db',
                }}>
                  {INTENT_BADGES[result.intent]?.label || result.intent}
                </span>
              </div>

              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                {result.intent}
              </div>

              {/* Confidence Progress Meter */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  <span>Classifier Confidence</span>
                  <span style={{ fontWeight: 700, color: '#FFF' }}>{(result.confidence * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, result.confidence * 100))}%`,
                    backgroundColor: result.confidence >= 0.75 ? '#38BDF8' : result.confidence >= 0.65 ? '#F59E0B' : '#EF4444',
                    borderRadius: '3px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.4', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                &ldquo;{result.reasoning}&rdquo;
              </p>
            </div>

            {/* Dense RAG Similarity Card */}
            <div className="glass-panel" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  STAGE 1B: DENSE RAG SEARCH
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1DB954' }}>
                  Neon pgvector Index
                </span>
              </div>

              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1DB954', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                {result.retrievedThreads[0] ? `${(result.retrievedThreads[0].similarity * 100).toFixed(1)}% Max Similarity` : 'No Match Found'}
              </div>

              {/* RAG Similarity Progress Meter */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  <span>Top-1 Similarity Score</span>
                  <span style={{ fontWeight: 700, color: '#FFF' }}>
                    {result.retrievedThreads[0] ? `${(result.retrievedThreads[0].similarity * 100).toFixed(1)}%` : '0%'}
                  </span>
                </div>
                <div style={{ height: '6px', width: '100%', backgroundColor: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${result.retrievedThreads[0] ? Math.min(100, Math.max(0, result.retrievedThreads[0].similarity * 100)) : 0}%`,
                    backgroundColor: result.retrievedThreads[0]?.similarity >= 0.7 ? '#1DB954' : result.retrievedThreads[0]?.similarity >= 0.5 ? '#F59E0B' : '#EF4444',
                    borderRadius: '3px',
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.825rem', color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.2)', padding: '0.6rem', borderRadius: '6px' }}>
                <span>Retrieved Context Items: <strong>{result.retrievedThreads.length} threads</strong></span>
                <span>Groundedness: <strong>{(result.groundednessConfidence * 100).toFixed(0)}%</strong></span>
              </div>
            </div>
          </div>

          {/* Generated Grounded Public Reply */}
          <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(29, 185, 84, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#1DB954',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: '0.85rem',
                  color: '#000',
                }}>
                  approx
                </div>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '0.95rem', color: '#FFF' }}>Spotify Cares</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>@SpotifyCares</span>
                </div>
              </div>

              <button
                onClick={handleCopyReply}
                style={{
                  backgroundColor: copied ? '#15803d' : 'rgba(255, 255, 255, 0.08)',
                  color: copied ? '#86efac' : '#FFF',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {copied ? '✓ Copied to Clipboard!' : '📋 Copy Reply'}
              </button>
            </div>

            <div style={{
              backgroundColor: 'rgba(9, 13, 20, 0.95)',
              border: '1px solid rgba(29, 185, 84, 0.25)',
              borderRadius: '12px',
              padding: '1.25rem',
              fontSize: '1.05rem',
              lineHeight: '1.6',
              color: '#F9FAFB',
              fontFamily: 'var(--font-sans)',
            }}>
              {result.reply}
            </div>
          </div>

          {/* Retrieved Historical Threads Accordion / List */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#FFF', fontFamily: 'var(--font-heading)' }}>
                  Retrieved Knowledge Base Cases (pgvector)
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Top cosine similarity matches retrieved from Neon Serverless PostgreSQL HNSW vector store
                </p>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
                {result.retrievedThreads.length} Matches Found
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {result.retrievedThreads.map((t, idx) => {
                const isExpanded = expandedThread === t.threadId;
                const matchPct = (t.similarity * 100).toFixed(1);
                return (
                  <div
                    key={t.threadId}
                    style={{
                      backgroundColor: 'rgba(9, 13, 20, 0.7)',
                      border: `1px solid ${isExpanded ? '#1DB954' : 'var(--border-color)'}`,
                      borderRadius: '10px',
                      padding: '1rem',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div
                      onClick={() => setExpandedThread(isExpanded ? null : t.threadId)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          backgroundColor: 'rgba(56, 189, 248, 0.15)',
                          color: '#38BDF8',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          padding: '0.2rem 0.5rem',
                          borderRadius: '4px',
                          fontFamily: 'var(--font-mono)',
                        }}>
                          #{t.threadId}
                        </span>
                        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#E5E7EB' }}>
                          Historical Case Match #{idx + 1}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          color: t.similarity >= 0.7 ? '#1DB954' : '#F59E0B',
                        }}>
                          {matchPct}% Cosine Similarity
                        </span>
                        <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </div>
                    </div>

                    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.85rem' }}>
                      <div style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                        <strong style={{ color: '#9CA3AF' }}>Customer Query:</strong> {t.initialMessage}
                      </div>
                      <div style={{ color: '#F3F4F6' }}>
                        <strong style={{ color: '#1DB954' }}>Verified Spotify Support Resolution:</strong> {t.resolutionReply}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
