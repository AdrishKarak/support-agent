# Architecture & Engineering Decision Log

This is the plain-language record of the non-obvious decisions behind the multi-brand support platform. It intentionally includes evaluation caveats so the headline numbers are not read as stronger evidence than they are.

1. **Use one canonical brand key**
   - **Decision:** Represent brands as `SpotifyCares`, `AppleSupport`, and `AmazonHelp`, with name, handle, domain, icon, and accent stored in `src/brands.ts`.
   - **Why:** The same key must survive ETL, metadata, SQL filters, prompts, API validation, cache keys, and UI state without repeated string mappings.

2. **Keep brand in both a database column and JSON metadata**
   - **Decision:** `KnowledgeBaseEntry.brand` is stored as a column and repeated in `metadata.brand`.
   - **Why:** The column makes filtering explicit and indexable; JSON metadata keeps exported records self-describing and compatible with older retrieval paths.

3. **Filter before vector ordering**
   - **Decision:** Retrieval applies the selected brand predicate in the same SQL query that orders by pgvector cosine distance.
   - **Why:** A cross-brand nearest neighbor can be semantically close but operationally wrong. Brand isolation is part of correctness, not a post-processing preference.

4. **Process the raw export once per supported brand, then merge artifacts**
   - **Decision:** Thread reconstruction scans the existing TWCS export for each supported author and writes one combined processed dataset.
   - **Why:** It preserves the current graph reconstruction algorithm while making each thread’s ownership unambiguous and keeping the embedding script’s input format stable.

5. **Sanitize support handles as well as user handles**
   - **Decision:** `@SpotifyCares`, `@AppleSupport`, and `@AmazonHelp` normalize to `@support`; numeric and ordinary user handles normalize separately.
   - **Why:** Embeddings should represent the issue, not a repeated account name, while the runtime prompt still receives the real selected handle.

6. **Default to Spotify for backward compatibility**
   - **Decision:** Missing brand inputs resolve to `SpotifyCares`.
   - **Why:** Existing API clients, scripts, and direct function calls continue to work while new clients can opt into another brand explicitly.

7. **Validate brand at every public contract boundary**
   - **Decision:** Zod schemas and the REST route accept only the three canonical keys.
   - **Why:** Silent fallback is useful inside the pipeline, but an API typo should be visible to callers rather than generating a reply from the wrong knowledge base.

8. **Carry brand context into every LLM stage**
   - **Decision:** Classification, drafting, and escalation prompts receive brand name, handle, and domain.
   - **Why:** Retrieval grounding alone does not prevent a generic or wrong-handle reply; the support identity must be explicit in system instructions.

9. **Keep classification and retrieval concurrent**
   - **Decision:** The orchestrator runs intent classification and embedding retrieval in `Promise.all`.
   - **Why:** Neither stage requires the other’s output, so parallel execution reduces user-visible latency without weakening the sequential draft and escalation decisions.

10. **Escalate deterministic safety signals before asking an LLM**
    - **Decision:** Legal, security, and explicit human-demand signals are handled before the nuanced escalation prompt.
    - **Why:** High-risk decisions should not depend on model temperature, provider availability, or a prompt interpretation.

11. **Use a conservative retrieval threshold**
    - **Decision:** Similarity below `0.50` escalates to Tier 1 support.
    - **Why:** The system is allowed to be less autonomous when it lacks a sufficiently similar verified resolution.

12. **Use SHA-256 content hashes for idempotent embedding**
    - **Decision:** Re-indexing skips unchanged thread content and upserts changed content by `threadId`.
    - **Why:** Reproducible setup should not spend embedding quota or create duplicates when the source has not changed.

13. **Compare against both a trivial and a no-RAG baseline**
    - **Decision:** The harness includes a keyword/canned-response baseline and an ungrounded LLM baseline.
    - **Why:** A RAG system needs to show value beyond a majority-class heuristic and beyond a capable model with no retrieval context.

14. **Treat LLM-as-a-judge as calibration evidence, not ground truth**
    - **Decision:** Judge scores are reported with exact agreement, within-one agreement, and Cohen’s kappa.
   - **Why:** Judge scores can be lenient or circular, so agreement statistics are reported alongside exact agreement, within-one agreement, and the rubric details.

15. **Separate measured results from submission requirements**
    - **Decision:** README and report label sample sizes, slices, generated labels, and limitations next to every headline metric.
   - **Why:** Sample sizes, rubric definitions, and provenance need to stay next to headline metrics so the results can be reproduced and interpreted correctly.
