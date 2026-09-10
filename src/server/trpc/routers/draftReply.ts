import { z } from 'zod';
import { publicProcedure } from '../trpc';
import { DRAFT_REPLY_SYSTEM_PROMPT, buildDraftReplyUserPrompt } from '@/prompts/draftReplyPrompt';
import { generateGroqJson } from '@/server/llm/groq';
import { generateGeminiJson } from '@/server/llm/gemini';
import { RetrievedThreadSchema } from './retrieve';
import { isSafeReply, verifiedGrounding } from '@/pipeline/trust';
import { redactCustomerText } from '@/server/privacy';

export const DraftReplyInputSchema = z.object({
  customerMessage: z.string().min(1).max(1000),
  intent: z.string(),
  retrievedThreads: z.array(RetrievedThreadSchema).default([]),
});

export const DraftReplyOutputSchema = z.object({
  reply: z.string(),
  groundingSources: z.array(z.string()),
  groundednessConfidence: z.number(),
  suggestedAction: z.string(),
});

export type DraftReplyResult = z.infer<typeof DraftReplyOutputSchema>;

interface LlmDraftReplyResponse {
  reply: string;
  grounding_sources?: string[];
  groundedness_confidence?: number;
  suggested_action?: string;
}

const LlmDraftReplyResponseSchema = z.object({
  reply: z.string().max(1000),
  grounding_sources: z.array(z.string()).max(5).optional(),
  groundedness_confidence: z.number().optional(),
  suggested_action: z.string().optional(),
});

function normalizeDraft(
  draft: LlmDraftReplyResponse,
  retrievedThreads: z.infer<typeof RetrievedThreadSchema>[]
): DraftReplyResult {
  const verified = verifiedGrounding(draft.grounding_sources, retrievedThreads);
  const fallback = 'Thanks for reaching out. Could you share your device, operating system, and Spotify app version so we can look into this?';
  return {
    reply: isSafeReply(draft.reply) ? draft.reply.trim() : fallback,
    // Never claim a source the pipeline did not actually retrieve.
    groundingSources: verified.sources,
    // Similarity is a measured retrieval signal, not a model self-assessment.
    groundednessConfidence: verified.confidence,
    suggestedAction: typeof draft.suggested_action === 'string' && ['troubleshoot', 'request_info', 'redirect_faq', 'direct_message'].includes(draft.suggested_action)
      ? draft.suggested_action
      : 'request_info',
  };
}

export async function draftReplyCore(
  customerMessage: string,
  intent: string,
  retrievedThreads: z.infer<typeof RetrievedThreadSchema>[]
): Promise<DraftReplyResult> {
  const userPrompt = buildDraftReplyUserPrompt(redactCustomerText(customerMessage), intent, retrievedThreads);

  try {
    const raw = await generateGroqJson<unknown>(
      DRAFT_REPLY_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.3, maxTokens: 600 }
    );

    return normalizeDraft(LlmDraftReplyResponseSchema.parse(raw), retrievedThreads);
  } catch (err: any) {
    console.warn('Groq draft reply failed, attempting Gemini fallback:', err.message);
    const raw = await generateGeminiJson<unknown>(
      DRAFT_REPLY_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.3 }
    );

    return normalizeDraft(LlmDraftReplyResponseSchema.parse(raw), retrievedThreads);
  }
}

export const draftReplyRouter = publicProcedure
  .input(DraftReplyInputSchema)
  .output(DraftReplyOutputSchema)
  .mutation(async ({ input }) => {
    return await draftReplyCore(input.customerMessage, input.intent, input.retrievedThreads);
  });
