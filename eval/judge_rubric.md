# LLM-as-a-Judge Evaluation Rubric

This document defines the 4-dimension scoring rubric used to evaluate AI Customer Support responses for the selected brand. The current stored evaluation artifact is Spotify-based; future Apple and Amazon evaluations should apply the same dimensions with brand-specific references.

---

## 1. Groundedness (Score: 1 - 5)

Evaluates whether the drafted response accurately reflects facts, troubleshooting procedures, and policy details present in the **retrieved knowledge base threads**.

| Score | Description | Criteria |
|---|---|---|
| **5 (Fully Grounded)** | Complete Fidelity | Every troubleshooting step or policy claim is directly supported by the retrieved context. No hallucinations or extraneous claims. |
| **4 (Strongly Grounded)** | High Fidelity | Core guidance is grounded; minor generic phrasing added (e.g. polite sign-off) that does not distort technical facts. |
| **3 (Partially Grounded)** | Mixed Grounding | Advice generally resembles the retrieved topics, but introduces unverified assumptions or omits key prerequisites. |
| **2 (Weakly Grounded)** | Low Fidelity | Relies primarily on generic assumptions with minimal discernible connection to the retrieved resolutions. |
| **1 (Ungrounded / Hallucinatory)** | Fabricated | Contradicts the retrieved knowledge base facts or hallucinates fake features, policies, or non-existent URLs. |

---

## 2. Technical Correctness (Score: 1 - 5)

Evaluates whether the advice given is technically accurate for the selected brand's products, device operating systems, delivery/account systems, and policies.

| Score | Description | Criteria |
|---|---|---|
| **5 (Accurate)** | Technically Precise | Specific to Spotify's client UI (e.g. exact menu hierarchies: *Settings > Storage > Delete Cache*, correct app restart steps, valid Free vs Premium differences). |
| **4 (Mostly Accurate)** | Minor Ambiguity | Technical advice is sound and safe, though slightly generic (e.g. "reinstall the app" without specifying clean cache cleanup). |
| **3 (Plausible but Imprecise)** | General Tech Advice | Advice is generic smartphone troubleshooting (e.g. "restart your phone") without addressing Spotify-specific behavior. |
| **2 (Flawed Guidance)** | Misleading | Suggests inappropriate steps (e.g. instructing Free users to use offline downloads, or directing users to defunct settings). |
| **1 (Dangerous / Incorrect)** | Broken | Recommends actions that could corrupt local app state, wipe unauthorized data, or directly misleads the user on account billing. |

---

## 3. Tone & Empathy (Score: 1 - 5)

Evaluates whether the response aligns with the selected brand's support voice: friendly, conversational, calm, empathetic, and de-escalating.

| Score | Description | Criteria |
|---|---|---|
| **5 (Exemplary)** | Warm & On-Brand | Friendly greeting, validates user frustration without being defensive, concise, signed with friendly sign-off (e.g., /KB or friendly emoji). |
| **4 (Good)** | Professional | Courteous and helpful, slightly formal but polite and constructive. |
| **3 (Neutral)** | Robotic | Matter-of-fact, lacking warmth, reads like a dry documentation excerpt. |
| **2 (Cold / Blunt)** | Impatient | Terse or dismissive of user concern, lacks empathy for customer frustration. |
| **1 (Hostile / Unacceptable)** | Inappropriate | Defensive, rude, confrontational, or totally dismissive. |

---

## 4. Actionability (Score: 1 - 5)

Evaluates whether the response gives the user an immediate, concrete next step to make progress on their issue.

| Score | Description | Criteria |
|---|---|---|
| **5 (Highly Actionable)** | Clear Next Steps | Tells the customer exactly what buttons to press, or specifically what diagnostic details to send via Direct Message (e.g. "DM us your device model and OS version"). |
| **4 (Actionable)** | Sound Next Step | Clear general action required, though customer might need a follow-up clarification. |
| **3 (Vaguely Actionable)** | Low Guidance | Tells the customer what the problem might be without instructing them how to resolve it. |
| **2 (Ineffective)** | Dead End | Asks open-ended questions without guidance on how or where to reply. |
| **1 (Non-Actionable)** | Stranded | Leaves the customer completely stranded with no path forward. |
