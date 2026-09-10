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
    const raw = await generateGeminiJson<unknown>(
      CLASSIFY_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.1 }
    );

    return ClassifyOutputSchema.parse(raw);
  }
}

export const classifyRouter = publicProcedure
  .input(ClassifyInputSchema)
  .output(ClassifyOutputSchema)
  .mutation(async ({ input }) => {
    return await classifyMessageCore(input.message);
  });
