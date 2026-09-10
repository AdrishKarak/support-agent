import { NextResponse } from 'next/server';
import { runAgentPipeline } from '@/pipeline/runAgent';
import { pipelineCache } from '@/server/cache';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check pipeline response cache for identical messages
    const cacheKey = message.toLowerCase();
    const cached = pipelineCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ ...cached, _cached: true });
    }

    const result = await runAgentPipeline(message);

    // Cache the result for future identical queries
    pipelineCache.set(cacheKey, result);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Pipeline API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Pipeline Error' }, { status: 500 });
  }
}
