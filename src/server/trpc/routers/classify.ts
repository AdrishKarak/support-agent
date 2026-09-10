import { z } from 'zod';
import { publicProcedure } from '../trpc';
import { CLASSIFY_SYSTEM_PROMPT, buildClassifyUserPrompt } from '@/prompts/classifyPrompt';
import { generateGroqJson } from '@/server/llm/groq';
import { generateGeminiJson } from '@/server/llm/gemini';
import { INTENT_KEYS } from '@/taxonomy/intents';
import { redactCustomerText } from '@/server/privacy';

export const ClassifyInputSchema = z.object({
  message: z.string().min(1).max(1000),
});

export const ClassifyOutputSchema = z.object({
  intent: z.enum(INTENT_KEYS as [string, ...string[]]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(500),
});

export type ClassifyResult = z.infer<typeof ClassifyOutputSchema>;

function fallbackRuleClassifier(message: string): ClassifyResult {
  const lower = message.toLowerCase();
  if (/\b(lawyer|attorney|lawsuit|sue|fraud|police|unauthorized charge|speak to a human|real person|real human|phone number|call me|stolen|hacked)\b/i.test(lower)) {
    return { intent: 'human_escalation_required', confidence: 0.90, reasoning: 'Fallback heuristic: Escalation or safety keyword detected' };
  }
  if (/\b(password|reset|log in|login|sign in|cant log in|can't log in|forgot password|locked out)\b/i.test(lower)) {
    return { intent: 'account_access', confidence: 0.85, reasoning: 'Fallback heuristic: Account credential keyword detected' };
  }
  if (/\b(payment|charged|charge|refund|billing|subscription|premium|student discount|family plan|card)\b/i.test(lower)) {
    return { intent: 'subscription_billing', confidence: 0.85, reasoning: 'Fallback heuristic: Billing keyword detected' };
  }
  if (/\b(download|downloaded|offline|sd card|sync|syncing)\b/i.test(lower)) {
    return { intent: 'offline_download', confidence: 0.85, reasoning: 'Fallback heuristic: Offline storage keyword detected' };
  }
  if (/\b(missing|not available|greyed out|grey out|licensing|catalog|album removed|song removed)\b/i.test(lower)) {
    return { intent: 'content_availability', confidence: 0.85, reasoning: 'Fallback heuristic: Catalog availability keyword detected' };
  }
  if (/\b(crash|crashes|crashing|freeze|frozen|freezes|bugfest|black screen|wont open|not opening)\b/i.test(lower)) {
    return { intent: 'app_bug_crash', confidence: 0.85, reasoning: 'Fallback heuristic: Technical bug keyword detected' };
  }
  if (/\b(feature|wish you|please add|can you add|option to|would be great|sleep timer|folder)\b/i.test(lower)) {
    return { intent: 'feature_request', confidence: 0.80, reasoning: 'Fallback heuristic: Feature request keyword detected' };
  }
  if (/\b(shuffle|repeat|pause|skip|skipping|stutter|cutting out|buffering|no sound|volume)\b/i.test(lower)) {
    return { intent: 'playback_issue', confidence: 0.85, reasoning: 'Fallback heuristic: Audio playback keyword detected' };
  }
  return { intent: 'feedback_complaint', confidence: 0.70, reasoning: 'Fallback heuristic: General customer inquiry' };
}

export async function classifyMessageCore(message: string): Promise<ClassifyResult> {
  const userPrompt = buildClassifyUserPrompt(redactCustomerText(message));

  try {
    const raw = await generateGroqJson<unknown>(
      CLASSIFY_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.1, maxTokens: 600 }
    );

    return ClassifyOutputSchema.parse(raw);
  } catch (err: any) {
    console.warn('Groq classify failed, attempting Gemini fallback:', err.message);
    try {
      const raw = await generateGeminiJson<unknown>(
        CLASSIFY_SYSTEM_PROMPT,
        userPrompt,
        { temperature: 0.1 }
      );

      return ClassifyOutputSchema.parse(raw);
    } catch (geminiErr: any) {
      console.warn('Gemini classify failed, using fallback heuristic classifier:', geminiErr.message);
      return fallbackRuleClassifier(message);
    }
  }
}

export const classifyRouter = publicProcedure
  .input(ClassifyInputSchema)
  .output(ClassifyOutputSchema)
  .mutation(async ({ input }) => {
    return await classifyMessageCore(input.message);
  });

