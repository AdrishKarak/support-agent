import { formatTaxonomyForPrompt, INTENT_KEYS } from '../taxonomy/intents';

export const CLASSIFY_SYSTEM_PROMPT = `You are a high-accuracy Customer Support Intent Classifier for Spotify.
Your goal is to categorize the customer's incoming message into exactly ONE of the following approved intent categories:
${INTENT_KEYS.join(', ')}

Here is the empirical intent taxonomy:
${formatTaxonomyForPrompt()}

You MUST respond with valid JSON strictly conforming to this schema:
{
  "intent": "<one of the exact intent keys>",
  "confidence": <number between 0.0 and 1.0>,
  "reasoning": "<concise explanation referencing specific words or signals in the message>"
}

Guidelines:
- If the customer reports playback stuttering, tracks stopping, shuffle/repeat malfunctioning -> playback_issue
- If the customer is unable to download or listen offline -> offline_download
- If the customer cannot find an album, track, artist, or track is greyed out -> content_availability
- If the customer asks about charges, payment issues, student discount, or family plan -> subscription_billing
- If the customer is locked out, password reset, account hacked, email change -> account_access
- If the app crashed, froze, or web player failed to render -> app_bug_crash
- If the customer suggests a new feature or asks for Spotify in an unsupported country -> feature_request
- If the customer gives praise, compliments, or general venting about redesigns without bug report -> feedback_complaint
- If the customer demands a phone call, lawyer/legal action, or explicit human agent -> human_escalation_required
`;

export function buildClassifyUserPrompt(customerMessage: string): string {
  return `Customer Message:
"${customerMessage}"

Classify this message and output the JSON response.`;
}
