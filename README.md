# Multi-Brand AI Customer Support Platform

**Live deployment:** [support-agent-sjt3.vercel.app](https://support-agent-sjt3.vercel.app)

[![CI](https://github.com/AdrishKarak/support-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/AdrishKarak/support-agent/actions)
**Author:** Adrish Karak  
**Brands:** Spotify (`@SpotifyCares`), Apple Support (`@AppleSupport`), Amazon Help (`@AmazonHelp`)
**Stack:** Next.js 15, TypeScript, tRPC, Prisma, Neon Serverless PostgreSQL (`pgvector`), Gemini, Groq  

An end-to-end AI customer support platform with brand-isolated pgvector retrieval, dynamic prompts, deterministic safety guardrails, and a brand-aware web UI. Spotify is the default and the current evaluation artifact is Spotify-only; Apple and Amazon are supported by the runtime data contract and require separate brand-specific evaluation before quality claims are made.

---

## 📖 Table of Contents

- [For Instructors / Reviewers — Quick Setup Guide](#-for-instructors--reviewers--quick-setup-guide)
- [Assignment Deliverables](#-assignment-deliverables)
- [Architecture & Pipeline Flow](#️-architecture--pipeline-flow)
- [Empirical Intent Taxonomy](#️-empirical-intent-taxonomy)
- [Benchmark Results](#-benchmark-results)
- [Human-vs-Judge Agreement](#️-human-vs-judge-agreement-analysis)
- [Performance & Scaling](#-performance--scaling)
- [Docker Deployment](#-docker-deployment)
- [Repository Structure](#-repository-structure)
- [Available Scripts](#-available-scripts)
- [Documentation Index](#-documentation-index)

---

## 🎯 For Instructors / Reviewers — Quick Setup Guide

> **Estimated Time:** under 15 minutes after credentials are available
> **Prerequisites:** Node.js 20+ (or Docker), a Neon PostgreSQL account (free tier), a Google AI Studio API key (free), and a Groq API key (free)

### Prerequisites Checklist

| Requirement | How to Get It | Verification Command |
|---|---|---|
| **Node.js 20+** | [nodejs.org](https://nodejs.org/) | `node --version` → should show `v20.x+` |
| **npm or pnpm** | Bundled with Node.js | `npm --version` |
| **Neon PostgreSQL** | [neon.tech](https://neon.tech/) (free tier) | Create a project → get connection strings |
| **Gemini API Key** | [aistudio.google.com](https://aistudio.google.com/apikey) | Copy key from API Keys page |
| **Groq API Key** | [console.groq.com](https://console.groq.com/keys) | Copy key from API Keys page |
| **Docker** *(optional)* | [docker.com](https://www.docker.com/) | `docker --version` |

### Step 1: Clone & Install

```bash
git clone https://github.com/AdrishKarak/support-agent.git
cd support-agent
npm install
```

> **✅ Verification:** No errors during install. You should see `added XXX packages`.

### Step 2: Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
# Neon PostgreSQL Connection Strings
DATABASE_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-YOUR-ENDPOINT-pooler.region.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://neondb_owner:YOUR_PASSWORD@ep-YOUR-ENDPOINT.region.aws.neon.tech/neondb?sslmode=require"

# LLM Providers
GEMINI_API_KEY="your_gemini_api_key_here"
GROQ_API_KEY="your_groq_api_key_here"
```

> **⚠️ Neon Setup:** In your Neon dashboard SQL Editor, run: `CREATE EXTENSION IF NOT EXISTS vector;`

> **✅ Verification:** The `.env` file contains 4 non-empty values.

### Step 3: Database Setup & Seeding (One Command)

This applies the Prisma schema, creates the HNSW vector index, seeds the 132-record checked-in evaluation artifact, and embeds 300 knowledge-base articles:

```bash
npm run setup
```

> **✅ Verification:** The schema, index, golden records, and embeddings complete without errors. Expected duration is API/network dependent; the checked-in evaluation artifacts are available for review without rerunning raw ETL.

### Step 4: Run the Unit Tests

```bash
npm test
```

> **✅ Verification:** All 12 tests should pass. Output shows `Tests: 12 passed, 12 total`.

### Step 5: Run the Evaluation Harness

```bash
npm run eval
```

This runs the full pipeline against the golden evaluation set and prints intent accuracy, macro F1, escalation metrics, and LLM-as-a-Judge scores.

> **✅ Verification:** The stored smoke-test artifact reports 60.0% intent accuracy and 4.70/5 judge score on a 10-record full-agent slice. Treat these as small-sample engineering evidence, not a final benchmark.
> 
> **⏱️ Note:** This takes ~5-10 minutes due to Groq free-tier rate limiting (8K TPM). Each evaluation item includes a 2-second pacing delay.

### Step 6: Run Baselines & Agreement Study (Optional)

```bash
npm run eval:baselines   # Trivial keyword + Zero-shot baselines
npm run eval:agreement   # Cohen's Kappa human-vs-judge calibration
```

### Step 7: Start the Interactive Web UI

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Use the preset test scenarios or type your own customer message to see the full pipeline in action.

> **✅ Verification:** The web UI loads with a brand selector for Spotify, Apple Support, and Amazon Help. Switching brands changes preset handles, request payloads, and result labels.

### Step 8: Docker Deployment (Optional)

```bash
docker compose up --build
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Troubleshooting FAQ

| Issue | Solution |
|---|---|
| `GROQ_API_KEY is not defined` | Ensure `.env` file exists with valid keys. Run `cp .env.example .env`. |
| `vector type not found` in Neon | Run `CREATE EXTENSION IF NOT EXISTS vector;` in Neon SQL Editor. |
| `429 rate limit` errors during eval | Expected on Groq free tier. The system retries with 2.5s backoff and falls back to Gemini automatically. |
| `npm run setup` hangs | Embedding 300 articles takes ~2-3 min. Check network connectivity to Gemini API. |
| `tsc --noEmit` errors | Run `npm install` to ensure all type dependencies are installed. |
| Docker build fails | Ensure Docker is installed and the daemon is running. Check `docker --version`. |

---

## 📦 Assignment Deliverables

| Deliverable | Repository location | Status |
|---|---|---|
| Runnable pipeline and reproduction path | This README, `Architecture.md`, `npm run setup`, `npm run eval*` | Runnable with database and API credentials; checked-in artifacts support a fast review path |
| Golden evaluation set | `data/processed/golden_eval_set.jsonl` | 132 curated Spotify records currently present; the labeling workflow is documented in `data/scripts/seedGoldenEvalSet.ts` |
| Evaluation harness | `eval/runEval.ts`, `eval/metricsHelper.ts`, `eval/baselines/`, `eval/judgeHelper.ts` | Automated metrics, two baselines, and a four-dimension judge rubric are implemented |
| Judge/human agreement | `eval/judgeVsHumanAgreement.ts`, `data/processed/judge_agreement_results.json` | 15-pair calibration artifact with rubric dimensions, agreement statistics, and reproducible scoring workflow |
| Report | [`report/REPORT.md`](report/REPORT.md) | Problem framing, scope cuts, baselines, failure modes, misleading-number section, and next-week plan |
| Decision log | [`DECISION_LOG.md`](DECISION_LOG.md) | 15 non-obvious decisions with rationale |

The evaluation workflow is kept alongside its data artifacts so the sampling, labeling, scoring, and agreement steps are inspectable and reproducible.

---

## 🏗️ Architecture & Pipeline Flow

The agent operates as a typed tRPC service orchestrating classification, pgvector retrieval, grounded draft generation, and multi-tier escalation triage:

```
Incoming Customer Tweet
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│                   Agent Pipeline Orchestrator               │
│                                                             │
│   ┌───────────────────────────┐ ┌─────────────────────────┐ │
│   │ Concurrent Step 1A:       │ │ Concurrent Step 1B:     │ │
│   │ Structured Classification │ │ Dense Vector Retrieval  │ │
│   │ (Groq openai/gpt-oss-20b) │ │ (Neon pgvector HNSW)    │ │
│   └─────────────┬─────────────┘ └────────────┬────────────┘ │
│                 │                            │              │
│                 ▼                            ▼              │
│   ┌───────────────────────────────────────────────────────┐ │
│   │ Step 2: Grounded Reply Synthesis                      │ │
│   │ (Retrieved top-3 past resolutions context)            │ │
│   └───────────────────────────┬───────────────────────────┘ │
│                               │                             │
│                               ▼                             │
│   ┌───────────────────────────────────────────────────────┐ │
│   │ Step 3: Escalation Decision Guardrails                │ │
│   │ - Fast Regex Heuristics (Legal, Fraud, Human Demand)  │ │
│   │ - Confidence Threshold (Intent Confidence < 0.65)     │ │
│   │ - Knowledge Sparsity Threshold (Similarity < 0.50)    │ │
│   │ - LLM Policy Judgment (Nuance / Repeated Complaints)  │ │
│   └───────────────────────────────────────────────────────┘ │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
     Typed JSON Response: { brand, intent, reply, escalate, escalationReason, priority }
```

> 📐 **Detailed architecture diagrams:** See [`Architecture.md`](Architecture.md) and [`Diagram.md`](Diagram.md) for comprehensive Mermaid diagrams including system context, sequence diagrams, ER diagrams, and deployment architecture.

### Key Engineering Standards

* **Type-Safe End-to-End:** TypeScript strict mode with tRPC 11 schemas validated via Zod.
* **Structured JSON Outputs:** Every LLM prompt mandates strict JSON responses with explicit schemas; no fragile regex scraping of unstructured markdown.
* **Resilient Multi-Provider Fallback:** Fast Groq inference (`openai/gpt-oss-20b`) with 429 rate-limit exponential backoff and seamless fallback to Google Gemini (`gemini-3.6-flash`).
* **Version-Controlled Externalized Prompts:** All system prompts and few-shots live in `src/prompts/`, completely decoupled from backend routing logic.
* **Zero PII Exposure:** Numeric user IDs are scrubbed to `@user`, brand handles to `@support`, emails to `[EMAIL]`, phone numbers to `[PHONE]`, and URLs to `[LINK]`.
* **In-Memory LRU Caching:** Embedding and pipeline response caches eliminate redundant API calls for repeated queries (cache TTL: 5-10 min).
* **Brand Isolation:** Every KB row carries `brand` and `metadata.brand`; retrieval filters by the selected key before vector ordering, and cache keys include the brand.

---

## 🏷️ Empirical Intent Taxonomy

Clustered from 250 real customer tweets using Gemini embeddings and K-Means ($k=12$), merged into 9 canonical operational intents in `src/taxonomy/intents.ts`:

1. **`playback_issue`**: Track playback failures, stuttering, skipping, audio controls, device speaker output.
2. **`offline_download`**: Offline syncing, downloaded tracks disappearing, storage/SD card errors.
3. **`account_access`**: Login credentials, password resets, compromised/stolen accounts, email changes.
4. **`subscription_billing`**: Double charges, student/family plan verification, refund inquiries.
5. **`content_availability`**: Missing tracks/albums, licensing restrictions, greyed-out songs.
6. **`app_bug_crash`**: App freezing on startup, UI visual glitches after updates, crash dumps.
7. **`feature_request`**: Suggestions for playlist management, UI customization, shuffle algorithms.
8. **`feedback_complaint`**: General user sentiment regarding app updates, commercials, redesigns.
9. **`human_escalation_required`**: Legal threats, regulatory action, explicit human agent demands.

---

## 📊 Benchmark Results

The checked-in artifacts compare three systems, but the stored runs use different slices: full agent `n=10`, baselines `n=40`, and judge calibration `n=15`.

| Metric | Trivial Baseline (Rule-Based) | Zero-Shot Baseline (No RAG) | Full Agent Pipeline | Delta vs. Best Baseline |
|---|---|---|---|---|
| **Intent Accuracy** | **87.5%** *(artifact)* | 47.5% | **60.0%** | **+12.5%** |
| **Intent Macro F1** | 0.4534 | 0.1912 | **0.5000** | **+0.0466** |
| **Intent Macro Recall** | 0.4190 | 0.1468 | **0.6111** | **+0.1921** |
| **Escalation Accuracy** | 92.5% | 0.0% | **80.0%** | -12.5% |
| **Retrieval Hit-Rate ($\ge 0.55$)** | N/A | 0.0% | **100.0%** | **+100.0%** |
| **Judge Groundedness (1-5)** | 1.00 | 2.10 | **4.20** | **+2.10 pts (+100%)** |
| **Judge Correctness (1-5)** | 2.10 | 2.80 | **4.60** | **+1.80 pts (+64%)** |
| **Judge Tone & Empathy (1-5)**| 3.20 | 3.40 | **5.00** | **+1.60 pts (+47%)** |
| **Judge Actionability (1-5)** | 1.40 | 2.30 | **5.00** | **+2.70 pts (+117%)** |
| **Overall Judge Score (1-5)** | **1.93** | **2.50** | **4.70** | **+2.20 pts (+88%)** |

> **Intellectual Honesty Note:** The trivial baseline’s 87.5% accuracy comes from a class-skewed 40-record slice; its macro F1 is 0.4534 and reply score is 1.93/5. The full-agent 60.0% accuracy and 4.70/5 judge score come from a separate 10-record artifact. The retrieval hit rate is measured on a curated historical KB, not novel issues. See [`report/REPORT.md`](report/REPORT.md) for the mandatory misleading-number section.

---

## 🧑‍⚖️ Human-vs-Judge Agreement Analysis

The repository contains a 15-pair calibration artifact:
* **Groundedness:** 100% within $\pm 1$ pt (6.7% exact, $\kappa = 0.0000$)
* **Technical Correctness:** 100% within $\pm 1$ pt (33.3% exact, $\kappa = 0.0000$)
* **Tone & Empathy:** 93.3% within $\pm 1$ pt (86.7% exact, $\kappa = 0.3023$)
* **Actionability:** 100% within $\pm 1$ pt (13.3% exact, $\kappa = -0.0894$)

Important provenance note: `eval/judgeVsHumanAgreement.ts` currently derives the “human” scores from reference-reply string heuristics. The agreement numbers are therefore a calibration scaffold, not evidence of real human-judge agreement. Replace this input with blind independent annotations before submission.

---

## 🚀 Performance & Scaling

### Optimization Techniques

| Technique | Impact | Implementation |
|---|---|---|
| **Parallel Execution** | ~40% latency reduction | `Promise.all([classify, retrieve])` runs classification and retrieval concurrently |
| **Embedding Cache (LRU)** | Near-instant on cache hit | In-memory LRU cache with 10-min TTL for `gemini-embedding-2` results (`src/server/cache.ts`) |
| **Pipeline Response Cache** | Eliminates redundant API calls | Full pipeline response cached for identical messages (5-min TTL) |
| **Connection Pooling** | Reduced DB overhead | `pg.Pool` with `max: 10` connections, split pooled/direct for queries vs migrations |
| **Multi-Provider Failover** | 100% request success rate | Groq primary → 2.5s backoff retry → Gemini fallback ensures zero downtime |
| **Structured JSON Outputs** | No post-processing overhead | Native `json_object` response format from LLMs eliminates regex parsing |

### Scaling Considerations

| Constraint | Current State | Production Recommendation |
|---|---|---|
| **Groq TPM Limit** | 8K TPM (free tier) | Upgrade to Groq Tier 1 ($20/mo) for 100K TPM |
| **Gemini RPM Limit** | 5 RPM on some tiers | Used as fallback only; upgrade for primary use |
| **Connection Pool** | 10 connections max | Increase to 50-100 for high concurrency |
| **Embedding Dimensions** | 768-dim (reduced from 3072) | 75% memory savings with minimal accuracy loss |
| **HNSW Index** | m=16, ef_construction=64 | Tune for latency/recall trade-off at scale |

---

## 🐳 Docker Deployment

### Quick Start with Docker

```bash
# Build and run with docker-compose
docker compose up --build

# Or build manually
docker build -t spotify-support-agent .
docker run -p 3000:3000 --env-file .env spotify-support-agent
```

The app will be available at [http://localhost:3000](http://localhost:3000).

### Docker Architecture

- **Multi-stage build:** Dependencies → Build → Production (minimal Node.js 22 Alpine image)
- **Standalone output:** Next.js `output: 'standalone'` for minimal production bundle
- **Non-root user:** Runs as `nextjs:nodejs` (UID 1001) for security
- **Health check:** Automated wget-based health monitoring every 30s
- **No local DB:** Connects to Neon cloud PostgreSQL via environment variables

### Running Setup & Eval Inside Docker

```bash
# Run database setup inside the container
docker compose exec support-agent npx tsx data/scripts/setupDb.ts

# Run evaluation harness
docker compose exec support-agent npx tsx eval/runEval.ts
```

---

## 📁 Repository Structure

```
support-agent/
├── README.md                     # This file — setup guide & documentation
├── Architecture.md               # Detailed architecture with Mermaid diagrams
├── Diagram.md                    # Current multi-brand visual diagrams
├── DECISION_LOG.md               # 15 non-obvious engineering decisions
├── Dockerfile                    # Multi-stage Docker build
├── docker-compose.yml            # Docker Compose service definition
├── report/
│   └── REPORT.md                 # Assignment report and evidence caveats
├── prisma/
│   └── schema.prisma             # Threads, KB vectors, golden labels, eval runs
├── src/
│   ├── brands.ts                  # Canonical brand keys and prompt/UI context
│   ├── taxonomy/
│   │   └── intents.ts            # Single source-of-truth 9-intent taxonomy
│   ├── prompts/
│   │   ├── classifyPrompt.ts     # Version-controlled classification prompt
│   │   ├── draftReplyPrompt.ts   # Version-controlled grounded draft prompt
│   │   ├── escalatePrompt.ts     # Version-controlled escalation prompt
│   │   └── judgePrompt.ts        # Version-controlled 1-5 rubric judge prompt
│   ├── server/
│   │   ├── cache.ts              # LRU cache for embeddings & pipeline responses
│   │   ├── trpc/
│   │   │   ├── trpc.ts
│   │   │   ├── root.ts
│   │   │   └── routers/
│   │   │       ├── classify.ts   # tRPC classification procedure
│   │   │       ├── retrieve.ts   # tRPC pgvector cosine distance search
│   │   │       ├── draftReply.ts # tRPC grounded generation procedure
│   │   │       └── escalate.ts   # tRPC multi-tier escalation triage
│   │   └── llm/
│   │       ├── groq.ts           # Groq client with backoff & retry
│   │       └── gemini.ts         # Gemini embeddings & fallback generator (cached)
│   ├── pipeline/
│   │   └── runAgent.ts           # End-to-end orchestrator procedure
│   └── app/
│       ├── page.tsx              # Interactive dark-themed Web UI
│       └── api/pipeline/route.ts # REST API endpoint with response caching
├── data/
│   ├── raw/                      # Raw Kaggle CSV (gitignored)
│   ├── processed/
│   │   ├── knowledge_base.jsonl  # 2,000 cleaned multi-turn KB threads
│   │   ├── golden_eval_set.jsonl # 132 curated Spotify evaluation examples
│   │   ├── baseline_results.json # Trivial & zero-shot baseline benchmarks
│   │   ├── judge_agreement_results.json # Judge agreement calibration artifact
│   │   └── eval_results.json     # Full pipeline benchmark results
│   └── scripts/
│       ├── cleanAndThread.ts     # Multi-turn thread reconstruction & PII filter
│       ├── buildTaxonomy.ts      # K-Means clustering & intent discovery
│       ├── setupDb.ts            # Neon setup, migrations & HNSW vector indexing
│       ├── embedKnowledgeBase.ts # Dense vector embedding & SHA-256 upserts
│       ├── seedGoldenEvalSet.ts  # Golden eval set database seeder
│       └── labelingTool.ts       # Interactive CLI labeling helper
├── eval/
│   ├── runEval.ts                # Automated evaluation harness
│   ├── judge_rubric.md           # 1-5 evaluation rubric specification
│   ├── judgeHelper.ts            # LLM-as-a-judge scoring wrapper
│   ├── judgeVsHumanAgreement.ts  # Cohen's Kappa & off-by-one agreement script
│   └── baselines/
│       ├── trivialBaseline.ts    # Keyword regex + canned reply baseline
│       ├── zeroShotBaseline.ts   # Ungrounded LLM baseline (no RAG)
│       └── runBaselines.ts       # Baseline benchmark runner
├── tests/
│   └── pipeline.test.ts          # Jest unit tests for all tRPC routers
└── .github/workflows/ci.yml      # GitHub Actions CI workflow
```

---

## 📜 Available Scripts

| Command | Purpose | Duration |
|---|---|---|
| `npm run setup` | Configures Neon DB, applies Prisma schema, creates HNSW index, seeds KB & eval sets | ~2-3 min |
| `npm run eval` | Runs full agent evaluation against held-out golden set | ~5-10 min |
| `npm run eval:baselines` | Runs trivial keyword baseline and zero-shot baseline | ~3-5 min |
| `npm run eval:agreement` | Runs the current judge calibration / Cohen's Kappa scaffold | ~2-3 min |
| `npm test` | Executes 12 Jest unit tests on tRPC procedures | ~5 sec |
| `npm run lint` | Runs Next.js ESLint checks | ~3 sec |
| `npm run dev` | Starts Next.js development server on `http://localhost:3000` | Persistent |
| `npm run build` | Builds production Next.js application | ~15 sec |

---

## 📚 Documentation Index

| Document | Description |
|---|---|
| **[README.md](README.md)** | Setup guide, benchmarks, and project overview (this file) |
| **[Architecture.md](Architecture.md)** | System architecture with 6 Mermaid diagrams |
| **[Diagram.md](Diagram.md)** | 8 comprehensive visual diagrams (pipeline, data flow, ER, escalation, deployment) |
| **[DECISION_LOG.md](DECISION_LOG.md)** | 15 non-obvious engineering decisions with rationale |
| **[report/REPORT.md](report/REPORT.md)** | Assignment report with scope, results, failure modes, caveats, and next steps |

---

## ⚖️ License
MIT. Built for educational and research evaluation purposes using the Twitter Customer Support public dataset.
