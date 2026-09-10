/**
 * Keeps customer supplied text out of provider prompts, response payloads, and
 * cache keys where it is not needed to resolve the issue. This is deliberately
 * conservative: a support agent should never need an email, phone number, or
 * a customer-provided URL to draft a public reply.
 */
export function redactCustomerText(raw: string): string {
  return raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\b(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,4}\)?[ .-]?)?\d{3,4}[ .-]\d{3,4}\b/g, '[PHONE]')
    .replace(/https?:\/\/[^\s]+/gi, '[LINK]')
    .replace(/@[A-Za-z0-9_]+\b/g, '@user')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isValidCustomerMessage(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 1_000;
}
