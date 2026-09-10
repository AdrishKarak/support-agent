# Spotify AI Customer Support Agent - Architecture Diagrams

This document contains a comprehensive set of architectural and flow diagrams for the Spotify AI Customer Support Agent project. These diagrams provide an overview of the system architecture, data processing pipelines, database structures, and runtime evaluation flows.

## 1. High-Level System Architecture

This diagram illustrates the macro-level architecture of the application. It highlights the frontend Client Web UI communicating with the Next.js API Route, which passes requests to a central Pipeline Orchestrator. The orchestrator delegates responsibilities to external services (Groq for fast inference, Gemini for embeddings/fallback, and Neon for vector storage).

```mermaid
graph TD
    Client["Client Web UI (Next.js)"] --> APIRoute["API Route (/api/agent)"]
    APIRoute --> PipelineOrchestrator["Pipeline Orchestrator"]
    
    subgraph External Services
        Groq["Groq API (openai/gpt-oss-20b)"]
        Gemini["Gemini API (gemini-embedding-2, gemini-3.6-flash)"]
        Neon["Neon DB (pgvector)"]
    end
    
    PipelineOrchestrator --> Groq
    PipelineOrchestrator --> Gemini
    PipelineOrchestrator --> Neon
```

## 2. Pipeline Execution Flow

This sequence diagram maps the temporal flow of a single user request through the system. It demonstrates the parallel execution of the Intent Classification and Vector Retrieval processes, followed by sequential drafting and escalation heuristics, terminating in a structured JSON response.

```mermaid
sequenceDiagram
    participant Client
    participant Orchestrator as Pipeline Orchestrator
    participant Classifier as Groq (Classifier)
    participant Retriever as Neon + Gemini (Embeddings)
    participant Drafter as Groq (Drafter)
    participant Escalator as Escalation Logic
    
    Client->>Orchestrator: Sends message
    par Classify and Retrieve
        Orchestrator->>Classifier: Classify Intent
        Classifier-->>Orchestrator: Intent Classification
    and
        Orchestrator->>Retriever: Retrieve similar threads (pgvector)
        Retriever-->>Orchestrator: Top K Threads
    end
    Orchestrator->>Drafter: Draft reply (Intent + Threads)
    Drafter-->>Orchestrator: Proposed Reply
    Orchestrator->>Escalator: Determine Escalation (Heuristics + LLM)
    Escalator-->>Orchestrator: Escalation Decision
    Orchestrator-->>Client: JSON Response (Typed)
```

## 3. Data Pipeline Flow

This flowchart models the offline ETL (Extract, Transform, Load) processes used to transform the initial 2.8M raw tweets into a structured Knowledge Base and a Golden Evaluation Set.

```mermaid
graph TD
    RawCSV["Raw CSV (2.8M tweets)"] -->|cleanAndThread.ts| Threads["29,426 Threads"]
    Threads -->|PII sanitization| CleanThreads["Sanitized Threads"]
    
    CleanThreads -->|Sample 250| BuildTaxonomy["buildTaxonomy.ts"]
    BuildTaxonomy -->|K-Means (k=12)| Intents["9 Intents Discovered"]
    
    CleanThreads -->|300 KB threads| EmbedKB["embedKnowledgeBase.ts"]
    EmbedKB -->|gemini-embedding-2 (768-dim)| Index["HNSW Index in Neon pgvector"]
    
    CleanThreads -->|132 golden examples| SeedGolden["seedGoldenEvalSet.ts"]
    SeedGolden -->|round-robin stratification| GoldenEvalSet["Golden Eval Set"]
```

## 4. Database Schema

An Entity-Relationship (ER) diagram representing the PostgreSQL database tables used by the application, focusing on the conversational threads, the generated vector knowledge base, and the records used for pipeline evaluation.

```mermaid
erDiagram
    Thread {
        string id PK
        string threadId
        string brand
        text initialMessage
        text resolutionReply
        int turnCount
        boolean isResolved
        datetime createdAt
    }
    
    KnowledgeBaseEntry {
        string id PK
        string threadId
        text initialMessage
        text resolutionReply
        string intent
        string contentHash
        vector768 embedding
        jsonb metadata
        datetime createdAt
        datetime updatedAt
    }
    
    GoldenEvalLabel {
        string id PK
        string threadId
        text customerMessage
        string groundTruthIntent
        boolean groundTruthEscalate
        string escalationReason
        text referenceReply
        text notes
        datetime createdAt
    }
    
    EvalRun {
        string id PK
        string runType
        int sampleSize
        float intentAccuracy
        float intentMacroF1
        float escalationPrecision
        float escalationRecall
        float escalationF1
        float retrievalHitRate
        jsonb judge_scores
        jsonb details
        datetime createdAt
    }
    
    Thread ||--o{ KnowledgeBaseEntry : "is source of"
    Thread ||--o{ GoldenEvalLabel : "evaluates"
```

## 5. LLM Provider Failover

