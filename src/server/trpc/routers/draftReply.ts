import { z } from 'zod';
import { publicProcedure } from '../trpc';
import { DRAFT_REPLY_SYSTEM_PROMPT, buildDraftReplyUserPrompt } from '@/prompts/draftReplyPrompt';
import { generateGroqJson } from '@/server/llm/groq';
import { generateGeminiJson } from '@/server/llm/gemini';
import { RetrievedThreadSchema } from './retrieve';

export const DraftReplyInputSchema = z.object({
  customerMessage: z.string().min(1),
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
  grounding_sources: string[];
  groundedness_confidence: number;
  suggested_action: string;
}

export async function draftReplyCore(
  customerMessage: string,
  intent: string,
  retrievedThreads: z.infer<typeof RetrievedThreadSchema>[]
): Promise<DraftReplyResult> {
  const userPrompt = buildDraftReplyUserPrompt(customerMessage, intent, retrievedThreads);

  try {
    const groqRes = await generateGroqJson<LlmDraftReplyResponse>(
      DRAFT_REPLY_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.3, maxTokens: 600 }
    );

    return {
      reply: groqRes.reply || 'Thanks for reaching out! Could you let us know your device and Spotify version so we can help troubleshoot?',
      groundingSources: groqRes.grounding_sources || retrievedThreads.map(t => t.threadId),
      groundednessConfidence: Math.max(0, Math.min(1, groqRes.groundedness_confidence ?? 0.8)),
      suggestedAction: groqRes.suggested_action || 'troubleshoot',
    };
  } catch (err: any) {
    console.warn('Groq draft reply failed, attempting Gemini fallback:', err.message);
    const geminiRes = await generateGeminiJson<LlmDraftReplyResponse>(
      DRAFT_REPLY_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.3 }
    );

    return {
      reply: geminiRes.reply || 'Thanks for reaching out! Could you share your device and OS version with us via DM?',
      groundingSources: geminiRes.grounding_sources || retrievedThreads.map(t => t.threadId),
      groundednessConfidence: Math.max(0, Math.min(1, geminiRes.groundedness_confidence ?? 0.8)),
      suggestedAction: geminiRes.suggested_action || 'troubleshoot',
    };
  }
}

export const draftReplyRouter = publicProcedure
  .input(DraftReplyInputSchema)
  .output(DraftReplyOutputSchema)
  .mutation(async ({ input }) => {
    return await draftReplyCore(input.customerMessage, input.intent, input.retrievedThreads);
  });
