import { z } from 'zod';
import { publicProcedure } from '../trpc';
import { CLASSIFY_SYSTEM_PROMPT, buildClassifyUserPrompt } from '@/prompts/classifyPrompt';
import { generateGroqJson } from '@/server/llm/groq';
import { generateGeminiJson } from '@/server/llm/gemini';
import { INTENT_KEYS } from '@/taxonomy/intents';

export const ClassifyInputSchema = z.object({
  message: z.string().min(1),
});

export const ClassifyOutputSchema = z.object({
  intent: z.string(),
  confidence: z.number(),
  reasoning: z.string(),
});

export type ClassifyResult = z.infer<typeof ClassifyOutputSchema>;

export async function classifyMessageCore(message: string): Promise<ClassifyResult> {
  const userPrompt = buildClassifyUserPrompt(message);

  try {
    const groqResult = await generateGroqJson<ClassifyResult>(
      CLASSIFY_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.1, maxTokens: 600 }
    );

    // Validate intent is one of our approved taxonomy keys
    const matchedIntent = INTENT_KEYS.includes(groqResult.intent as any)
      ? groqResult.intent
      : 'feedback_complaint';

    return {
      intent: matchedIntent,
      confidence: Math.max(0, Math.min(1, groqResult.confidence ?? 0.8)),
      reasoning: groqResult.reasoning || 'Classified by Groq LLM',
    };
  } catch (err: any) {
    console.warn('Groq classify failed, attempting Gemini fallback:', err.message);
    const geminiResult = await generateGeminiJson<ClassifyResult>(
      CLASSIFY_SYSTEM_PROMPT,
      userPrompt,
      { temperature: 0.1 }
    );

    const matchedIntent = INTENT_KEYS.includes(geminiResult.intent as any)
      ? geminiResult.intent
      : 'feedback_complaint';

    return {
      intent: matchedIntent,
      confidence: Math.max(0, Math.min(1, geminiResult.confidence ?? 0.8)),
      reasoning: geminiResult.reasoning || 'Classified by Gemini fallback',
    };
  }
}

export const classifyRouter = publicProcedure
  .input(ClassifyInputSchema)
  .output(ClassifyOutputSchema)
  .mutation(async ({ input }) => {
    return await classifyMessageCore(input.message);
  });
