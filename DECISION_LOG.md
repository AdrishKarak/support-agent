# Architecture & Engineering Decision Log

This log records the 15 non-obvious engineering decisions made during the design, data pipeline, and evaluation of the Spotify AI Customer Support Agent.

---

1. **Brand Selection: Why SpotifyCares over AmazonHelp or AppleSupport**
   - *Decision:* Selected `SpotifyCares` (43,265 tweets) as the target single-brand domain instead of higher-volume brands like `AmazonHelp` (169k) or `AppleSupport` (106k).
   - *Rationale:* Profiling the raw dataset revealed AmazonHelp had high non-English multi-language mixture (Japanese, German) and heavy deflection to chat/phone links. AppleSupport had an immediate Direct Message deflection rate of 47%. In contrast, SpotifyCares exhibited a **71.1% public substantive troubleshooting rate**, pure English corpus, and modular technical solutions (cache clearing, offline mode, clean reinstallations).

2. **Thread Reconstruction: Graph Traversal of Flat Tweets**
   - *Decision:* Built a two-pass memory indexing and tree-linking algorithm using `tweet_id` and `in_response_to_tweet_id` rather than treating tweets as independent turns.
   - *Rationale:* Twitter support interactions are multi-turn conversations where initial customer queries often omit critical diagnostic info (device/OS version). Reconstructing full parent-child trees allowed us to extract the true resolution reply provided at the end of the thread.

3. **PII Sanitization Strategy**
   - *Decision:* Systematically masked all numeric user IDs (`@\d+`) to `@user`, preserved brand handles as `@support`, masked emails (`[EMAIL]`), phone numbers (`[PHONE]`), and normalized shortened tracking links (`[LINK]`).
   - *Rationale:* Prevents user PII leakage into vector embeddings and ensures the classifier/retrieval engine focuses purely on semantic intent without being biased by repetitive usernames or volatile URL tokens.

4. **Definition of "Resolved" Conversations for the Knowledge Base**
   - *Decision:* A thread was classified as a knowledge base candidate only if: (a) it contained $\ge 2$ turns, (b) the brand reply provided substantive troubleshooting instructions (e.g. restart, cache, settings, reinstall), or (c) the customer explicitly thanked/confirmed resolution. Immediate one-line DM deflections without technical context were excluded from the KB.
   - *Rationale:* Retrieval-grounded generation is only as good as the ground-truth solutions stored. Polluting the knowledge base with "Please DM us your email" leads to generic, unhelpful agent replies.

5. **Empirical Intent Clustering vs. Off-the-Shelf Taxonomies**
   - *Decision:* Sampled 250 real customer inquiries, embedded them with `gemini-embedding-2`, ran K-Means ($k=12$), and iteratively merged near-duplicates to establish a 9-category taxonomy.
   - *Rationale:* General e-commerce taxonomies (e.g. "Shipping Status", "Return Request") fail completely for a digital streaming service. Deriving categories directly from cluster centroids surfaced specific music domain issues like `offline_download`, `playback_issue`, and `content_availability`.

6. **Single Source-of-Truth for Taxonomy (`src/taxonomy/intents.ts`)**
   - *Decision:* Defined the 9 intents, their strict definitions, classification guidelines, and few-shot examples in a single TypeScript file imported by the classifier prompt, labeling tools, and evaluation harness.
   - *Rationale:* Prevents prompt drift and labeling skew. When the classifier prompt and evaluation ground-truth share the exact same definitions, classification evaluation remains consistent.

7. **Database Architecture: Neon PostgreSQL + Native pgvector (No Docker)**
   - *Decision:* Deployed directly to Neon serverless Postgres with native `vector` extension (`v0.8.6`), utilizing an HNSW index on `embedding vector_cosine_ops`.
   - *Rationale:* Neon eliminates local Docker overhead, supports pgvector natively in the cloud, and allows instantaneous reproduction for external evaluators by providing a standard connection string.

8. **Connection Splitting: Pooled `DATABASE_URL` vs. Direct `DIRECT_URL`**
   - *Decision:* Configured Prisma with pooled connection (`DATABASE_URL`) for runtime queries and direct connection (`DIRECT_URL`) for schema pushes (`prisma db push`).
   - *Rationale:* Neon's PgBouncer pooler cannot execute transactional DDL migrations or prepared statements required during schema migrations. Separating the direct host prevents the most common Neon+Prisma migration failure.

9. **Embedding Dimensionality: 768-Dim Dense Vectors**
   - *Decision:* Utilized `gemini-embedding-2` with `outputDimensionality: 768` instead of default 3072.
   - *Rationale:* 768 dimensions preserves high semantic fidelity while reducing Neon pgvector memory footprint by 75% and enabling significantly faster HNSW cosine distance (`<=>`) queries within Postgres.

10. **Idempotent Knowledge Base Ingestion via SHA-256 Content Hashing**
    - *Decision:* Assigned each KB entry a SHA-256 hash of `initial_message + "\n---\n" + resolution_reply` and performed upserts (`ON CONFLICT ("threadId") DO UPDATE`).
    - *Rationale:* Ensures database seeding and re-indexing are completely idempotent. Rerunning setup or re-seeding consumes zero redundant embedding API calls if content has not changed.

11. **Multi-Provider Resilience: Groq Primary with Gemini Fallback**
    - *Decision:* Routed intent classification and structured generation through Groq (`openai/gpt-oss-20b`) for fast inference, with automatic failover to `gemini-3.6-flash` and 429 exponential backoff retries.
    - *Rationale:* Groq free tier enforces an 8,000 TPM limit. Using the lightweight 20B parameter model with a 600-800 token budget prevents token cutoff during chain-of-thought generation, while the Gemini fallback ensures pipeline reliability under burst traffic.

12. **Rule Heuristics Preceding LLM Escalation Judgment**
    - *Decision:* Placed deterministic regex heuristics (legal threats, fraud mentions, compromised accounts, explicit human agent demands) ahead of the LLM escalation prompt.
    - *Rationale:* Critical legal and security events must never depend on model probabilistic variance. If a customer mentions "lawyer" or "hacked", the system triggers an immediate deterministic escalation with a stated factual reason.

13. **Dual Escalation Confidence & Retrieval Sparsity Thresholds**
    - *Decision:* Implemented automatic escalation if either: (a) classifier confidence falls below `0.65`, or (b) top retrieved KB similarity falls below `0.50` (50.0%).
    - *Rationale:* Prevents the agent from hallucinating when confronted with out-of-distribution queries or novel bugs unrepresented in the historical knowledge base.

14. **Version-Controlled Externalized Prompts (`src/prompts/`)**
    - *Decision:* Isolated all system instructions, few-shot prompts, and response JSON schemas into dedicated version-controlled modules (`classifyPrompt.ts`, `draftReplyPrompt.ts`, `escalatePrompt.ts`, `judgePrompt.ts`).
    - *Rationale:* Decouples prompt engineering from backend pipeline orchestration. Allows iterating on wording, tone, and few-shots without touching tRPC routing or database logic.

15. **LLM-as-a-Judge Validation via Cohen's Kappa Agreement**
    - *Decision:* Benchmarked the LLM judge against human audit scores across Groundedness, Correctness, Tone, and Actionability to quantify inter-rater reliability.
    - *Rationale:* Prevents circular self-grading bias. Calculating Cohen's Kappa ($\kappa$) and off-by-one agreement establishes intellectual honesty about the judge's blind spots (e.g. tendency to grade tone more leniently than humans).
