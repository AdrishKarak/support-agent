import { classifyMessageCore } from '../../src/server/trpc/routers/classify';
import { generateGroqJson } from '../../src/server/llm/groq';
import { generateGeminiJson } from '../../src/server/llm/gemini';
import { decideEscalationCore } from '../../src/server/trpc/routers/escalate';

export interface ZeroShotBaselineOutput {
  customerMessage: string;
  intent: string;
  confidence: number;
  reply: string;
  escalate: boolean;
  escalationReason: string;
  groundingUsed: boolean;
}

const ZERO_SHOT_REPLY_SYSTEM_PROMPT = `You are a Customer Support Representative for Spotify (@SpotifyCares).
Draft a concise, polite Twitter reply to the customer message.
NOTE: You have NO external knowledge base or past resolved context. Answer solely using your general zero-shot knowledge.
Do NOT invent links; use [LINK] as placeholder if needed.

Respond with valid JSON:
{
  "reply": "<the draft reply string>"
}
`;

export async function runZeroShotBaseline(message: string): Promise<ZeroShotBaselineOutput> {
  // 1. LLM classification
  const classifyRes = await classifyMessageCore(message);

  // 2. Zero-shot reply drafting with NO RETRIEVAL CONTEXT
  let reply = '';
  try {
    const res = await generateGroqJson<{ reply: string }>(
      ZERO_SHOT_REPLY_SYSTEM_PROMPT,
      `Customer message: "${message}"\nIntent: ${classifyRes.intent}`,
      { temperature: 0.3 }
    );
    reply = res.reply;
  } catch {
    const res = await generateGeminiJson<{ reply: string }>(
      ZERO_SHOT_REPLY_SYSTEM_PROMPT,
      `Customer message: "${message}"\nIntent: ${classifyRes.intent}`,
      { temperature: 0.3 }
    );
    reply = res.reply;
  }

  // 3. Escalation decision (topSimilarity is 0 since no retrieval is used)
  const escalateRes = await decideEscalationCore(
    message,
    classifyRes.intent,
    classifyRes.confidence,
    0, // zero retrieval similarity
    reply
  );

  return {
    customerMessage: message,
    intent: classifyRes.intent,
    confidence: classifyRes.confidence,
    reply,
    escalate: escalateRes.escalate,
    escalationReason: escalateRes.escalationReason,
    groundingUsed: false,
  };
}
