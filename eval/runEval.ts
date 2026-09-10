import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import pg from 'pg';
import { runAgentPipeline, AgentPipelineOutput } from '../src/pipeline/runAgent';
import { computeClassificationMetrics, computeBinaryMetrics } from './metricsHelper';
import { evaluateReplyWithJudge, JudgeEvaluation } from './judgeHelper';

const { Client } = pg;

export async function runEvaluation(sampleSize = 25) {
  console.log('===============================================================');
  console.log('         AI CUSTOMER SUPPORT AGENT - FULL EVALUATION          ');
  console.log('===============================================================\n');

  const goldenPath = path.resolve('data/processed/golden_eval_set.jsonl');
  if (!fs.existsSync(goldenPath)) {
    throw new Error(`Golden eval set not found at ${goldenPath}`);
  }

  const lines = fs.readFileSync(goldenPath, 'utf-8').trim().split('\n').filter(Boolean);
  const sample = lines.map(l => JSON.parse(l)).slice(0, sampleSize);

  console.log(`Evaluating Full Pipeline on ${sample.length} held-out golden examples...\n`);

  const groundTruthIntents: string[] = [];
  const predictedIntents: string[] = [];
  const groundTruthEscalates: boolean[] = [];
  const predictedEscalates: boolean[] = [];
  const pipelineOutputs: AgentPipelineOutput[] = [];
  const judgeScores: JudgeEvaluation[] = [];

  let retrievalHits = 0;
  let totalLatency = 0;

  for (let i = 0; i < sample.length; i++) {
    const item = sample[i];
    const out = await runAgentPipeline(item.customerMessage);
    pipelineOutputs.push(out);

    groundTruthIntents.push(item.groundTruthIntent);
    predictedIntents.push(out.intent);

    groundTruthEscalates.push(item.groundTruthEscalate);
    predictedEscalates.push(out.escalate);

    totalLatency += out.latencyMs;

    // Retrieval Hit Rate: top similarity >= 0.55
    const topSim = out.retrievedThreads.length > 0 ? out.retrievedThreads[0].similarity : 0;
    if (topSim >= 0.55) {
      retrievalHits++;
    }

    // Run LLM-as-judge on subset (first 5 for deep audit)
    if (i < 5) {
      const kbContext = out.retrievedThreads.map(t => t.resolutionReply).join('\n---\n');
      const jScore = await evaluateReplyWithJudge(
        item.customerMessage,
        kbContext,
        out.reply,
        item.referenceReply
      );
      judgeScores.push(jScore);
    }

    console.log(`Pipeline Evaluation progress: ${i + 1}/${sample.length} (Latency: ${out.latencyMs}ms, Intent: ${out.intent}, Escalate: ${out.escalate})`);
    await new Promise(r => setTimeout(r, 2000)); // rate limit pacing (Groq 8k TPM buffer)
  }

  // Calculate Metrics
  const classMetrics = computeClassificationMetrics(groundTruthIntents, predictedIntents);
  const binaryMetrics = computeBinaryMetrics(groundTruthEscalates, predictedEscalates);
  const retrievalHitRate = Number(((retrievalHits / sample.length) * 100).toFixed(1));
  const avgLatency = Math.round(totalLatency / sample.length);

  // Judge scores summary
  const meanGroundedness = judgeScores.length > 0 ? Number((judgeScores.reduce((a, b) => a + b.groundedness, 0) / judgeScores.length).toFixed(2)) : 0;
  const meanCorrectness = judgeScores.length > 0 ? Number((judgeScores.reduce((a, b) => a + b.correctness, 0) / judgeScores.length).toFixed(2)) : 0;
  const meanTone = judgeScores.length > 0 ? Number((judgeScores.reduce((a, b) => a + b.tone, 0) / judgeScores.length).toFixed(2)) : 0;
  const meanActionability = judgeScores.length > 0 ? Number((judgeScores.reduce((a, b) => a + b.actionability, 0) / judgeScores.length).toFixed(2)) : 0;
  const meanOverallJudge = judgeScores.length > 0 ? Number((judgeScores.reduce((a, b) => a + b.overallScore, 0) / judgeScores.length).toFixed(2)) : 0;

  console.log('\n\n===============================================================');
  console.log('                      EVALUATION RESULTS                       ');
  console.log('===============================================================\n');

  console.log(`[Classification Metrics]`);
  console.log(`- Intent Accuracy: ${(classMetrics.accuracy * 100).toFixed(1)}%`);
  console.log(`- Macro F1: ${classMetrics.macroF1}`);
  console.log(`- Macro Precision: ${classMetrics.macroPrecision}`);
  console.log(`- Macro Recall: ${classMetrics.macroRecall}\n`);

  console.log(`[Escalation Decision Metrics]`);
  console.log(`- Accuracy: ${(binaryMetrics.accuracy * 100).toFixed(1)}%`);
  console.log(`- Precision: ${binaryMetrics.precision}`);
  console.log(`- Recall: ${binaryMetrics.recall}`);
  console.log(`- F1 Score: ${binaryMetrics.f1}`);
  console.log(`- Confusion Matrix: TP=${binaryMetrics.truePositives}, FP=${binaryMetrics.falsePositives}, TN=${binaryMetrics.trueNegatives}, FN=${binaryMetrics.falseNegatives}\n`);

  console.log(`[Retrieval Grounding Metrics]`);
  console.log(`- Retrieval Hit-Rate (sim >= 0.55): ${retrievalHitRate}%`);
  console.log(`- Average Pipeline Latency: ${avgLatency} ms\n`);

  console.log(`[LLM-as-a-Judge Quality Metrics (1-5 Scale)]`);
  console.log(`- Groundedness: ${meanGroundedness} / 5.0`);
  console.log(`- Technical Correctness: ${meanCorrectness} / 5.0`);
  console.log(`- Tone & Empathy: ${meanTone} / 5.0`);
  console.log(`- Actionability: ${meanActionability} / 5.0`);
  console.log(`- Overall Judge Score: ${meanOverallJudge} / 5.0\n`);

  // Failure Analysis extraction
  const failureCases = [];
  for (let i = 0; i < sample.length; i++) {
    const isIntentWrong = groundTruthIntents[i] !== predictedIntents[i];
    const isEscalateWrong = groundTruthEscalates[i] !== predictedEscalates[i];
    if (isIntentWrong || isEscalateWrong) {
      failureCases.push({
        id: sample[i].threadId,
        message: sample[i].customerMessage,
        expectedIntent: groundTruthIntents[i],
        predictedIntent: predictedIntents[i],
        expectedEscalate: groundTruthEscalates[i],
        predictedEscalate: predictedEscalates[i],
        escalationReason: pipelineOutputs[i].escalationReason,
        reply: pipelineOutputs[i].reply,
      });
    }
  }

  console.log(`Identified ${failureCases.length} failure cases for qualitative analysis.`);

  const evalSummary = {
    timestamp: new Date().toISOString(),
    sampleSize: sample.length,
    classification: classMetrics,
    escalation: binaryMetrics,
    retrievalHitRate,
    avgLatencyMs: avgLatency,
    judgeScores: {
      groundedness: meanGroundedness,
      correctness: meanCorrectness,
      tone: meanTone,
      actionability: meanActionability,
      overall: meanOverallJudge,
    },
    failureCases: failureCases.slice(0, 10),
  };

  fs.writeFileSync('data/processed/eval_results.json', JSON.stringify(evalSummary, null, 2));
  console.log('Saved evaluation results to data/processed/eval_results.json');

  // Insert into Neon Database eval_runs table
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    await client.query(
      `
      INSERT INTO eval_runs (
        id, "runType", "sampleSize", "intentAccuracy", "intentMacroF1", 
        "escalationPrecision", "escalationRecall", "escalationF1", 
        "retrievalHitRate", "judgeGroundedness", "judgeCorrectness", 
        "judgeTone", "judgeActionability", "judgeOverallMean", "details", "createdAt"
      ) VALUES (
        gen_random_uuid(), 'full_pipeline', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()
      )
      `,
      [
        sample.length,
        classMetrics.accuracy,
        classMetrics.macroF1,
        binaryMetrics.precision,
        binaryMetrics.recall,
        binaryMetrics.f1,
        retrievalHitRate,
        meanGroundedness,
        meanCorrectness,
        meanTone,
        meanActionability,
        meanOverallJudge,
        JSON.stringify(evalSummary),
      ]
    );

    await client.end();
    console.log('Logged evaluation run to Neon database eval_runs table!');
  } catch (err: any) {
    console.warn('Note on saving to eval_runs DB:', err.message);
  }

  return evalSummary;
}

if (process.argv[1]?.endsWith('runEval.ts')) {
  const size = process.argv[2] ? parseInt(process.argv[2], 10) : 15;
  runEvaluation(size).catch(console.error);
}
