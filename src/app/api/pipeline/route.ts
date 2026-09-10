import { NextResponse } from 'next/server';
import { runAgentPipeline } from '@/pipeline/runAgent';
import { pipelineCache } from '@/server/cache';
import { isValidCustomerMessage, redactCustomerText } from '@/server/privacy';
import { takeRequestQuota } from '@/server/rateLimit';

export async function POST(req: Request) {
  try {
    const clientKey = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
    const quota = takeRequestQuota(clientKey);
    if (!quota.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(quota.retryAfterSeconds) } }
      );
    }
    const body = await req.json();
    if (!isValidCustomerMessage(body.message)) {
      return NextResponse.json({ error: 'Message must be between 1 and 1000 characters' }, { status: 400 });
    }
    const message = body.message.trim();

    // Check pipeline response cache for identical messages
    const cacheKey = redactCustomerText(message).toLowerCase();
    const cached = pipelineCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, _cached: true });
    }

    const result = await runAgentPipeline(message);

    // Cache the result for future identical queries
    pipelineCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Pipeline API error:', err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'The support service is temporarily unavailable. Please try again shortly.' }, { status: 503 });
  }
}
