'use client';

import React, { useState } from 'react';
import { BRAND_KEYS, BRAND_CONFIGS, BrandKey, DEFAULT_BRAND } from '@/brands';

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
  brand: BrandKey;
  _cached?: boolean;
}

function getPresets(handle: string, domain: string) {
  return [
  {
    icon: '🎧',
    label: domain === 'Music Streaming' ? 'Playback Bug' : 'Device Issue',
    text: `${handle} my app and device are not working correctly after the latest software update. Help!`,
  },
  {
    icon: '🔐',
    label: 'Account Hacked',
    text: `${handle} someone hacked into my account and changed my email address to an unauthorized domain!`,
  },
  {
    icon: '💳',
    label: 'Double Charge',
    text: `${handle} I got charged twice for my subscription this month. Please issue a refund.`,
  },
  {
    icon: '⚖️',
    label: 'Legal Threat',
    text: `${handle} you refuse to process my cancellation. My attorney is filing an official complaint today.`,
  },
  {
    icon: '📱',
    label: 'Offline Syncing',
    text: `${handle} my saved content keeps disappearing when I switch to offline mode.`,
  },
  {
    icon: '📁',
    label: 'Feature Request',
    text: `${handle} is there any plan to improve organization and customization in the app?`,
  },
  ];
}

const INTENT_BADGES: Record<string, { label: string; color: string }> = {
  playback_issue: { label: 'Playback Issue', color: '#3B82F6' },
  offline_download: { label: 'Offline & Download', color: '#6366F1' },
  account_access: { label: 'Account Access', color: '#A855F7' },
  subscription_billing: { label: 'Billing & Subscriptions', color: '#EC4899' },
  audio_quality: { label: 'Audio Quality & Devices', color: '#10B981' },
  playlist_library: { label: 'Playlists & Library', color: '#14B8A6' },
  app_bug_crash: { label: 'App Bug & Crashes', color: '#EF4444' },
  feature_inquiry: { label: 'Feature Inquiries', color: '#F59E0B' },
  human_escalation_required: { label: 'Human Escalation', color: '#DC2626' },
};

function SpotifyIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#1DB954" style={{ flexShrink: 0 }}>
      <path d="M12 0C5.376 0 0 5.376 0 12s5.376 12 12 12 12-5.376 12-12S18.624 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141 C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z" />
    </svg>
  );
}

