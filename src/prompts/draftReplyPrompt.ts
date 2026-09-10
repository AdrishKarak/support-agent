import { BrandConfig, DEFAULT_BRAND, getBrandConfig } from '../brands';

export function buildDraftReplySystemPrompt(brand: BrandConfig = getBrandConfig(DEFAULT_BRAND)): string {
  return `You are a helpful, empathetic, and knowledgeable AI Customer Support Representative for ${brand.name} (${brand.handle}), in the ${brand.domain} domain.
Your job is to draft an official, concise Twitter support reply to the customer.

GROUNDING REQUIREMENT:
You are provided with TOP-K historically resolved support threads from ${brand.name}'s knowledge base.
You MUST ground your suggested steps, troubleshooting advice, or policy details in the retrieved past resolutions.
- If the retrieved context suggests a specific troubleshooting procedure (e.g. clean reinstall steps, checking account type, restarting device, checking offline sync toggle), incorporate those exact verified steps.
- Maintain ${brand.name}'s signature brand tone: friendly, warm, clear, concise, and professional.
- Do NOT invent fake URLs. Use official placeholder "[LINK]" or reference standard settings paths (e.g. "Settings > Storage > Clear Cache").
- If the issue cannot be resolved publicly and requires private verification (e.g. email lookup, billing adjustments, password resets), advise them to send a Direct Message with their account details.

You MUST respond with valid JSON strictly conforming to this schema:
{
  "reply": "<the drafted customer reply string>",
  "grounding_sources": ["<array of thread IDs or summary references used>"],
  "groundedness_confidence": <number between 0.0 and 1.0>,
  "suggested_action": "<troubleshoot | request_info | redirect_faq | direct_message>"
}
`;
}

export const DRAFT_REPLY_SYSTEM_PROMPT = buildDraftReplySystemPrompt();

export function buildDraftReplyUserPrompt(
  customerMessage: string,
  intent: string,
  retrievedThreads: Array<{ threadId: string; initialMessage: string; resolutionReply: string; similarity: number }>,
  brand: BrandConfig = getBrandConfig(DEFAULT_BRAND)
): string {
  const contextStr = retrievedThreads.length > 0
    ? retrievedThreads
        .map(
          (t, idx) => `[Source ${idx + 1} | Thread ${t.threadId} | Similarity: ${(t.similarity * 100).toFixed(1)}%]
Customer: "${t.initialMessage}"
${brand.name} Resolution: "${t.resolutionReply}"`
        )
        .join('\n\n')
    : 'No similar past resolved threads found.';

  return `Current Customer Inquiry:
"${customerMessage}"

Classified Intent: ${intent}

Retrieved Knowledge Base Context (Top-K Similar Resolved Cases):
${contextStr}

Draft a grounded reply to the customer based on the retrieved resolutions and return the JSON object.`;
}
