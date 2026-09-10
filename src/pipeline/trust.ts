import type { RetrievedThread } from '@/server/trpc/routers/retrieve';

export const AUTO_REPLY_MIN_SIMILARITY = 0.68;

const DISALLOWED_REPLY_PATTERNS = [
  /\b(?:password|passcode|one[- ]?time code|verification code|cvv|security code)\b/i,
  /\b(?:credit|debit)\s*card\s*(?:number|details)/i,
  /\bsocial security\b/i,
];

/** A bounded response used when a human must take ownership. */
export function escalationAcknowledgement(targetTeam: string): string {
  if (targetTeam === 'security_fraud') {
    return 'Thanks for flagging this. For your security, please don\'t share passwords, payment details, or verification codes here. A specialist needs to review this with you.';
  }
  if (targetTeam === 'legal') {
    return 'Thanks for letting us know. We\'re routing this to the appropriate specialist team for review.';
  }
  return 'Thanks for reaching out. We want to make sure this is handled correctly, so a support specialist needs to take the next step.';
}

export function isSafeReply(reply: string): boolean {
  return reply.length > 0 && reply.length <= 1_000 && !DISALLOWED_REPLY_PATTERNS.some(pattern => pattern.test(reply));
}

export function verifiedGrounding(
  requestedSources: string[] | undefined,
  retrievedThreads: RetrievedThread[]
): { sources: string[]; confidence: number } {
  const available = new Set(retrievedThreads.map(thread => thread.threadId));
  const sources = [...new Set((requestedSources ?? []).filter(source => available.has(source)))];
  const citedThreads = retrievedThreads.filter(thread => sources.includes(thread.threadId));
  const confidence = citedThreads.length
    ? Math.max(...citedThreads.map(thread => thread.similarity))
    : 0;

  return { sources, confidence: Math.max(0, Math.min(1, confidence)) };
}