export default function Home() {
  const [activeBrand, setActiveBrand] = useState<BrandKey>(DEFAULT_BRAND);
  const brand = BRAND_CONFIGS[activeBrand];
  const presets = getPresets(brand.handle, brand.domain);
  const [message, setMessage] = useState(presets[0].text);
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
        body: JSON.stringify({ message, brand: activeBrand }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Pipeline request failed');
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
    <div style={{ minHeight: '100vh', backgroundColor: '#090D14', color: '#F3F4F6', fontFamily: 'var(--font-sans)' }}>
      {/* 1. Top Navbar */}
      <nav style={{
        backgroundColor: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        padding: '0.9rem 2rem',
      }}>
        <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Brand Logo & Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }} aria-hidden="true">{brand.icon}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.3px' }}>
                Multi-Brand AI Support Platform
              </span>
              <span style={{
                backgroundColor: 'rgba(29, 185, 84, 0.15)',
                color: '#1DB954',
                border: '1px solid rgba(29, 185, 84, 0.3)',
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}>
                <span className="pulsing-dot" /> RAG Pipeline
              </span>
            </div>
          </div>

          {/* Right Action Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#CBD5E1', fontSize: '0.8rem', fontWeight: 700 }}>
              <span>Support brand</span>
              <select
                aria-label="Select support brand"
                value={activeBrand}
                onChange={(event) => {
                  const nextBrand = event.target.value as BrandKey;
                  setActiveBrand(nextBrand);
                  setMessage(getPresets(BRAND_CONFIGS[nextBrand].handle, BRAND_CONFIGS[nextBrand].domain)[0].text);
                  setResult(null);
                  setError(null);
                }}
                style={{ backgroundColor: '#111827', color: '#F8FAFC', border: `1px solid ${brand.accent}66`, borderRadius: '8px', padding: '0.45rem 0.6rem', fontWeight: 700, cursor: 'pointer' }}
              >
                {BRAND_KEYS.map(key => <option key={key} value={key}>{BRAND_CONFIGS[key].icon} {BRAND_CONFIGS[key].name}</option>)}
              </select>
            </label>
            <button
              onClick={() => setShowExplanation(!showExplanation)}
              style={{
                backgroundColor: showExplanation ? 'rgba(255,255,255,0.12)' : 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#E5E7EB',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {showExplanation ? 'Close Info ✖' : 'Architecture Info 💡'}
            </button>
            <a
              href="https://github.com/AdrishKarak/support-agent"
              target="_blank"
              rel="noreferrer"
              style={{
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                color: '#38BDF8',
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.825rem',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
              }}
            >
              GitHub ↗
            </a>
          </div>
        </div>
      </nav>

      {/* 2. Main Page Container */}
      <main style={{ maxWidth: '1080px', margin: '0 auto', padding: '2.5rem 1.5rem 4rem 1.5rem' }}>

        {/* Optional Architecture Explainer Panel */}
        {showExplanation && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1.5rem', marginBottom: '2rem', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#38BDF8', marginBottom: '1rem', fontFamily: 'var(--font-heading)' }}>
              System Architecture & Resolution Workflow
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
                <div style={{ color: '#38BDF8', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem' }}>1A. Groq Intent Classification</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  Classifies customer message into 9 canonical intents using Groq <code>gpt-oss-20b</code> (fallback to Gemini).
                </p>
              </div>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
                <div style={{ color: '#1DB954', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem' }}>1B. pgvector Dense RAG</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  Embeds query via Gemini 768-dim model & performs cosine similarity search on Neon PostgreSQL HNSW index.
                </p>
              </div>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
                <div style={{ color: '#A855F7', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem' }}>2. Grounded Reply Drafting</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  Synthesizes a helpful, grounded Twitter response using intent context and top retrieved resolution steps.
                </p>
              </div>
              <div style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1rem', borderRadius: '10px' }}>
                <div style={{ color: '#F59E0B', fontWeight: 700, fontSize: '0.85rem', marginBottom: '0.3rem' }}>3. Multi-Tier Escalation</div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                  Evaluates regex heuristics (legal/security/human demands), confidence thresholds (&lt;0.65), and RAG match (&lt;0.50).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Subtitle / Intro Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '0.4rem', letterSpacing: '-0.5px' }}>
            AI Customer Support Triage & Retrieval
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.5' }}>
            Simulate incoming customer tweets to `{brand.handle}` to test intent classification, brand-isolated vector RAG retrieval, grounded reply drafting, and automated escalation safety guardrails.
          </p>
        </div>

        {/* Input Card */}
        <div className="glass-panel" style={{ padding: '1.75rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span>Customer Inquiry ({brand.handle})</span>
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
            placeholder="Type a customer support message..."
            style={{
              width: '100%',
              backgroundColor: 'rgba(9, 13, 20, 0.85)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: '12px',
              padding: '1rem',
              fontSize: '0.95rem',
              fontFamily: 'var(--font-sans)',
              lineHeight: '1.5',
              resize: 'vertical',
              outline: 'none',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--spotify-green)';
              e.target.style.boxShadow = '0 0 0 3px rgba(29, 185, 84, 0.15)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.target.style.boxShadow = 'none';
            }}
          />

          {/* Preset Scenario Pills */}
          <div style={{ marginTop: '1.25rem' }}>
            <div style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '0.6rem' }}>
              Test Scenarios:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {presets.map((p, idx) => {
                const isSelected = message === p.text;
                return (
                  <button
                    key={idx}
                    onClick={() => setMessage(p.text)}
                    style={{
                      backgroundColor: isSelected ? 'rgba(29, 185, 84, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                      color: isSelected ? '#1DB954' : '#D1D5DB',
                      border: `1px solid ${isSelected ? '#1DB954' : 'rgba(255, 255, 255, 0.08)'}`,
                      borderRadius: '20px',
                      padding: '0.35rem 0.8rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{p.icon}</span>
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Run Button Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              🔒 PII Sanitization Enabled &bull; LRU Caching Active
            </span>

            <button
              onClick={handleRun}
              disabled={loading || !message.trim()}
              style={{
                backgroundColor: loading ? '#15803d' : '#1DB954',
                color: '#000000',
                border: 'none',
                borderRadius: '10px',
                padding: '0.7rem 1.8rem',
                fontSize: '0.95rem',
                fontWeight: 800,
                fontFamily: 'var(--font-heading)',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(29, 185, 84, 0.35)',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {loading ? (
                <>
                  <span className="pulsing-dot" style={{ backgroundColor: '#000' }} />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Run Pipeline</span>
                  <span>🚀</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="animate-fade-in" style={{
            backgroundColor: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            padding: '1rem 1.25rem',
            marginBottom: '2rem',
            color: '#FCA5A5',
            fontSize: '0.9rem',
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '2rem' }}>
            <div className="glass-panel skeleton-shimmer" style={{ height: '80px', borderRadius: '12px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <div className="glass-panel skeleton-shimmer" style={{ height: '130px', borderRadius: '12px' }} />
              <div className="glass-panel skeleton-shimmer" style={{ height: '130px', borderRadius: '12px' }} />
            </div>
          </div>
        )}

        {/* Pipeline Execution Flow Status (Visible when result exists) */}
        {result && !loading && (
          <div className="glass-panel animate-fade-in" style={{ padding: '1rem 1.5rem', marginBottom: '1.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                Pipeline Execution Steps
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Total Latency: <strong>{result.latencyMs}ms</strong> {result._cached && '(⚡ Served from LRU Cache)'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
              {[
                { name: '1A. Groq Intent', status: result.intent ? 'Success' : 'Passed', color: '#38BDF8' },
                { name: '1B. pgvector RAG', status: result.retrievedThreads.length > 0 ? `${(result.retrievedThreads[0].similarity * 100).toFixed(0)}% Match` : 'No Match', color: '#1DB954' },
                { name: '2. Grounded Reply', status: 'Generated', color: '#A855F7' },
                { name: '3. Escalation Check', status: result.escalate ? 'Escalated' : 'Auto-Handled', color: result.escalate ? '#EF4444' : '#1DB954' },
              ].map((step, i) => (
                <div key={i} style={{
                  backgroundColor: 'rgba(0,0,0,0.3)',
                  border: `1px solid ${step.color}44`,
                  borderRadius: '8px',
                  padding: '0.5rem 0.75rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#E5E7EB' }}>{step.name}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: 700, color: step.color, backgroundColor: `${step.color}15`, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {step.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results View */}
        {result && !loading && (
          <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
            {/* Triage Outcome Banner */}
            <div style={{
              backgroundColor: result.escalate ? 'rgba(239, 68, 68, 0.1)' : 'rgba(29, 185, 84, 0.1)',
              border: `1.5px solid ${result.escalate ? '#EF4444' : '#1DB954'}`,
              borderRadius: '16px',
              padding: '1.5rem',
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    fontSize: '1.2rem',
                    fontWeight: 900,
                    fontFamily: 'var(--font-heading)',
                    color: result.escalate ? '#F87171' : '#4ADE80',
                  }}>
                    {result.escalate ? '🚨 ESCALATION REQUIRED' : '✅ AUTO-HANDLED VIA RAG'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    padding: '0.2rem 0.6rem',
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
                    padding: '0.2rem 0.6rem',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#E5E7EB',
                  }}>
                    Target: <strong>{result.targetTeam}</strong>
                  </span>
                </div>
              </div>

              <div style={{ fontSize: '0.925rem', color: '#F3F4F6', lineHeight: '1.5' }}>
                <strong>Reason:</strong> {result.escalationReason}
              </div>
            </div>

            {/* Metrics Breakdown Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem' }}>
              {/* Intent Card */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Stage 1A: Intent Taxonomy
                  </span>
                  <span style={{
                    fontSize: '0.725rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '4px',
                    backgroundColor: `${INTENT_BADGES[result.intent]?.color || '#3B82F6'}22`,
                    color: INTENT_BADGES[result.intent]?.color || '#3B82F6',
                    border: `1px solid ${INTENT_BADGES[result.intent]?.color || '#3B82F6'}44`,
                  }}>
                    {INTENT_BADGES[result.intent]?.label || result.intent}
                  </span>
                </div>

                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#38BDF8', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                  {result.intent}
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    <span>Confidence Score</span>
                    <span style={{ fontWeight: 700, color: '#FFF' }}>{(result.confidence * 100).toFixed(0)}%</span>
                  </div>
                  <div style={{ height: '5px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, Math.max(0, result.confidence * 100))}%`,
                      backgroundColor: result.confidence >= 0.75 ? '#38BDF8' : result.confidence >= 0.65 ? '#F59E0B' : '#EF4444',
                      borderRadius: '3px',
                    }} />
                  </div>
                </div>

                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.4', backgroundColor: 'rgba(0,0,0,0.25)', padding: '0.6rem', borderRadius: '6px' }}>
                  &ldquo;{result.reasoning}&rdquo;
                </p>
              </div>

              {/* RAG Retrieval Card */}
              <div className="glass-panel" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontSize: '0.725rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                    Stage 1B: Dense Vector RAG
                  </span>
                  <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#1DB954' }}>
                    Neon pgvector
                  </span>
                </div>

                <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#1DB954', fontFamily: 'var(--font-heading)', marginBottom: '0.5rem' }}>
                  {result.retrievedThreads[0] ? `${(result.retrievedThreads[0].similarity * 100).toFixed(1)}% Cosine Match` : 'No Match Found'}
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.775rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                    <span>Top-1 Similarity</span>
                    <span style={{ fontWeight: 700, color: '#FFF' }}>
                      {result.retrievedThreads[0] ? `${(result.retrievedThreads[0].similarity * 100).toFixed(1)}%` : '0%'}
                    </span>
                  </div>
                  <div style={{ height: '5px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${result.retrievedThreads[0] ? Math.min(100, Math.max(0, result.retrievedThreads[0].similarity * 100)) : 0}%`,
                      backgroundColor: result.retrievedThreads[0]?.similarity >= 0.7 ? '#1DB954' : result.retrievedThreads[0]?.similarity >= 0.5 ? '#F59E0B' : '#EF4444',
                      borderRadius: '3px',
                    }} />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', backgroundColor: 'rgba(0,0,0,0.25)', padding: '0.6rem', borderRadius: '6px' }}>
                  <span>Matches Count: <strong>{result.retrievedThreads.length}</strong></span>
                  <span>Groundedness: <strong>{(result.groundednessConfidence * 100).toFixed(0)}%</strong></span>
                </div>
              </div>
            </div>

            {/* Stage 2: Grounded Reply Draft */}
            <div className="glass-panel" style={{ padding: '1.5rem', border: '1px solid rgba(29, 185, 84, 0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '1.25rem' }} aria-hidden="true">{brand.icon}</span>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#FFF' }}>{brand.name}</span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginLeft: '0.4rem' }}>{brand.handle}</span>
                  </div>
                </div>

                <button
                  onClick={handleCopyReply}
                  style={{
                    backgroundColor: copied ? '#15803d' : 'rgba(255, 255, 255, 0.08)',
                    color: copied ? '#86efac' : '#FFFFFF',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '6px',
                    padding: '0.35rem 0.75rem',
                    fontSize: '0.775rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy Reply'}
                </button>
              </div>

              <div style={{
                backgroundColor: 'rgba(9, 13, 20, 0.95)',
                border: '1px solid rgba(29, 185, 84, 0.2)',
                borderRadius: '10px',
                padding: '1.15rem',
                fontSize: '1rem',
                lineHeight: '1.55',
                color: '#F9FAFB',
              }}>
                {result.reply}
              </div>
            </div>

            {/* Stage 1B: Retrieved Historical Support Threads */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFF', fontFamily: 'var(--font-heading)' }}>
                    Retrieved Knowledge Base Threads (pgvector)
                  </h3>
                  <p style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                    Top-k historical support threads retrieved from Neon Serverless PostgreSQL
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {result.retrievedThreads.map((t, idx) => {
                  const isExpanded = expandedThread === t.threadId;
                  const matchPct = (t.similarity * 100).toFixed(1);
                  return (
                    <div
                      key={t.threadId}
                      style={{
                        backgroundColor: 'rgba(9, 13, 20, 0.6)',
                        border: `1px solid ${isExpanded ? '#1DB954' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: '10px',
                        padding: '0.9rem 1.15rem',
                        transition: 'all 0.15s ease',
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{
                            backgroundColor: 'rgba(56, 189, 248, 0.12)',
                            color: '#38BDF8',
                            fontWeight: 700,
                            fontSize: '0.725rem',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                          }}>
                            Thread #{t.threadId}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#E5E7EB' }}>
                            Historical Resolution #{idx + 1}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span style={{
                            fontSize: '0.775rem',
                            fontWeight: 700,
                            color: t.similarity >= 0.7 ? '#1DB954' : '#F59E0B',
                          }}>
                            {matchPct}% Cosine Similarity
                          </span>
                          <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem' }}>
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '0.825rem' }}>
                        <div style={{ color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                          <strong style={{ color: '#9CA3AF' }}>Customer Query:</strong> {t.initialMessage}
                        </div>
                        <div style={{ color: '#F3F4F6' }}>
                          <strong style={{ color: brand.accent }}>Verified {brand.name} Resolution:</strong> {t.resolutionReply}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}
