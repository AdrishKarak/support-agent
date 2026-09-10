import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import pg from 'pg';
import { runTrivialBaseline } from './trivialBaseline';
import { runZeroShotBaseline } from './zeroShotBaseline';
import { computeClassificationMetrics, computeBinaryMetrics } from '../metricsHelper';
import { evaluateReplyWithJudge } from '../judgeHelper';

const { Client } = pg;

export async function runAllBaselines(sampleSize = 40) {
  const goldenPath = path.resolve('data/processed/golden_eval_set.jsonl');
  if (!fs.existsSync(goldenPath)) {
    throw new Error(`Golden eval set not found at ${goldenPath}`);
  }

  const lines = fs.readFileSync(goldenPath, 'utf-8').trim().split('\n').filter(Boolean);
  const sample = lines.map(l => JSON.parse(l)).slice(0, sampleSize);
  console.log(`\nEvaluating Baselines on ${sample.length} golden eval examples...\n`);

  const groundTruthIntents = sample.map(s => s.groundTruthIntent);
  const groundTruthEscalates = sample.map(s => s.groundTruthEscalate);

  // 1. Trivial Baseline Evaluation
  console.log('--- Running Baseline 1: Trivial (Keyword + Canned Reply) ---');
  const trivialPredictions = sample.map(s => runTrivialBaseline(s.customerMessage));
  const trivialIntents = trivialPredictions.map(p => p.intent);
  const trivialEscalates = trivialPredictions.map(p => p.escalate);

  const trivialClassMetrics = computeClassificationMetrics(groundTruthIntents, trivialIntents);
  const trivialEscalateMetrics = computeBinaryMetrics(groundTruthEscalates, trivialEscalates);

  // Sample judge scoring for trivial replies (first 10)
  let trivialJudgeTotal = 0;
  for (let i = 0; i < 10; i++) {
    const s = sample[i];
    const j = await evaluateReplyWithJudge(
      s.customerMessage,
      'No retrieval used (canned baseline template)',
      trivialPredictions[i].reply,
      s.referenceReply
    );
    trivialJudgeTotal += j.overallScore;
  }
  const trivialJudgeMean = Number((trivialJudgeTotal / 10).toFixed(2));

  console.log(`Trivial Baseline Results:`);
  console.log(`- Intent Accuracy: ${(trivialClassMetrics.accuracy * 100).toFixed(1)}%`);
  console.log(`- Intent Macro F1: ${trivialClassMetrics.macroF1}`);
  console.log(`- Escalation Precision: ${trivialEscalateMetrics.precision}, Recall: ${trivialEscalateMetrics.recall}, F1: ${trivialEscalateMetrics.f1}`);
  console.log(`- Judge Overall Score: ${trivialJudgeMean}/5.0\n`);

  // 2. Zero-Shot Baseline Evaluation (no retrieval)
  console.log('--- Running Baseline 2: Zero-Shot (LLM Classify + Reply with NO Retrieval) ---');
  const zeroShotPredictions = [];
  let zeroShotJudgeTotal = 0;

  for (let i = 0; i < sample.length; i++) {
    const s = sample[i];
    const pred = await runZeroShotBaseline(s.customerMessage);
    zeroShotPredictions.push(pred);

    if (i < 10) {
      const j = await evaluateReplyWithJudge(
        s.customerMessage,
        'None (Zero-shot ungrounded generation)',
        pred.reply,
        s.referenceReply
      );
      zeroShotJudgeTotal += j.overallScore;
    }
    process.stdout.write(`Zero-Shot progress: ${i + 1}/${sample.length}...\r`);
    await new Promise(r => setTimeout(r, 150));
  }

  const zeroShotIntents = zeroShotPredictions.map(p => p.intent);
  const zeroShotEscalates = zeroShotPredictions.map(p => p.escalate);

  const zeroShotClassMetrics = computeClassificationMetrics(groundTruthIntents, zeroShotIntents);
  const zeroShotEscalateMetrics = computeBinaryMetrics(groundTruthEscalates, zeroShotEscalates);
  const zeroShotJudgeMean = Number((zeroShotJudgeTotal / 10).toFixed(2));

  console.log(`\nZero-Shot Baseline Results:`);
  console.log(`- Intent Accuracy: ${(zeroShotClassMetrics.accuracy * 100).toFixed(1)}%`);
  console.log(`- Intent Macro F1: ${zeroShotClassMetrics.macroF1}`);
  console.log(`- Escalation Precision: ${zeroShotEscalateMetrics.precision}, Recall: ${zeroShotEscalateMetrics.recall}, F1: ${zeroShotEscalateMetrics.f1}`);
  console.log(`- Judge Overall Score: ${zeroShotJudgeMean}/5.0\n`);

  const results = {
    sampleSize: sample.length,
    trivialBaseline: {
      metrics: trivialClassMetrics,
      escalation: trivialEscalateMetrics,
      judgeScore: trivialJudgeMean,
    },
    zeroShotBaseline: {
      metrics: zeroShotClassMetrics,
      escalation: zeroShotEscalateMetrics,
      judgeScore: zeroShotJudgeMean,
    },
  };

  fs.writeFileSync('data/processed/baseline_results.json', JSON.stringify(results, null, 2));

  // Save to DB eval_runs
  try {
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    await client.query(
      `
      INSERT INTO eval_runs (id, "runType", "sampleSize", "intentAccuracy", "intentMacroF1", "escalationPrecision", "escalationRecall", "escalationF1", "judgeOverallMean", "details", "createdAt")
      VALUES 
      (gen_random_uuid(), 'trivial_baseline', $1, $2, $3, $4, $5, $6, $7, $8, NOW()),
      (gen_random_uuid(), 'zero_shot_baseline', $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      `,
      [
        sample.length, trivialClassMetrics.accuracy, trivialClassMetrics.macroF1, trivialEscalateMetrics.precision, trivialEscalateMetrics.recall, trivialEscalateMetrics.f1, trivialJudgeMean, JSON.stringify(trivialClassMetrics),
        sample.length, zeroShotClassMetrics.accuracy, zeroShotClassMetrics.macroF1, zeroShotEscalateMetrics.precision, zeroShotEscalateMetrics.recall, zeroShotEscalateMetrics.f1, zeroShotJudgeMean, JSON.stringify(zeroShotClassMetrics)
      ]
    );

    await client.end();
  } catch (err: any) {
    console.warn('Note on writing eval_runs to DB:', err.message);
  }

  return results;
}

if (process.argv[1]?.endsWith('runBaselines.ts')) {
  runAllBaselines(40).catch(console.error);
}
