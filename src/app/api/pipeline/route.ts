import { NextResponse } from 'next/server';
import { runAgentPipeline } from '@/pipeline/runAgent';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const message = body.message?.trim();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }
    const result = await runAgentPipeline(message);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('Pipeline API error:', err);
    return NextResponse.json({ error: err.message || 'Internal Pipeline Error' }, { status: 500 });
  }
}
