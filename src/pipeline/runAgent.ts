import { classifyMessageCore } from '../server/trpc/routers/classify';
import { retrieveSimilarThreadsCore, RetrievedThread } from '../server/trpc/routers/retrieve';
import { draftReplyCore } from '../server/trpc/routers/draftReply';
import { decideEscalationCore, deterministicEscalation } from '../server/trpc/routers/escalate';
import { AUTO_REPLY_MIN_SIMILARITY, escalationAcknowledgement } from './trust';
import { redactCustomerText } from '../server/privacy';

export interface AgentPipelineOutput {
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
  options: { topK?: number } = {}
): Promise<AgentPipelineOutput> {
  const startTime = Date.now();
  const topK = options.topK ?? 3;
  const safeMessage = redactCustomerText(customerMessage);

  // 1 & 2. Intent Classification and Retrieval in parallel
  const [classifyRes, retrieveRes] = await Promise.all([
    classifyMessageCore(safeMessage),
    retrieveSimilarThreadsCore(safeMessage, topK),
  ]);

  const preflight = deterministicEscalation(
    safeMessage,
    classifyRes.intent,
    classifyRes.confidence,
    retrieveRes.topSimilarity
  ) ?? (retrieveRes.topSimilarity < AUTO_REPLY_MIN_SIMILARITY
    ? {
        escalate: true,
        escalationReason: `Evidence is insufficient for an automated reply (top verified match ${(retrieveRes.topSimilarity * 100).toFixed(1)}% < ${(AUTO_REPLY_MIN_SIMILARITY * 100).toFixed(0)}%)`,
        priority: 'medium' as const,
        targetTeam: 'tier_1_support' as const,
      }
    : null);

  // Do not generate troubleshooting instructions for a case already assigned
  // to a human or not supported by sufficiently relevant evidence.
  if (preflight) {
    return {
      customerMessage: safeMessage,
      intent: classifyRes.intent,
      confidence: classifyRes.confidence,
      reasoning: classifyRes.reasoning,
      retrievedThreads: retrieveRes.threads,
      reply: escalationAcknowledgement(preflight.targetTeam),
      groundednessConfidence: 0,
      escalate: true,
      escalationReason: preflight.escalationReason,
      priority: preflight.priority,
      targetTeam: preflight.targetTeam,
      latencyMs: Date.now() - startTime,
    };
  }

  // 3. Grounded Reply Drafting
  const draftRes = await draftReplyCore(safeMessage, classifyRes.intent, retrieveRes.threads);

  // 4. Escalation Decision
  const escalateRes = await decideEscalationCore(
    safeMessage,
    classifyRes.intent,
    classifyRes.confidence,
    retrieveRes.topSimilarity,
    draftRes.reply
  );

  const latencyMs = Date.now() - startTime;

  return {
    customerMessage: safeMessage,
    intent: classifyRes.intent,
    confidence: classifyRes.confidence,
    reasoning: classifyRes.reasoning,
    retrievedThreads: retrieveRes.threads,
    reply: escalateRes.escalate ? escalationAcknowledgement(escalateRes.targetTeam) : draftRes.reply,
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
