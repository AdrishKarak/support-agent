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
}

const PRESETS = [
  {
    label: 'Playback Bug',
    text: '@SpotifyCares my shuffle and repeat buttons are frozen on iOS after the latest update. Help!',
  },
  {
    label: 'Account Compromised',
    text: '@SpotifyCares someone hacked my account and changed my email to an unauthorized address!',
  },
  {
    label: 'Billing Dispute',
    text: '@SpotifyCares I got charged twice for my Family subscription this month, need an immediate refund.',
  },
  {
    label: 'Legal Escalation',
    text: '@SpotifyCares you refuse to cancel my subscription, my lawyer is filing an FTC complaint today.',
  },
  {
    label: 'Feature Request',
    text: '@SpotifyCares is there any way to create folders to organize my custom playlists?',
  },
];

export default function Home() {
  const [message, setMessage] = useState(PRESETS[0].text);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PipelineResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        throw new Error(data.error || 'Pipeline request failed');
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      color: '#c9d1d9',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      padding: '2rem 1.5rem',
    }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ borderBottom: '1px solid #30363d', paddingBottom: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{
              backgroundColor: '#1DB954',
              color: '#000',
              fontWeight: 800,
              padding: '0.2rem 0.6rem',
              borderRadius: '999px',
              fontSize: '0.85rem'
            }}>SPOTIFY CARES</span>
            <span style={{ color: '#8b949e', fontSize: '0.9rem' }}>Production AI Support Agent</span>
          </div>
          <h1 style={{ color: '#f0f6fc', fontSize: '2rem', margin: '0.25rem 0' }}>
            Multi-Tier Support Triage & Retrieval Pipeline
          </h1>
          <p style={{ color: '#8b949e', margin: '0.5rem 0 0 0', fontSize: '1rem' }}>
            Grounded via dense <code>pgvector</code> semantic search on Neon PostgreSQL, Groq (<code>openai/gpt-oss-20b</code>), and Gemini (<code>gemini-3.6-flash</code>).
          </p>
        </header>

        {/* Preset selector */}
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#8b949e', marginBottom: '0.5rem', fontWeight: 600 }}>
            TEST SCENARIOS:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => setMessage(p.text)}
                style={{
                  backgroundColor: '#21262d',
                  color: '#58a6ff',
                  border: '1px solid #30363d',
                  borderRadius: '6px',
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  fontWeight: 500,
                  transition: 'background 0.2s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input box */}
        <div style={{
          backgroundColor: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '1.25rem',
          marginBottom: '2rem'
        }}>
          <label style={{ display: 'block', fontSize: '0.9rem', color: '#f0f6fc', fontWeight: 600, marginBottom: '0.5rem' }}>
            Incoming Customer Tweet:
          </label>
          <textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type an incoming customer support inquiry..."
            style={{
              width: '100%',
              backgroundColor: '#0d1117',
              color: '#f0f6fc',
              border: '1px solid #30363d',
              borderRadius: '6px',
              padding: '0.75rem',
              fontSize: '0.95rem',
              boxSizing: 'border-box',
              resize: 'vertical',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: '#8b949e' }}>
              Max 280 characters standard Twitter micro-inquiry
            </span>
            <button
              onClick={handleRun}
              disabled={loading || !message.trim()}
              style={{
                backgroundColor: loading ? '#238636' : '#1DB954',
                color: loading ? '#fff' : '#000',
                border: 'none',
                borderRadius: '6px',
                padding: '0.6rem 1.5rem',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Processing Pipeline...' : 'Run Pipeline 🚀'}
            </button>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            backgroundColor: 'rgba(248, 81, 73, 0.1)',
            border: '1px solid #f85149',
            color: '#ff7b72',
            padding: '1rem',
            borderRadius: '6px',
            marginBottom: '2rem',
          }}>
            <strong>Error executing pipeline:</strong> {error}
          </div>
        )}

        {/* Result view */}
        {result && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Triage Banner */}
            <div style={{
              backgroundColor: result.escalate ? 'rgba(248, 81, 73, 0.15)' : 'rgba(35, 134, 54, 0.15)',
              border: `1px solid ${result.escalate ? '#f85149' : '#238636'}`,
              borderRadius: '8px',
              padding: '1.25rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontWeight: 800,
                  fontSize: '1.1rem',
                  color: result.escalate ? '#ff7b72' : '#3fb950',
                }}>
                  {result.escalate ? '🚨 ESCALATION REQUIRED' : '✅ AUTO-HANDLED VIA RAG'}
                </span>
                <span style={{ fontSize: '0.85rem', color: '#8b949e' }}>
                  Target: <strong>{result.targetTeam}</strong> ({result.priority.toUpperCase()}) | Latency: <strong>{result.latencyMs}ms</strong>
                </span>
              </div>
              <div style={{ fontSize: '0.95rem', color: '#f0f6fc' }}>
                <strong>Reason:</strong> {result.escalationReason}
              </div>
            </div>

            {/* Classification & Confidence */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem',
            }}>
              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '1rem',
              }}>
                <div style={{ fontSize: '0.8rem', color: '#8b949e', fontWeight: 600 }}>CLASSIFIED INTENT</div>
                <div style={{ fontSize: '1.25rem', color: '#58a6ff', fontWeight: 700, margin: '0.25rem 0' }}>
                  <code>{result.intent}</code>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>
                  Confidence: <strong>{(result.confidence * 100).toFixed(0)}%</strong>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#c9d1d9', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  "{result.reasoning}"
                </p>
              </div>

              <div style={{
                backgroundColor: '#161b22',
                border: '1px solid #30363d',
                borderRadius: '8px',
                padding: '1rem',
              }}>
                <div style={{ fontSize: '0.8rem', color: '#8b949e', fontWeight: 600 }}>RETRIEVAL SIMILARITY</div>
                <div style={{ fontSize: '1.25rem', color: '#3fb950', fontWeight: 700, margin: '0.25rem 0' }}>
                  {result.retrievedThreads[0] ? `${(result.retrievedThreads[0].similarity * 100).toFixed(1)}% Match` : 'No KB Match'}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#8b949e' }}>
                  Top-k Count: <strong>{result.retrievedThreads.length} resolved threads</strong>
                </div>
                <div style={{ fontSize: '0.85rem', color: '#8b949e', marginTop: '0.5rem' }}>
                  Groundedness Confidence: <strong>{(result.groundednessConfidence * 100).toFixed(0)}%</strong>
                </div>
              </div>
            </div>

            {/* Generated Reply */}
            <div style={{
              backgroundColor: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '1.25rem',
            }}>
              <div style={{ fontSize: '0.85rem', color: '#8b949e', fontWeight: 600, marginBottom: '0.5rem' }}>
                GROUNDED PUBLIC REPLY DRAFT (@SpotifyCares):
              </div>
              <div style={{
                backgroundColor: '#0d1117',
                border: '1px solid #1DB954',
                borderRadius: '6px',
                padding: '1rem',
                color: '#f0f6fc',
                fontSize: '1.05rem',
                lineHeight: '1.5',
              }}>
                {result.reply}
              </div>
            </div>

            {/* Retrieved Context Cards */}
            <div style={{
              backgroundColor: '#161b22',
              border: '1px solid #30363d',
              borderRadius: '8px',
              padding: '1.25rem',
            }}>
              <div style={{ fontSize: '0.85rem', color: '#8b949e', fontWeight: 600, marginBottom: '0.75rem' }}>
                RETRIEVED KNOWLEDGE BASE HISTORICAL RESOLUTIONS (pgvector cosine similarity):
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {result.retrievedThreads.map((t, idx) => (
                  <div key={t.threadId} style={{
                    backgroundColor: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: '6px',
                    padding: '0.75rem',
                    fontSize: '0.85rem',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#58a6ff', marginBottom: '0.25rem' }}>
                      <span>Thread #{t.threadId}</span>
                      <span>Cosine Similarity: {(t.similarity * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ color: '#8b949e', marginBottom: '0.25rem' }}>
                      <strong>Customer:</strong> {t.initialMessage}
                    </div>
                    <div style={{ color: '#f0f6fc' }}>
                      <strong>Verified Spotify Resolution:</strong> {t.resolutionReply}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
