import Groq from 'groq-sdk';
import 'dotenv/config';

let groqInstance: Groq | null = null;

function getGroqClient(): Groq {
  if (!groqInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('GROQ_API_KEY is not defined in .env');
    }
    groqInstance = new Groq({ apiKey });
  }
  return groqInstance;
}

export async function generateGroqJson<T>(
  systemPrompt: string,
  userPrompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    retries?: number;
  } = {}
): Promise<T> {
  const groq = getGroqClient();
  const model = options.model || 'openai/gpt-oss-20b';
  const temperature = options.temperature ?? 0.1;
  const maxTokens = options.maxTokens ?? 400;
  let retries = options.retries ?? 3;
  let delay = 1000;

  while (retries > 0) {
    try {
      const response = await groq.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response received from Groq.');
      }

      return JSON.parse(content) as T;
    } catch (err: any) {
      if (err.status === 429 || err.message?.includes('429') || err.message?.includes('rate_limit')) {
        retries--;
        if (retries === 0) {
          throw new Error(`Groq rate limit exceeded after retries: ${err.message}`);
        }
        await new Promise(r => setTimeout(r, 2500));
        continue;
      }
      retries--;
      if (retries === 0) {
        throw new Error(`Groq API error after retries: ${err.message}`);
      }
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }

  throw new Error('Exhausted retries in generateGroqJson');
}
