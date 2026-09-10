import { classifyMessageCore } from '../server/trpc/routers/classify';
import { retrieveSimilarThreadsCore, RetrievedThread } from '../server/trpc/routers/retrieve';
import { draftReplyCore } from '../server/trpc/routers/draftReply';
import { decideEscalationCore } from '../server/trpc/routers/escalate';
import { BrandKey, DEFAULT_BRAND, getBrandConfig, isBrandKey } from '../brands';

export interface AgentPipelineOutput {
  brand: BrandKey;
  customerMessage: string;
  intent: string;
  confidence: number;
  reasoning: string;
  retrievedThreads: RetrievedThread[];
  reply: string;
  groundednessConfidence: number;
  escalate: boolean;
  escalationReason: string;
  priority: string;
  targetTeam: string;
  latencyMs: number;
}

export async function runAgentPipeline(
  customerMessage: string,
  brand: string = DEFAULT_BRAND,
  options: { topK?: number } = {}
): Promise<AgentPipelineOutput> {
  const startTime = Date.now();
  const topK = options.topK ?? 3;
  const selectedBrand = isBrandKey(brand) ? brand : DEFAULT_BRAND;
  getBrandConfig(selectedBrand);

  // 1 & 2. Intent Classification and Retrieval in parallel
  const [classifyRes, retrieveRes] = await Promise.all([
    classifyMessageCore(customerMessage, selectedBrand),
    retrieveSimilarThreadsCore(customerMessage, topK, selectedBrand),
  ]);

  // 3. Grounded Reply Drafting
  const draftRes = await draftReplyCore(customerMessage, classifyRes.intent, retrieveRes.threads, selectedBrand);

  // 4. Escalation Decision
  const escalateRes = await decideEscalationCore(
    customerMessage,
    classifyRes.intent,
    classifyRes.confidence,
    retrieveRes.topSimilarity,
    draftRes.reply,
    selectedBrand
  );

  const latencyMs = Date.now() - startTime;

  return {
    brand: selectedBrand,
    customerMessage,
    intent: classifyRes.intent,
    confidence: classifyRes.confidence,
    reasoning: classifyRes.reasoning,
    retrievedThreads: retrieveRes.threads,
    reply: draftRes.reply,
    groundednessConfidence: draftRes.groundednessConfidence,
    escalate: escalateRes.escalate,
    escalationReason: escalateRes.escalationReason,
    priority: escalateRes.priority,
    targetTeam: escalateRes.targetTeam,
    latencyMs,
  };
}

// Standalone interactive demo CLI
if (process.argv[1]?.endsWith('runAgent.ts')) {
  const sampleMsg = process.argv.slice(2).join(' ') || 
    'My shuffle and repeat buttons are not working on my iPhone 11 after the latest update.';

  console.log(`Running pipeline on: "${sampleMsg}"\n`);
  runAgentPipeline(sampleMsg)
    .then(res => {
      console.log('=== Pipeline Execution Output ===');
      console.log(JSON.stringify(res, null, 2));
    })
    .catch(console.error);
}
