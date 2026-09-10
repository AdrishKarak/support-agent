import { z } from 'zod';
import { publicProcedure } from '../trpc';
import { ESCALATE_SYSTEM_PROMPT, buildEscalateUserPrompt } from '@/prompts/escalatePrompt';
import { generateGroqJson } from '@/server/llm/groq';
import { generateGeminiJson } from '@/server/llm/gemini';

export const EscalateInputSchema = z.object({
  customerMessage: z.string().min(1),
  intent: z.string(),
  intentConfidence: z.number(),
  topSimilarity: z.number().default(0),
  draftReply: z.string().default(''),
});

export const EscalateOutputSchema = z.object({
  escalate: z.boolean(),
  escalationReason: z.string(),
  priority: z.string(),
  targetTeam: z.string(),
});

export type EscalateResult = z.infer<typeof EscalateOutputSchema>;

interface LlmEscalateResponse {
  escalate: boolean;
  escalation_reason: string;
  priority: string;
  target_team: string;
}

export async function decideEscalationCore(
  customerMessage: string,
  intent: string,
  intentConfidence: number,
  topSimilarity: number,
  draftReply: string
): Promise<EscalateResult> {
  const lowerMsg = customerMessage.toLowerCase();

  // 1. Fast deterministic heuristic: Legal / Regulatory Threat
  const legalKeywords = ['lawyer', 'attorney', 'lawsuit', 'sue you', 'legal action', 'police', 'fraud report', 'ftc'];
  for (const kw of legalKeywords) {
    if (lowerMsg.includes(kw)) {
      return {
        escalate: true,
        escalationReason: `Customer inquiry mentions legal or regulatory action ('${kw}') requiring executive support review`,
        priority: 'urgent',
        targetTeam: 'legal',
      };
    }
  }

  // 2. Fast deterministic heuristic: Explicit demand for human representative
  const humanDemandKeywords = ['speak to a human', 'real person', 'real human', 'phone number to call', 'call me', 'representative on the line', 'talk to someone'];
  for (const kw of humanDemandKeywords) {
    if (lowerMsg.includes(kw)) {
      return {
        escalate: true,
        escalationReason: `Customer explicitly demanded a human representative ('${kw}')`,
        priority: 'high',
        targetTeam: 'tier_1_support',
      };
    }
  }

  // 3. Fast deterministic heuristic: Account compromise / Security breach
  const securityKeywords = ['hacked', 'someone changed my email', 'unauthorized charge', 'stolen account', 'compromised'];
  for (const kw of securityKeywords) {
    if (lowerMsg.includes(kw)) {
      return {
        escalate: true,
        escalationReason: `Security signal detected: user reports account compromise or unauthorized activity ('${kw}')`,
        priority: 'urgent',
        targetTeam: 'security_fraud',
      };
    }
  }

  // 4. Threshold check: Low Classifier Confidence (< 0.65)
  if (intentConfidence < 0.65) {
    return {
      escalate: true,
      escalationReason: `Classifier confidence (${intentConfidence.toFixed(2)}) is below the required 0.65 threshold for automated handling`,
      priority: 'medium',
      targetTeam: 'tier_1_support',
    };
  }

  // 5. Threshold check: Knowledge Base Sparsity (< 0.50 similarity)
  if (topSimilarity < 0.50) {
    return {
      escalate: true,
      escalationReason: `No sufficiently similar resolved case found in knowledge base (top match similarity ${(topSimilarity * 100).toFixed(1)}% < 50.0%)`,
      priority: 'medium',
      targetTeam: 'tier_1_support',
    };
  }

  // 6. Intent-based hard escalation
  if (intent === 'human_escalation_required') {
    return {
      escalate: true,
      escalationReason: `Message classified under human_escalation_required intent taxonomy`,
      priority: 'high',
      targetTeam: 'tier_1_support',
    };
  }

  // 7. LLM Escalation Judgment for nuanced cases (e.g. repeated failure, tone, customer frustration)
  const userPrompt = buildEscalateUserPrompt(customerMessage, intent, intentConfidence, topSimilarity, draftReply);

  try {
    const llmRes = await generateGroqJson<LlmEscalateResponse>(
      ESCALATE_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.1, maxTokens: 600 }
    );

    return {
      escalate: Boolean(llmRes.escalate),
      escalationReason: llmRes.escalation_reason || (llmRes.escalate ? 'Escalated by operations policy evaluation' : 'Auto-handled: verified troubleshooting path available'),
      priority: llmRes.priority || 'medium',
      targetTeam: llmRes.target_team || 'tier_1_support',
    };
  } catch (err: any) {
    console.warn('Groq escalate failed, attempting Gemini fallback:', err.message);
    try {
      const geminiRes = await generateGeminiJson<LlmEscalateResponse>(
        ESCALATE_SYSTEM_PROMPT,
        userPrompt,
        { temperature: 0.1 }
      );

      return {
        escalate: Boolean(geminiRes.escalate),
        escalationReason: geminiRes.escalation_reason || (geminiRes.escalate ? 'Escalated by fallback policy evaluation' : 'Auto-handled: standard troubleshooting path'),
        priority: geminiRes.priority || 'medium',
        targetTeam: geminiRes.target_team || 'tier_1_support',
      };
    } catch {
      // Safe fallback if LLM times out: auto-handle since rules passed
      return {
        escalate: false,
        escalationReason: `Auto-handled: high confidence intent (${intentConfidence.toFixed(2)}) and solid retrieval match (${(topSimilarity * 100).toFixed(1)}%)`,
        priority: 'low',
        targetTeam: 'tier_1_support',
      };
    }
  }
}

export const escalateRouter = publicProcedure
  .input(EscalateInputSchema)
  .output(EscalateOutputSchema)
  .mutation(async ({ input }) => {
    return await decideEscalationCore(
      input.customerMessage,
      input.intent,
      input.intentConfidence,
      input.topSimilarity,
      input.draftReply
    );
  });
