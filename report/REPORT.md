# Multi-Brand AI Customer Support Platform: Assignment Report

## 1. Problem Framing

The system drafts public support replies for short, ambiguous customer messages. “Good” means: the selected brand’s support identity is respected; the reply is grounded in a verified same-brand historical resolution; sensitive account, legal, and security cases are escalated; and the response gives a concise next action without exposing PII.

The runtime supports `SpotifyCares`, `AppleSupport`, and `AmazonHelp`. Spotify remains the default because the current evaluation artifact and taxonomy are Spotify-derived. The Apple and Amazon paths are architectural support and require brand-specific data coverage before their quality can be claimed.

### What is intentionally not built

- No billing refunds, password resets, account mutations, or other write actions.
- No ingestion or storage of private direct messages.
- No voice or audio support.
- No claim that a Spotify-derived taxonomy is optimal for Apple or Amazon.
- Evaluation labels and quality scores are kept with their sampling and scoring workflows for inspection and reproduction.

## 2. System Design

`cleanAndThread.ts` reconstructs conversations and assigns a brand key. `embedKnowledgeBase.ts` stores the key in both `brand` and `metadata.brand`. Runtime retrieval filters by that key before cosine ordering. The pipeline then passes brand name, handle, and domain into classification, grounded drafting, and escalation prompts. The UI sends the selected brand to `POST /api/pipeline` and changes its scenario text and result labels accordingly.

## 3. Current Measured Artifacts

The repository currently contains these reproducible artifacts:

| Artifact | Current value | Provenance |
|---|---:|---|
| Golden records | 132 | `data/processed/golden_eval_set.jsonl` |
| Full-agent evaluation slice | 10 | `data/processed/eval_results.json` |
| Baseline comparison slice | 40 | `data/processed/baseline_results.json` |
| Judge calibration sample | 15 | `data/processed/judge_agreement_results.json` |
| Supported runtime brands | 3 | `src/brands.ts` |

The measured 40-record baseline artifact reports the trivial keyword baseline at 87.5% intent accuracy, 0.4534 macro F1, and 1.93/5 judge score; the no-RAG baseline reports 47.5% accuracy, 0.1912 macro F1, and 2.50/5. The stored 10-record full-agent artifact reports 60.0% accuracy, 0.5000 macro F1, 100% retrieval hit rate at the configured threshold, and 4.70/5 judge score.

These slices are not directly comparable in sample size, and the judge scores are not a substitute for human quality labels. They are engineering smoke-test evidence, not a final statistically powered benchmark.

## 4. Baselines

1. **Trivial baseline:** keyword intent routing with canned replies and fixed confidence.
2. **Simple no-RAG baseline:** LLM classification plus ungrounded LLM reply generation, with no retrieved support context.

The RAG pipeline’s intended advantage is groundedness and brand correctness, especially on settings, account, billing, and escalation cases. A keyword baseline can win raw accuracy on a class-imbalanced slice while producing poor replies, so macro F1 and reply-quality review are required.

## 5. Failure Analysis

The stored evaluation traces show five recurring risks:

1. **Coarse or noisy labels:** missing-content and feature-request messages can be labelled as playback issues, so a semantically sensible prediction is counted as wrong.
2. **Multi-intent messages:** a synchronization or account message may contain both a technical symptom and a request for a product capability.
3. **Language and device variation:** non-English text and third-party hardware vocabulary can shift intent classification toward a nearby category.
4. **Provider rate limits:** Groq retries and Gemini fallback preserve availability but create large latency spikes.
5. **Retrieval coverage gaps:** historical resolutions do not cover future app versions, new policies, or new brands unless their KB is separately ingested.

Each hypothesis is testable: improve label adjudication, add multi-label or conversation context, add multilingual/device examples, provision model capacity, and measure per-brand/per-time-slice retrieval recall.

## 6. What Is Misleading About My Headline Number?

- **87.5% trivial accuracy** is from a 40-record slice dominated by two intents; its macro F1 is only 0.4534 and its judge score is 1.93/5.
- **60.0% full-agent accuracy** is from a 10-record stored run, too small for a strong generalization claim.
- **100% retrieval hit rate** reflects a curated historical KB and a low threshold; it does not prove coverage of novel issues.
- **4.70/5 judge score** comes from an LLM judge and can be lenient, especially when a reply is polite or mirrors the reference.
- **Agreement statistics need context:** Cohen’s kappa is reported with exact and within-one agreement, sample size, and the scoring workflow so readers can interpret the calibration result rather than relying on one number.
- **Multi-brand support is implemented as an architecture and data contract, not demonstrated quality parity:** the current golden set is Spotify-only.

## 7. One More Week

1. Expand the evaluation set to 150–250 examples with adjudication notes, brand metadata, and a fixed train/eval split.
2. Add blind audits of generated replies and retain the rubric-level score traces.
3. Rebuild the taxonomy per brand or add a shared taxonomy with brand-specific intents.
4. Add hybrid BM25 plus dense retrieval for exact error codes and policy terms.
5. Add a human approval dashboard and track edit rate, escalation precision, and per-brand drift.

## 8. Reproduction

```bash
npm install
cp .env.example .env
npm run setup
npx tsc --noEmit
npx jest --runInBand
npm run eval:baselines
npm run eval:agreement
npm run eval
```

The database-backed commands require `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, and `GROQ_API_KEY`. The under-15-minute reviewer path uses the checked-in processed artifacts; raw CSV reconstruction and full embedding ingestion are intentionally separate because they are larger and API-quota dependent.
