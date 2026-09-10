# Golden Evaluation Set Curation & Manual Annotation Note

**Author / Human Annotator:** Adrish Karak  
**Dataset:** 165 Stratified Twitter Support Cases (`@SpotifyCares`)  
**Date:** September 2026  

---

## 1. Overview & Sampling Strategy

To rigorously benchmark the Spotify AI Support Agent against real-world customer service interactions, I manually curated and annotated a golden dataset of **165 distinct customer support threads** sampled from 29,426 public Twitter interactions (`@SpotifyCares`).

### Sampling Methodology:
1. **Source Population:** Filtered the 2.8M Twitter Customer Support dataset for resolved interaction pairs where `@SpotifyCares` provided a verified resolution.
2. **Stratified Sampling:** To avoid class imbalance (where billing and complaint queries dominate raw logs), I stratified sampling across all 9 canonical operational intents in our taxonomy:
   - `playback_issue` (22 threads)
   - `subscription_billing` (22 threads)
   - `account_access` (20 threads)
   - `offline_download` (18 threads)
   - `app_bug_crash` (18 threads)
   - `human_escalation_required` (17 threads)
   - `content_availability` (16 threads)
   - `feature_request` (16 threads)
   - `feedback_complaint` (16 threads)
3. **Round-Robin Interleaving:** The 165 records were saved in a strict round-robin order across the 9 intent buckets. This guarantees that any prefix slice (e.g., evaluating the first 25, 50, or 100 items) maintains exact intent stratification.

---

## 2. Human Annotation & Ground Truth Protocol

I reviewed each customer tweet and verified Spotify response pair, manually assigning three ground truth fields:

1. **`groundTruthIntent`**: Assigned the single primary operational intent matching our 9-intent taxonomy based on the root issue described by the customer.
2. **`groundTruthEscalate` (Boolean)**: Applied deterministic safety policy rules:
   - **`true` (Escalate to Human):** Assigned if the customer message contains legal/regulatory threats ("lawyer", "suing", "FTC"), financial fraud/refund disputes, account security breaches ("hacked", "stolen account", "changed email"), or explicit demands for a human representative.
   - **`false` (Auto-Handle via RAG):** Assigned if standard self-service troubleshooting procedures exist in Spotify's public knowledge base (e.g. cache clearing, password resets, playback restarts).
3. **`escalationReason` & `notes`**: Documented explicit rationale explaining why the case requires escalation or can be auto-handled.

---

## 3. Human Quality Control & Annotation Decision Matrix

| Scenario / Trigger | Ground Truth Intent | Ground Truth Escalate | Primary Rationale & Target Team |
|---|---|---|---|
| *"My account was hacked and email changed"* | `human_escalation_required` | `true` | Security alert: account compromise &rarr; `security_fraud` |
| *"My lawyer is filing an FTC complaint"* | `human_escalation_required` | `true` | Legal threat &rarr; `legal` |
| *"I was double charged for Family plan"* | `subscription_billing` | `true` | Billing dispute &rarr; `tier_1_support` |
| *"How do I reset my password?"* | `account_access` | `false` | Standard recovery procedure &rarr; Auto-handled |
| *"Shuffle button is frozen on iOS"* | `app_bug_crash` / `playback_issue` | `false` | App cache clear / reinstall procedure &rarr; Auto-handled |
| *"Why is album X greyed out?"* | `content_availability` | `false` | Music catalog licensing explanation &rarr; Auto-handled |

---

## 4. Key Takeaways & Dataset Statistics

- **Total Labeled Items:** 165 records
- **Escalation Ratio:** 19 escalated items (11.5% of dataset), representing legal, security, and financial dispute risks.
- **Auto-Handled Ratio:** 146 items (88.5% of dataset), benchmarking grounded draft generation and vector retrieval hit rate.
- **Storage:** Persisted in [`data/processed/golden_eval_set.jsonl`](file:///home/adrish/Desktop/support-agent/data/processed/golden_eval_set.jsonl) and seeded into Neon PostgreSQL `golden_eval_labels` table.
