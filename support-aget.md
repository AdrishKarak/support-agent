# AI Customer Support Agent — Project Brief & Agent Prompt

Owner: Adrish Karak
Stack alignment: Next.js, TypeScript, tRPC, Prisma, Neon (PostgreSQL/pgvector), Gemini, Groq (same as Apex/Sonic/Ping-up projects)

---

## 1. What to Download / Set Up First

### Datasets
1. **Primary dataset (required):** Kaggle — `thoughtvector/customer-support-on-twitter`
   - Download via Kaggle CLI: `kaggle datasets download -d thoughtvector/customer-support-on-twitter`
   - ~3M tweets, multi-turn threads, dozens of brands. You'll filter down to ONE brand.
2. **Optional secondary (intent-labeling reference only):** Hugging Face — `PolyAI/banking77`
   - `pip install datasets` then `load_dataset("PolyAI/banking77")` — use only as a reference for how a clean intent taxonomy looks; don't mix domains.

### Accounts / API Keys
- **Google AI Studio** → Gemini API key (embeddings + generation)
- **Groq Console** → Groq API key (fast inference/streaming)
- Optional: OpenAI key as a third baseline/judge cross-check

### Database — Neon (Postgres + pgvector)
- Create a Neon project at neon.tech, then in the Neon SQL editor run:
  `CREATE EXTENSION IF NOT EXISTS vector;`
  (Neon supports pgvector natively — no Docker or local Postgres install needed)
- Copy your Neon connection string (from the Neon dashboard, "Connection Details") — you'll
  paste this into `.env` as `DATABASE_URL`. Use the **pooled** connection string for the app
  and, if Prisma migrations complain about the pooler, the **direct** connection string for
  `prisma migrate`/`prisma db push` (Neon gives you both).

