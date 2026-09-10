import { GoogleGenerativeAI } from '@google/generative-ai';
import 'dotenv/config';
import { embeddingCache } from '../cache';

let genAIInstance: GoogleGenerativeAI | null = null;

function getGenAIClient(): GoogleGenerativeAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in .env');
    }
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

export async function embedQuery(text: string): Promise<number[]> {
  // Check embedding cache first
  const cached = embeddingCache.get(text);
  if (cached) return cached;

  const genAI = getGenAIClient();
  const embModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });

  let retries = 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      const res = await embModel.embedContent({
        content: { role: 'user', parts: [{ text }] },
        outputDimensionality: 768,
      } as any);
      const embedding = res.embedding.values;
      embeddingCache.set(text, embedding);
      return embedding;
    } catch (err: any) {
      retries--;
      if (retries === 0) {
        throw new Error(`Gemini embedding error: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }

  throw new Error('Exhausted retries in embedQuery');
}

export async function generateGeminiJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string;
    temperature?: number;
    retries?: number;
  } = {}
): Promise<T> {
  const genAI = getGenAIClient();
  const modelName = options.model || 'gemini-3.6-flash';
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: options.temperature ?? 0.2,
    },
    systemInstruction: systemPrompt,
  });

  let retries = options.retries ?? 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      const res = await model.generateContent(userPrompt);
      const text = res.response.text();
      return JSON.parse(text) as T;
    } catch (err: any) {
      retries--;
      if (retries === 0) {
        throw new Error(`Gemini generation error: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }

  throw new Error('Exhausted retries in generateGeminiJson');
}
