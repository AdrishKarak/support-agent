# Multi-Brand AI Customer Support Platform Architecture

The platform turns a public customer-support message into a structured intent, a brand-isolated retrieval result, a grounded reply draft, and an escalation decision. Spotify is the default brand; Apple Support and Amazon Help use the same pipeline with separate knowledge-base rows and prompt context.

## System Context

```mermaid
flowchart LR
    User[Support operator] --> UI[Next.js Web UI]
    UI --> API[POST /api/pipeline]
    API --> Pipeline[runAgentPipeline(message, brand)]
    Pipeline --> Groq[Groq structured generation]
    Pipeline --> Gemini[Gemini embeddings and fallback]
    Pipeline --> Neon[Neon PostgreSQL + pgvector]
    Neon --> Filter[brand column / metadata.brand predicate]
    Filter --> Pipeline
    Pipeline --> API --> UI
```

## Runtime Pipeline

```mermaid
sequenceDiagram
    participant UI as Brand-aware UI
    participant API as Next API route
    participant P as Pipeline
    participant C as Classifier
    participant R as Gemini + pgvector
    participant D as Draft prompt
    participant E as Escalation guardrails

    UI->>API: { message, brand }
    API->>P: validate brand or default SpotifyCares
    par Independent stages
        P->>C: classify with brandName, brandHandle, brandDomain
        C-->>P: intent, confidence, reasoning
        P->>R: embed query and filter by brand
        R-->>P: top-k same-brand threads
    end
    P->>D: message + intent + same-brand context
    D-->>P: grounded reply JSON
    P->>E: message + confidence + similarity + draft + brand
    E-->>P: escalation decision
    P-->>API: typed pipeline result
    API-->>UI: reply, metrics, brand, escalation state
```

## Offline Data Flow

```mermaid
flowchart TD
    CSV[data/raw/twcs/twcs.csv] --> ETL[cleanAndThread.ts]
    ETL --> Threads[Sanitized threads with brand key]
    Threads --> KB[data/processed/knowledge_base.jsonl]
    KB --> Embed[embedKnowledgeBase.ts]
    Embed --> DB[(knowledge_base_entries)]
    DB --> HNSW[HNSW cosine index]
    Threads --> Taxonomy[buildTaxonomy.ts]
    Threads --> Golden[seedGoldenEvalSet.ts]
    Golden --> Eval[data/processed/golden_eval_set.jsonl]
```

`cleanAndThread.ts` reconstructs parent-child conversations using `tweet_id` and `in_response_to_tweet_id`, sanitizes PII, and assigns one of the supported brand keys. The current raw export is stored at `data/raw/twcs/twcs.csv`; the script also accepts `data/raw/twcs.csv` when present.

## Data Model

```mermaid
erDiagram
    Thread {
        string id PK
        string threadId UK
        string brand
        text initialMessage
        text resolutionReply
        int turnCount
        boolean isResolved
    }
    KnowledgeBaseEntry {
        string id PK
        string threadId UK
        string brand
        text initialMessage
        text resolutionReply
        string contentHash
        vector embedding_768
        jsonb metadata
    }
    GoldenEvalLabel {
        string id PK
        string threadId UK
        text customerMessage
        string groundTruthIntent
        boolean groundTruthEscalate
        text referenceReply
    }
    Thread ||--o{ KnowledgeBaseEntry : feeds
    Thread ||--o{ GoldenEvalLabel : evaluates
```

The retrieval query is intentionally brand-aware:

```sql
WHERE embedding IS NOT NULL
  AND (brand = $3 OR metadata->>'brand' = $3)
ORDER BY embedding <=> $1::vector ASC
LIMIT $2
```

## Reliability and Safety

- Groq is the primary structured-generation provider; Gemini is the fallback.
- Legal, security, and explicit human-demand signals escalate before LLM policy judgment.
- Low classifier confidence (`< 0.65`) or low retrieval similarity (`< 0.50`) escalates.
- REST and tRPC inputs validate brand keys with Zod.
- Pipeline cache keys include the brand, preventing cross-brand response reuse.

## Evaluation Architecture

The harness contains a 132-record Spotify evaluation artifact, a trivial keyword baseline, a no-RAG baseline, four-dimensional judge scoring, and a judge-agreement script. Sampling, labeling, rubric, and agreement workflows are versioned with the artifacts in `data/scripts/` and `eval/`. See [`report/REPORT.md`](report/REPORT.md) for measured results and interpretation guidance.

## Reproduction Commands

```bash
npm install
cp .env.example .env
npm run setup
npx tsc --noEmit
npx jest --runInBand
npm run eval:baselines
npm run eval:agreement
npm run eval
npm run dev
```

The complete database-backed evaluation requires `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, and `GROQ_API_KEY`. The full ETL over the raw export is intentionally separate from the under-15-minute reviewer path because it scans a large CSV and consumes embedding quota.