### Local Tooling
- Node.js 20+, pnpm or npm
- `tsx` (run TypeScript scripts directly with `npx tsx script.ts`, no separate build step needed) — this is what you'll use for data cleaning, labeling helpers, and the eval harness
- `psql` client or a GUI (TablePlus/DBeaver, or Neon's own SQL editor in the browser) to inspect the DB — no local Postgres server required since Neon is hosted

---

## 2. Files to Hand to Your Coding Agent

Give the agent, in this order:
1. This brief (`AI_Support_Agent_Project_Brief.md`)
2. Your Neon connection string(s) (pooled + direct) — to be placed in `.env`, never committed or pasted into chat history you don't control
3. The raw Kaggle CSV (`twcs.csv`) once downloaded — or just tell it the path and schema
4. Your resume (for tone/skill continuity — optional but helps it match your existing code style if you show it Apex's repo structure)
5. If you have it, a link/export of your **Apex** repo structure, since your RAG pattern there is directly reusable

---

## 3. Architecture Overview

```
                         ┌─────────────────────────┐
                         │   Raw Twitter CS Data    │
                         │   (Kaggle CSV, ~3M rows) │
                         └────────────┬─────────────┘
                                      │ filter: single brand
                                      ▼
                         ┌─────────────────────────┐
                         │  Data Cleaning Pipeline  │
                         │  (TypeScript: papaparse) │
                         │  - reconstruct threads   │
                         │  - customer→brand pairs  │
                         │  - dedupe, strip PII     │
                         └────────────┬─────────────┘
                                      ▼
                 ┌────────────────────┴────────────────────┐
                 ▼                                          ▼
   ┌───────────────────────┐               ┌───────────────────────────┐
   │ Intent Taxonomy Design │               │ Resolution Knowledge Base │
   │ (you define 8-12       │               │ (past resolved threads →  │
   │  categories from data) │               │  embedded w/ pgvector)    │
   └───────────┬────────────┘               └─────────────┬─────────────┘
               ▼                                           ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                     Agent Pipeline (tRPC service)                │
   │  1. Classify intent (Groq, structured output, few-shot)          │
   │  2. Retrieve top-k similar resolved threads (pgvector similarity)│
   │  3. Draft reply grounded in retrieved context (Gemini/Groq)      │
   │  4. Escalation decision (confidence + heuristics + LLM judgment) │
   └───────────────────────────┬────────────────────────────────────┘
                                ▼
                 ┌─────────────────────────────┐
                 │   Output: JSON per message    │
                 │  { intent, reply, escalate,   │
                 │    escalation_reason,         │
                 │    confidence }               │
                 └─────────────────────────────┘

   Parallel track — Evaluation:
   ┌────────────────────────────────────────────────────────────────┐
   │  Golden Set (150-250 hand-labeled)  →  Eval Harness             │
   │  - Automated metrics (intent accuracy, escalation P/R)          │
   │  - LLM-as-judge rubric (reply quality)                          │
   │  - Human-vs-judge agreement study (kappa or % agreement)        │
   │  - Baseline comparisons (trivial rule-based, naive zero-shot)   │
   └────────────────────────────────────────────────────────────────┘
```

---

## 4. Tech Stack (mapped to what you already know)

| Layer | Technology | Why |
|---|---|---|
| API/backend | Next.js 15 (API routes) + tRPC | You already built this pattern in Sonic/Apex |
| ORM/DB access | Prisma | Matches your existing projects |
| Database | Neon (serverless Postgres) + pgvector | Hosted, zero local DB setup, pgvector supported natively |
| Embeddings | Gemini embedding model | Same as Apex |
| LLM inference | Groq (fast, streaming) + Gemini (fallback/grounding) | Same as Apex |
| Data cleaning/eval | TypeScript (`tsx`, `papaparse`, `simple-statistics`) | Same language as the rest of the repo — no context-switching, one toolchain |
| Testing | Jest (unit tests + eval scripts) | Matches your resume's testing tools, one framework for everything |
| CI | GitHub Actions | You already have CI/CD experience from Emdee |

---

## 5. Workflow / Phases (suggested order)

**Phase 0 — Setup (Day 1)**
- Create the Neon project, enable the `vector` extension, get pooled + direct connection strings
- Initialize the repo: Next.js + TypeScript + tRPC + Prisma, point `DATABASE_URL` at Neon, run first `prisma db push`
- Download and inspect raw dataset, pick ONE brand with enough volume and clean multi-turn threads (check for at least 500-1000 usable resolved conversations)

**Phase 1 — Data Pipeline (Day 1-2)**
- Reconstruct customer↔brand conversation threads from the flat CSV (it uses `tweet_id`, `in_response_to_tweet_id` — you'll need to chain these)
- Strip PII (usernames, order numbers, etc. — note this decision in your decision log)
- Split into: knowledge base (for retrieval) vs. golden eval set (held out, never used for grounding)

**Phase 2 — Intent Taxonomy (Day 2)**
- The agent does this semi-automatically, you just review and approve — see the detailed
  sub-steps below (2a-2e). You don't need to design the taxonomy by hand from scratch.
- 2a. Agent samples 200-300 real customer messages (not brand replies) for your chosen brand
- 2b. Agent embeds the sample (Gemini embeddings) and runs a clustering algorithm
  (k-means or HDBSCAN) to produce ~10-15 rough groups
- 2c. Agent pulls 5-10 example messages from each cluster and writes a one-line label
  guess for each cluster, so you can see what it thinks each group is about
- 2d. Agent proposes a merged/cleaned final list of 8-12 categories (merging near-duplicate
  clusters, splitting overly broad ones), each with a one-line definition and 2-3 example
  messages
- 2e. You review the proposed taxonomy and approve it or ask for adjustments — this is the
  one manual decision point in this phase, and it's just a quick review, not building it
  from scratch
- Document the final taxonomy + how it was derived — this is a decision-log item

**Phase 2.5 — Taxonomy artifact (still Day 2)**
- Agent writes the approved taxonomy to a single source-of-truth file (e.g.
  `src/taxonomy/intents.ts`), with each intent's name, definition, and few-shot examples
- This same file is used for: (a) the classifier's few-shot prompt, and (b) the labeling
  guide for the golden eval set — so the taxonomy is defined once and reused everywhere,
  never redefined inconsistently in different places

**Phase 3 — Retrieval + Generation Pipeline (Day 3-4)**
- Embed knowledge-base threads with Gemini, store in pgvector
- Build classify → retrieve → draft → escalate pipeline as a tRPC procedure
- Add incremental/idempotent design where relevant (like your Apex sync logic)

**Phase 4 — Golden Eval Set (Day 4-5, do this EARLY and in parallel if possible)**
- Hand-label 150-250 examples yourself: intent, ideal escalate/no-escalate decision + reason, and a reference reply or reply-quality notes
- Document your sampling method (e.g., stratified across intents, including edge cases and ambiguous messages) — don't just take the first 200 rows

**Phase 5 — Eval Harness (Day 5-6)**
- Automated metrics: intent classification accuracy/F1, escalation precision/recall
- LLM-as-judge: a rubric prompt (e.g., rate reply on groundedness, tone, correctness, actionability 1-5)
- **Critical:** validate the judge — have you (human) score a subset of the same replies, then compute agreement (Cohen's kappa or simple %) between your judge and yourself. Report this honestly, including where they disagree.
- Two baselines: (1) trivial — keyword/rule-based intent match + canned reply; (2) simple — zero-shot LLM classify+reply with NO retrieval grounding. Your full pipeline must beat both, and you must show the numbers.

**Phase 6 — Report + Decision Log (Day 6-7)**
- Write the 6-page report covering all required sections (see below)
- Be brutally honest in "what's misleading about my headline number" — this is explicitly graded on intellectual honesty, not on how good your number looks

**Phase 7 — Polish for Submission**
- README that lets a stranger reproduce your headline result in under 15 minutes: clone repo,
  `npm install`, paste their own Neon `DATABASE_URL` + API keys into `.env`, run one seed/setup
  script, run one eval command
- A single setup script (e.g. `npm run setup`) that runs `prisma db push`, seeds the knowledge
  base embeddings, and confirms the DB is ready — this replaces the old "spin up Docker" step

---

## 6. Repo File Structure

```
support-agent/
├── README.md                     # must enable <15 min reproduction
├── .env.example                  # DATABASE_URL (Neon), GEMINI_API_KEY, GROQ_API_KEY, etc.
├── prisma/
│   └── schema.prisma             # threads, embeddings, labels, eval_results
├── src/
│   ├── server/
│   │   ├── trpc/
│   │   │   └── routers/
│   │   │       ├── classify.ts
│   │   │       ├── retrieve.ts
│   │   │       ├── draftReply.ts
│   │   │       └── escalate.ts
│   │   └── llm/
│   │       ├── gemini.ts
│   │       └── groq.ts
│   └── pipeline/
│       └── runAgent.ts           # orchestrates classify→retrieve→draft→escalate
├── data/
│   ├── raw/                      # gitignored, raw Kaggle CSV
│   ├── processed/
│   │   ├── knowledge_base.jsonl
│   │   └── golden_eval_set.jsonl # 150-250 hand-labeled examples
│   └── scripts/
│       ├── cleanAndThread.ts
│       ├── buildTaxonomy.ts
│       └── embedKnowledgeBase.ts
├── eval/
│   ├── runEval.ts                # automated metrics + judge orchestration
│   ├── judge_rubric.md
│   ├── judgeVsHumanAgreement.ts
│   └── baselines/
│       ├── trivialBaseline.ts
│       └── zeroShotBaseline.ts
├── report/
│   └── REPORT.md                 # or PDF, max 6 pages
├── DECISION_LOG.md
└── .github/workflows/ci.yml
```

---

## 7. THE MASTER PROMPT — Paste This to Your Coding Agent

```
You are my senior full-stack + ML engineering pair. We are building a production-grade
AI customer support agent for ONE brand, sourced from the "Customer Support on Twitter"
Kaggle dataset (thoughtvector/customer-support-on-twitter). This is for a graded take-home
assignment, so correctness, honesty about limitations, and reproducibility matter more
than flashy features.

## Tech stack (use exactly this — I know these tools well)
- Next.js 15 (App Router) + TypeScript
- tRPC for typed API procedures
- Prisma ORM, connected to **Neon** (serverless Postgres) — I will give you the Neon
  connection string(s); put them in `.env` as `DATABASE_URL` (pooled, for the app) and
  `DIRECT_URL` (direct, for Prisma migrations, since Neon recommends this split when
  using its connection pooler)
- pgvector extension enabled on the Neon database (I will run `CREATE EXTENSION vector;`
  in the Neon SQL editor, or you can give me the exact command to run there) for similarity
  search — there is no local Postgres and no Docker involved anywhere in this project
- Gemini API for embeddings and/or generation
- Groq API for fast/streaming LLM inference
- TypeScript throughout, including offline data cleaning, labeling helpers, and the
  evaluation harness — run standalone scripts with `tsx`, no separate language/runtime
- Jest for unit tests and for the evaluation harness's automated checks
- GitHub Actions for CI

## Setup responsibility
You are responsible for installing and configuring everything the project needs — do not
ask me to pre-install packages or frameworks. Specifically:
- Scaffold the Next.js + TypeScript project yourself (`create-next-app` or equivalent)
  and add tRPC, Prisma, and any other core dependencies via npm/pnpm as you go
- Install and configure testing frameworks (Jest, `ts-jest` or equivalent), linting
  (ESLint), and any utility libraries you need (`papaparse` or `csv-parse` for CSV
  parsing, `simple-statistics` or similar for eval metrics, `tsx` for running scripts)
  as part of the setup — add them to `package.json` yourself, don't just tell me to
  add them
- After you add a new dependency, briefly tell me what you added and why, so I can
  learn the stack, but don't stop and wait for me to install it manually — just run
  the install command
- The only things I will hand you manually are: the Neon connection string(s), the
  Gemini/Groq API keys, and the raw Kaggle dataset file — everything else (packages,
  config files, boilerplate) is your job to set up end-to-end

## What the system must do
1. CLASSIFY every incoming customer message into an intent taxonomy of 8-12 categories
   that YOU (the agent) will help me derive empirically from a sample of the real data —
   do not use a generic off-the-shelf taxonomy without grounding it in what's actually
   in this brand's data.
2. DRAFT a reply that is grounded via retrieval: embed and index this brand's historically
   resolved conversation threads in pgvector, retrieve the top-k most similar past
   resolutions for a new incoming message, and use them as context for the LLM to draft
   a reply. The reply must not be pure zero-shot generation — retrieval grounding is
   mandatory and must be demonstrably contributing (I will compare against a no-retrieval
   baseline).
3. DECIDE whether to auto-handle or escalate to a human, and always output a stated,
   specific reason (not a generic "low confidence" reason — reference the actual signal,
   e.g. "message mentions legal action", "classifier confidence 0.42 below 0.7 threshold",
   "no similar resolved case found in knowledge base").

## Required deliverables (this is graded, treat all of these as hard requirements)
1. A repo with a runnable pipeline. The README must let a stranger reproduce my headline
   result in under 15 minutes with just: clone repo, `npm install`, paste their own Neon
   `DATABASE_URL`/`DIRECT_URL` and API keys into `.env`, run one setup script (schema push +
   seed), run one eval command — no Docker, no manual DB installation, no undocumented steps.
2. A golden evaluation set of 150-250 hand-labeled examples that I build myself (you can
   help me build tooling to label faster, but the labels must reflect my own judgment,
   not be auto-generated). Include a note on sampling strategy (e.g., stratified across
   intents, deliberately including ambiguous/edge-case messages, not just the first N rows).
3. An evaluation harness with:
   - Automated metrics (intent classification accuracy/F1, escalation precision/recall,
     retrieval hit-rate)
   - An LLM-as-judge rubric for reply quality (groundedness, correctness, tone,
     actionability — score 1-5 each)
   - Evidence of how well the LLM judge agrees with my own human judgment on a subset
     (compute Cohen's kappa or simple percent agreement, and report it honestly even if
     it's mediocre)
4. A report (max 6 pages, can be a README section) covering:
   - Problem framing: what "good" means for this specific brand, and what I explicitly
     chose NOT to build (scope cuts)
   - Results vs. at least two baselines: (a) a trivial baseline (keyword/rule-based
     intent match with canned replies), and (b) a simple baseline (zero-shot LLM
     classify+reply with no retrieval grounding)
   - Failure analysis: top 5 failure modes with real examples from the golden set and
     my hypotheses for why they happen
   - A mandatory, honest section titled "What is misleading about my headline number?" —
     I want you to help me think critically here, not just hit a number and declare victory
   - What I would do next with one more week
5. A decision log: a plain bullet list of 10-15 non-obvious decisions made and why
   (e.g., PII handling, taxonomy boundaries, retrieval k value, escalation threshold,
   how threads were reconstructed from flat tweet data, what counts as a "resolved"
   conversation for the knowledge base).

## Workflow — do these in order, and check in with me at each phase boundary
1. Help me write a TypeScript script (run via `tsx`, using `papaparse` or `csv-parse`)
   to parse the raw Kaggle CSV, reconstruct multi-turn
   threads (using tweet_id / in_response_to_tweet_id / in_response_to_user_id fields),
   and filter to ONE brand with sufficient volume of clean resolved conversations.
   Flag PII handling decisions for my decision log.
2. Derive the intent taxonomy for me — I don't have a background in this, so do the
   heavy lifting and just bring me a clean proposal to approve, following these exact
   sub-steps:
   a. Sample 200-300 real customer-to-brand messages (not brand replies) for the chosen brand.
   b. Embed the sample with Gemini embeddings and run a clustering algorithm (k-means or
      HDBSCAN — pick a sensible default, e.g. k=10-15 for k-means) to produce rough groups.
   c. Pull 5-10 representative example messages from each cluster and write a plain-language
      guess at what each cluster is about.
   d. Merge near-duplicate clusters and split overly broad ones to land on a final 8-12
      category taxonomy. For each category, write: a short name, a one-sentence definition,
      and 2-3 real example messages from the data.
   e. Show me this final proposed taxonomy in a clear, readable format and ask me to approve
      it or request specific changes — this is the only step where you need my input, and
      it should just be a quick yes/no/tweak, not something I need to design myself.
   f. Once approved, write the taxonomy to a single source-of-truth file (e.g.
      `src/taxonomy/intents.ts`) with name, definition, and few-shot examples per intent.
      Reuse this same file for both the classifier's prompt and the golden-eval labeling
      guide — never redefine the taxonomy in two places.
3. Set up the Prisma schema against my Neon database (I'll give you the connection
   string) for: raw threads, embedded knowledge-base entries, golden eval labels, and
   eval run results. Confirm the `vector` extension is enabled before writing pgvector
   columns/queries.
4. Build the embedding + indexing pipeline for resolved threads (knowledge base) using
   Gemini embeddings, following an idempotent/incremental pattern (skip already-embedded
   items, use content hashing to detect changes) — similar to file-change-detection
   patterns I've used before, so ask me before assuming defaults if unsure.
5. Build the tRPC pipeline: classify → retrieve (pgvector top-k) → draft reply → escalate
   decision. Use structured/JSON output from the LLM at each step, not free text parsing.
6. Build tooling to help me hand-label the golden eval set efficiently (e.g., a simple
   CLI or minimal local UI showing message + suggested label options), but the final
   labels are mine.
7. Build the two baselines (trivial rule-based, zero-shot no-retrieval) as standalone
   scripts I can run and compare against the full pipeline.
8. Build the eval harness: automated metrics script, LLM-judge rubric + scoring script,
   and the judge-vs-human agreement analysis.
9. Help me draft the report and decision log — ask me clarifying questions about my
   reasoning rather than inventing justifications for me.
10. Final polish: one-command setup script against Neon, README, CI workflow that
    at minimum lints/type-checks/runs unit tests.

## Engineering standards
- Type-safe end to end (TypeScript strict mode, tRPC for API contracts)
- Structured JSON outputs from every LLM call (use response schemas, not regex parsing
  of free text)
- Idempotent, incremental indexing (don't re-embed unchanged content)
- Rate-aware handling of Groq/Gemini calls (backoff, don't hammer APIs)
- Every LLM prompt used in the pipeline should be a separate, version-controlled file
  or constant, not inlined ad hoc, so I can iterate on prompts without touching pipeline
  logic
- Write unit tests for the classify/retrieve/draft/escalate procedures with mocked
  LLM responses
- Do not fabricate evaluation numbers or gloss over weak results — if the judge/human
  agreement is low, or a baseline is surprisingly close to the full pipeline, say so
  clearly in the report; that honesty is explicitly part of the grade

## What NOT to do
- Don't use a generic pre-made intent taxonomy without grounding it in the actual data.
  Don't skip the clustering/sampling steps and jump straight to guessing categories from
  general knowledge of what customer support usually looks like — the categories must
  trace back to real messages you actually looked at from this brand.
- Don't skip the no-retrieval baseline — it's the only way to prove retrieval grounding
  actually helps
- Don't auto-generate the golden eval labels with an LLM and call them "hand-labeled"
- Don't hide or soften bad results in the report — a mediocre judge-human agreement
  score reported honestly is worth more than a suspiciously perfect one
- Don't over-engineer beyond the assignment scope — if something isn't needed for the
  deliverables, don't build it just because it's technically interesting

Confirm you understand this scope, then start with Phase 1 (data parsing script) and
show me a sample of the reconstructed threads before moving on.
```

---

## 8. A Few Things Worth Adding Beyond What Was Asked

- **Time-box the labeling.** 150-250 examples by hand is the single biggest time sink — don't let the pipeline engineering eat the days you need for this.
- **Pick your brand early based on data quality, not brand recognition.** Some brands in this dataset have much cleaner resolved-thread structure than others. Spend 30-60 minutes profiling 3-4 candidate brands before committing.
- **Keep every LLM prompt in version control as its own file.** You'll iterate on these constantly during eval; treating them as first-class artifacts (like your Apex prompt-engineering work) will save you time and looks good in the decision log.
- **Write the "misleading headline number" section first, in draft form, before you even have final numbers.** Thinking about what could make your number look better than it is *before* you compute it helps you design a fairer eval instead of rationalizing after the fact.
- **Watch Neon's connection pooling with Prisma.** Use the pooled connection string (`DATABASE_URL`) for normal app queries and the direct connection string (`DIRECT_URL`) for `prisma migrate`/`db push` — mixing these up is the most common Neon+Prisma setup error. Also note Neon's free-tier compute can auto-suspend after inactivity; the first query after idle time may be slower, so don't be alarmed if your eval script's first call has extra latency.
- **Never commit the Neon connection string.** Keep it in `.env` (gitignored) with `.env.example` showing the shape (`DATABASE_URL="postgresql://..."`) without real credentials, since this repo may end up public for submission.