This flowchart shows the system's resilience strategy. Groq is the primary provider, with retry logic for rate limits (429) and exponential backoff for other errors. If Groq is completely unreachable, the system automatically falls back to Gemini.

```mermaid
flowchart TD
    Start["Request LLM Generation"] --> Groq["Try Groq API (openai/gpt-oss-20b)"]
    Groq -->|Success| ParsedJSON["Parse & Return JSON"]
    
    Groq -->|Error 429| Wait["Wait 2.5s"]
    Wait --> RetryCount{"Retry Count < 3?"}
    RetryCount -->|Yes| Groq
    RetryCount -->|No| GeminiFallback["Fallback to Gemini (gemini-3.6-flash)"]
    
    Groq -->|Other Error| ExpBackoff["Exponential Backoff Retry"]
    ExpBackoff --> RetryCount2{"Retries Exhausted?"}
    RetryCount2 -->|No| Groq
    RetryCount2 -->|Yes| GeminiFallback
    
    GeminiFallback --> ParsedJSON
```

## 6. Escalation Decision Tree

This tree illustrates the multi-tier escalation logic. It relies on fast deterministic heuristics first (regex pattern matching for legal/security/human demands and threshold checks), falling back to LLM-based policy judgment only for nuanced scenarios.

```mermaid
flowchart TD
    Start["Check Escalation Needed"] --> CheckLegal{"Legal Keywords? (lawyer, lawsuit)"}
    CheckLegal -->|Yes| EscLegal["Escalate: Legal Team (Urgent)"]
    
    CheckLegal -->|No| CheckHuman{"Human Demand? (real person)"}
    CheckHuman -->|Yes| EscTier1High["Escalate: Tier 1 (High)"]
    
    CheckHuman -->|No| CheckSec{"Security Keywords? (hacked)"}
    CheckSec -->|Yes| EscSec["Escalate: Security/Fraud (Urgent)"]
    
    CheckSec -->|No| CheckConf{"Classifier Confidence < 0.65?"}
    CheckConf -->|Yes| EscTier1Med1["Escalate: Tier 1 (Medium)"]
    
    CheckConf -->|No| CheckSim{"KB Similarity < 0.50?"}
    CheckSim -->|Yes| EscTier1Med2["Escalate: Tier 1 (Medium)"]
    
    CheckSim -->|No| CheckIntent{"Intent == human_escalation_required?"}
    CheckIntent -->|Yes| EscTier1High2["Escalate: Tier 1 (High)"]
    
    CheckIntent -->|No| LLMPolicy["LLM Policy Judgment (Nuanced Cases)"]
    LLMPolicy -->|Requires Escalation| EscLLM["Escalate Based on Policy"]
    LLMPolicy -->|Safe| AutoHandle["Auto-handle (Resolved)"]
```

## 7. Evaluation Pipeline

This diagram showcases the offline evaluation workflow for analyzing the agent's performance. It executes the pipeline on the Golden Eval Set and computes rigorous quantitative metrics alongside qualitative LLM-as-a-Judge grading and Human Audit checks.

```mermaid
flowchart TD
    LoadEval["Load Golden Eval Set (132 items)"] --> RunPipe["Run Pipeline on Each Item"]
    RunPipe --> Collect["Collect Predictions & Generated Replies"]
    
    Collect --> CompareIntent["Compare Intent vs Ground Truth"]
    CompareIntent --> MetricsIntent["Intent Metrics: Accuracy, Macro F1, Macro Recall"]
    
    Collect --> CompareEsc["Compare Escalation vs Ground Truth"]
    CompareEsc --> MetricsEsc["Escalation Metrics: Precision, Recall, F1"]
    
    Collect --> LLMJudge["Run LLM-as-a-Judge on Replies"]
    LLMJudge --> JudgeScores["4 Dimension Scores (1-5 scale)"]
    
    Collect --> HumanAudit["Human Audit (15 random pairs)"]
    HumanAudit --> CohenKappa["Cohen's Kappa Inter-rater Agreement"]
```

## 8. Deployment Architecture

This diagram visualizes the production deployment target and the Continuous Integration flow used to test and validate changes prior to production. 

```mermaid
graph TD
    subgraph CI["GitHub Actions CI"]
        Checkout["Checkout Code"] --> Install["Install Dependencies"]
        Install --> Typecheck["TypeScript Typecheck"]
        Typecheck --> Test["Run Unit & Integration Tests"]
    end
    
    Test -.->|Build & Deploy| DockerContainer
    
    subgraph Prod["Production Environment"]
        DockerContainer["Docker Container (Node.js 22 Alpine)"]
        NextJS["Next.js Standalone Server"]
        DockerContainer --- NextJS
    end
    
    NextJS --> NeonDB["Neon PostgreSQL (pgvector)"]
    NextJS --> GroqProd["Groq API (Inference)"]
    NextJS --> GeminiProd["Gemini API (Embeddings & Fallback)"]
```
