import { z } from 'zod';
import { publicProcedure } from '../trpc';
import { ESCALATE_SYSTEM_PROMPT, buildEscalateUserPrompt } from '@/prompts/escalatePrompt';
import { generateGroqJson } from '@/server/llm/groq';
import { generateGeminiJson } from '@/server/llm/gemini';

const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
const TargetTeamSchema = z.enum(['tier_1_support', 'technical_escalations', 'billing_finance', 'security_fraud', 'legal']);

export const EscalateInputSchema = z.object({
  customerMessage: z.string().min(1).max(1000),
  intent: z.string(),
  intentConfidence: z.number().min(0).max(1),
  topSimilarity: z.number().min(0).max(1).default(0),
  draftReply: z.string().max(1500).default(''),
});

export const EscalateOutputSchema = z.object({
  escalate: z.boolean(),
  escalationReason: z.string(),
  priority: PrioritySchema,
  targetTeam: TargetTeamSchema,
});

export type EscalateResult = z.infer<typeof EscalateOutputSchema>;

const LlmEscalateResponseSchema = z.object({
  escalate: z.boolean(),
  escalation_reason: z.string().max(500).optional(),
  priority: PrioritySchema.optional(),
  target_team: TargetTeamSchema.optional(),
});

/** Rules evaluated before generative drafting is permitted. */
export function deterministicEscalation(
  customerMessage: string,
  intent: string,
  intentConfidence: number,
  topSimilarity: number
): EscalateResult | null {
  const lowerMsg = customerMessage.toLowerCase();
  const checks: Array<{ keywords: string[]; reason: string; priority: z.infer<typeof PrioritySchema>; team: z.infer<typeof TargetTeamSchema> }> = [
    { keywords: ['lawyer', 'attorney', 'lawsuit', 'sue you', 'legal action', 'police', 'fraud report', 'ftc', 'regulator', 'chargeback'], reason: 'Customer inquiry mentions legal or regulatory action', priority: 'urgent', team: 'legal' },
    { keywords: ['speak to a human', 'real person', 'real human', 'phone number to call', 'call me', 'representative on the line', 'talk to someone', 'human agent', 'not a bot'], reason: 'Customer explicitly demanded a human representative', priority: 'high', team: 'tier_1_support' },
    { keywords: ['hacked', 'someone changed my email', 'unauthorized charge', 'stolen account', 'compromised', 'phishing', 'password was changed', 'account takeover'], reason: 'Security signal detected: user reports account compromise or unauthorized activity', priority: 'urgent', team: 'security_fraud' },
    { keywords: ['charged twice', 'double charged', 'charged me twice', 'bank debit', 'refund now', 'refund immediately'], reason: 'Financial dispute signal detected requiring billing review', priority: 'high', team: 'billing_finance' },
  ];

  for (const check of checks) {
    const keyword = check.keywords.find(value => lowerMsg.includes(value));
    if (keyword) return { escalate: true, escalationReason: `${check.reason} ('${keyword}')`, priority: check.priority, targetTeam: check.team };
  }
  if (intentConfidence < 0.65) return { escalate: true, escalationReason: `Classifier confidence (${intentConfidence.toFixed(2)}) is below the required 0.65 threshold for automated handling`, priority: 'medium', targetTeam: 'tier_1_support' };
  if (topSimilarity < 0.50) return { escalate: true, escalationReason: `No sufficiently similar resolved case found in knowledge base (top match similarity ${(topSimilarity * 100).toFixed(1)}% < 50.0%)`, priority: 'medium', targetTeam: 'tier_1_support' };
  if (intent === 'human_escalation_required') return { escalate: true, escalationReason: 'Message classified under human_escalation_required intent taxonomy', priority: 'high', targetTeam: 'tier_1_support' };
  return null;
}

export async function decideEscalationCore(
  customerMessage: string,
  intent: string,
  intentConfidence: number,
  topSimilarity: number,
  draftReply: string
): Promise<EscalateResult> {
  const deterministic = deterministicEscalation(customerMessage, intent, intentConfidence, topSimilarity);
  if (deterministic) return deterministic;

  // The model is only used for nuanced policy signals after hard rules pass.
  const userPrompt = buildEscalateUserPrompt(customerMessage, intent, intentConfidence, topSimilarity, draftReply);

  try {
    const raw = await generateGroqJson<unknown>(
      ESCALATE_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.1, maxTokens: 600 }
    );

    const llmRes = LlmEscalateResponseSchema.parse(raw);
    return {
      escalate: llmRes.escalate,
      escalationReason: llmRes.escalation_reason || (llmRes.escalate ? 'Escalated by operations policy evaluation' : 'Auto-handled: verified troubleshooting path available'),
      priority: llmRes.priority || 'medium',
      targetTeam: llmRes.target_team || 'tier_1_support',
    };
  } catch (err: any) {
    console.warn('Groq escalate failed, attempting Gemini fallback:', err.message);
    try {
      const raw = await generateGeminiJson<unknown>(
        ESCALATE_SYSTEM_PROMPT,
        userPrompt,
        { temperature: 0.1 }
      );

      const geminiRes = LlmEscalateResponseSchema.parse(raw);
      return {
        escalate: geminiRes.escalate,
        escalationReason: geminiRes.escalation_reason || (geminiRes.escalate ? 'Escalated by fallback policy evaluation' : 'Auto-handled: standard troubleshooting path'),
        priority: geminiRes.priority || 'medium',
        targetTeam: geminiRes.target_team || 'tier_1_support',
      };
    } catch {
      // A missing policy decision must fail closed, not send unreviewed advice.
      return {
        escalate: true,
        escalationReason: 'Escalated because the policy review service was unavailable; no automated resolution was sent',
        priority: 'medium',
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
