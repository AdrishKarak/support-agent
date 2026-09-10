# Multi-Brand Support Platform Diagrams

These diagrams describe the current implementation. The selected brand is a first-class runtime value, not a UI-only decoration.

## 1. Brand-Aware Request Flow

```mermaid
flowchart LR
    Select[Brand selector] --> Payload[{ message, brand }]
    Payload --> Route[/api/pipeline]
    Route --> Cache[brand + normalized message cache key]
    Cache --> Pipeline[Agent pipeline]
    Pipeline --> Classify[Brand-aware intent prompt]
    Pipeline --> Retrieve[Brand-filtered vector search]
    Classify --> Draft[Brand-aware grounded draft]
    Retrieve --> Draft
    Draft --> Escalate[Brand-aware escalation prompt]
    Escalate --> Result[Reply + escalation + metrics]
```

## 2. Multi-Brand Knowledge Ingestion

```mermaid
flowchart TD
    Raw[TWCS CSV] --> Spotify[SpotifyCares author rows]
    Raw --> Apple[AppleSupport author rows]
    Raw --> Amazon[AmazonHelp author rows]
    Spotify --> Clean[Thread reconstruction + PII sanitization]
    Apple --> Clean
    Amazon --> Clean
    Clean --> JSONL[Combined knowledge_base.jsonl]
    JSONL --> Embed[Gemini 768-dim embeddings]
    Embed --> Rows[brand column + metadata.brand]
    Rows --> Vector[(knowledge_base_entries + HNSW)]
```

## 3. Brand-Isolated Retrieval

```mermaid
sequenceDiagram
    participant P as Pipeline
    participant G as Gemini embedding
    participant DB as pgvector
    P->>G: Embed customer message
    G-->>P: 768-dimensional vector
    P->>DB: ORDER BY cosine distance WHERE brand = selected key
    DB-->>P: Top-k threads from selected brand only
```

## 4. Escalation Decision Tree

```mermaid
flowchart TD
    Start[Incoming message] --> Legal{Legal or regulatory signal?}
    Legal -->|yes| UrgentLegal[Urgent legal escalation]
    Legal -->|no| Human{Explicit human demand?}
    Human -->|yes| Tier1[High priority Tier 1]
    Human -->|no| Security{Security compromise?}
    Security -->|yes| Fraud[Urgent security/fraud]
    Security -->|no| Confidence{Intent confidence < 0.65?}
    Confidence -->|yes| Review[Medium priority review]
    Confidence -->|no| Similarity{Top similarity < 0.50?}
    Similarity -->|yes| Review
    Similarity -->|no| Intent{Human-escalation intent?}
    Intent -->|yes| Tier1
    Intent -->|no| LLM[Nuanced LLM policy judgment]
    LLM -->|escalate| Review
    LLM -->|safe| Handle[Auto-handle with grounded reply]
```

## 5. Evaluation Harness

```mermaid
flowchart TD
    Golden[Golden JSONL] --> Agent[Full pipeline]
    Golden --> Trivial[Keyword + canned baseline]
    Golden --> ZeroShot[LLM without retrieval]
    Agent --> Metrics[Intent, escalation, retrieval metrics]
    Trivial --> Compare[Baseline comparison]
    ZeroShot --> Compare
    Agent --> Judge[LLM-as-a-judge rubric]
    Judge --> Human[Agreement study artifact]
    Human --> Caveat[Agreement statistics reported with rubric and sample provenance]
```

## 6. Deployment View

```mermaid
graph TD
    CI[GitHub Actions: typecheck + Jest] --> App[Next.js application]
    App --> Neon[Neon PostgreSQL + pgvector]
    App --> Groq[Groq API]
    App --> Gemini[Gemini API]
    Operator[Support operator browser] --> App
```
