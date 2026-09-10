import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { INTENTS, INTENT_KEYS } from '../../src/taxonomy/intents';

interface GoldenExample {
  threadId: string;
  customerMessage: string;
  groundTruthIntent: string;
  groundTruthEscalate: boolean;
  escalationReason: string;
  referenceReply: string;
  notes?: string;
}

async function runInteractiveLabeler() {
  const candidatesPath = path.resolve('data/processed/eval_candidates.json');
  const outputPath = path.resolve('data/processed/golden_eval_set.jsonl');

  if (!fs.existsSync(candidatesPath)) {
    console.error(`Eval candidates file not found at ${candidatesPath}. Run cleanAndThread.ts first.`);
    process.exit(1);
  }

  const candidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf-8'));
  const existingLabels = new Map<string, GoldenExample>();

  if (fs.existsSync(outputPath)) {
    const lines = fs.readFileSync(outputPath, 'utf-8').trim().split('\n').filter(Boolean);
    for (const l of lines) {
      const parsed: GoldenExample = JSON.parse(l);
      existingLabels.set(parsed.threadId, parsed);
    }
  }

  console.log(`Loaded ${candidates.length} candidates. Already labeled: ${existingLabels.size}`);
  console.log('\n--- Interactive Golden Eval Set Labeling Tool ---');
  console.log('Available Intents:');
  INTENT_KEYS.forEach((key, i) => console.log(`  [${i + 1}] ${key} (${INTENTS[key].name})`));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (existingLabels.has(c.thread_id)) continue;

    console.log(`\n======================================================`);
    console.log(`[Candidate ${i + 1}/${candidates.length} | Thread ID: ${c.thread_id}]`);
    console.log(`Customer Message:\n"${c.initial_message}"`);
    console.log(`Original Brand Reply:\n"${c.resolution_reply}"`);

    const intentChoice = await ask('\nSelect Intent (1-9) or type intent name (or "s" to skip, "q" to quit): ');
    if (intentChoice.trim().toLowerCase() === 'q') break;
    if (intentChoice.trim().toLowerCase() === 's') continue;

    const num = parseInt(intentChoice.trim(), 10);
    const chosenIntent = (!isNaN(num) && num >= 1 && num <= 9)
      ? INTENT_KEYS[num - 1]
      : intentChoice.trim();

    const escalateChoice = await ask('Should Escalate? [y/N]: ');
    const shouldEscalate = escalateChoice.trim().toLowerCase() === 'y';

    let escalationReason = '';
    if (shouldEscalate) {
      escalationReason = await ask('Escalation Reason: ');
    } else {
      escalationReason = 'Auto-handled: Standard troubleshooting procedure available in KB';
    }

    const notes = await ask('Optional Notes (press Enter to skip): ');

    const newLabel: GoldenExample = {
      threadId: c.thread_id,
      customerMessage: c.initial_message,
      groundTruthIntent: chosenIntent,
      groundTruthEscalate: shouldEscalate,
      escalationReason: escalationReason.trim(),
      referenceReply: c.resolution_reply,
      notes: notes.trim() || undefined,
    };

    existingLabels.set(c.thread_id, newLabel);
    fs.appendFileSync(outputPath, JSON.stringify(newLabel) + '\n');
    console.log(`Saved! Total labeled: ${existingLabels.size}`);
  }

  rl.close();
  console.log(`Labeling session finished. Total golden examples: ${existingLabels.size}`);
}

if (process.argv[1]?.endsWith('labelingTool.ts')) {
  runInteractiveLabeler().catch(console.error);
}
