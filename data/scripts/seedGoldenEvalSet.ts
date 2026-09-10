import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import pg from 'pg';
import { INTENT_KEYS, IntentKey } from '../../src/taxonomy/intents';

const { Client } = pg;

export interface GoldenRecord {
  threadId: string;
  customerMessage: string;
  groundTruthIntent: IntentKey;
  groundTruthEscalate: boolean;
  escalationReason: string;
  referenceReply: string;
  notes?: string;
}

export async function seedGoldenSet() {
  const candidatesPath = path.resolve('data/processed/eval_candidates.json');
  const allThreadsPath = path.resolve('data/processed/all_threads.json');
  const jsonlPath = path.resolve('data/processed/golden_eval_set.jsonl');

  let rawCandidates: Array<{
    thread_id: string;
    initial_message: string;
    resolution_reply: string;
  }> = [];

  if (fs.existsSync(candidatesPath)) {
    rawCandidates = JSON.parse(fs.readFileSync(candidatesPath, 'utf-8'));
  }

  if (fs.existsSync(allThreadsPath)) {
    const allThreads = JSON.parse(fs.readFileSync(allThreadsPath, 'utf-8'));
    const existingIds = new Set(rawCandidates.map(c => c.thread_id));
    for (const t of allThreads) {
      if (!existingIds.has(t.thread_id)) {
        rawCandidates.push(t);
      }
    }
  }

  console.log(`Loaded ${rawCandidates.length} potential candidate threads for golden dataset curation.`);

  // Stratified heuristic matcher & manual curation classifier
  function inferGroundTruth(text: string, reply: string): {
    intent: IntentKey;
    escalate: boolean;
    reason: string;
    notes?: string;
  } {
    const lower = text.toLowerCase();

    // 1. Human Escalation Triggers (Legal, Fraud, Direct Human Demand, Stolen/Hacked)
    if (
      /\b(lawyer|attorney|lawsuit|sue|fraud|police|unauthorized charge|speak to a human|real person|real human|phone number|call me|stolen|hacked)\b/i.test(lower)
    ) {
      const isSecurity = /hacked|stolen|unauthorized/i.test(lower);
      return {
        intent: 'human_escalation_required',
        escalate: true,
        reason: isSecurity
          ? 'Security & Account Safety: User reports account compromise or unauthorized access'
          : 'Explicit escalation trigger: Legal threat, fraud report, or direct human representative request',
        notes: 'Mandatory human handoff required',
      };
    }

    // 2. Account Access
    if (
      /\b(password|reset|log in|login|sign in|cant log in|can't log in|forgot password|locked out|verification code|email change)\b/i.test(lower)
    ) {
      return {
        intent: 'account_access',
        escalate: false,
        reason: 'Auto-handled: Self-service password reset and credential recovery workflow in KB',
        notes: 'Account credential assistance',
      };
    }

    // 3. Subscription & Billing
    if (
      /\b(payment|charged|charge|refund|billing|subscription|premium|student discount|family plan|receipt|invoice|double charge|card)\b/i.test(lower)
    ) {
      const isDispute = /refund|double charge|unauthorized charge|cancel/i.test(lower);
      return {
        intent: 'subscription_billing',
        escalate: isDispute,
        reason: isDispute
          ? 'Escalated: Billing dispute or refund request requiring account transaction audit'
          : 'Auto-handled: Subscription plan update, payment method, or discount verification',
        notes: isDispute ? 'Financial dispute escalation' : 'Billing query',
      };
    }

    // 4. Offline & Download
    if (
      /\b(download|downloaded|offline|sd card|sync|syncing|greyed out downloads)\b/i.test(lower)
    ) {
      return {
        intent: 'offline_download',
        escalate: false,
        reason: 'Auto-handled: Offline storage clearing and download sync troubleshooting in KB',
        notes: 'Offline listening procedure',
      };
    }

    // 5. Content Availability
    if (
      /\b(missing|not available|greyed out|grey out|licensing|catalog|album removed|song removed|explicit filter|track gone)\b/i.test(lower) ||
      /where have all my saved.*gone|song isn't playing/i.test(lower)
    ) {
      return {
        intent: 'content_availability',
        escalate: false,
        reason: 'Auto-handled: Regional catalog licensing restrictions and missing track explanation in KB',
        notes: 'Content rights inquiry',
      };
    }

    // 6. App Bug & Crash
    if (
      /\b(crash|crashes|crashing|freeze|frozen|freezes|bugfest|black screen|error code|wont open|not opening|glitch)\b/i.test(lower)
    ) {
      return {
        intent: 'app_bug_crash',
        escalate: false,
        reason: 'Auto-handled: Clean app reinstallation and OS permission cache clear guidance in KB',
        notes: 'Technical application bug',
      };
    }

    // 7. Feature Request
    if (
      /\b(feature|wish you|please add|can you add|option to|would be great|sleep timer|folder|sort|playlist picture)\b/i.test(lower)
    ) {
      return {
        intent: 'feature_request',
        escalate: false,
        reason: 'Auto-handled: Feature suggestion logged & redirected to Spotify Community Ideaboard',
        notes: 'Product feedback & feature request',
      };
    }

    // 8. Playback Issue
    if (
      /\b(shuffle|repeat|pause|skip|skipping|stutter|cutting out|buffering|no sound|volume|playback)\b/i.test(lower) ||
      (/\b(play|playing|plays)\b/i.test(lower) && !/\b(playlist|webplayer)\b/i.test(lower))
    ) {
      return {
        intent: 'playback_issue',
        escalate: false,
        reason: 'Auto-handled: Standard playback buffer reset and audio output settings in KB',
        notes: 'Audio playback controls',
      };
    }

    // 9. Feedback & Complaint (Default)
    return {
      intent: 'feedback_complaint',
      escalate: false,
      reason: 'Auto-handled: General customer sentiment & brand feedback acknowledgment',
      notes: 'Customer sentiment & brand feedback',
    };
  }

  // Bucket candidate records
  const intentBuckets: Record<IntentKey, typeof rawCandidates> = {
    playback_issue: [],
    offline_download: [],
    content_availability: [],
    subscription_billing: [],
    account_access: [],
    app_bug_crash: [],
    feature_request: [],
    feedback_complaint: [],
    human_escalation_required: [],
  };

  for (const c of rawCandidates) {
    if (!c.initial_message || !c.resolution_reply) continue;
    const inferred = inferGroundTruth(c.initial_message, c.resolution_reply);
    intentBuckets[inferred.intent].push(c);
  }

  console.log('\nCandidate distribution across categories:');
  for (const [intent, list] of Object.entries(intentBuckets)) {
    console.log(`- ${intent}: ${list.length} candidate threads`);
  }

  // Balanced target counts for 165 total golden records (>150 required)
  const targets: Record<IntentKey, number> = {
    playback_issue: 22,
    offline_download: 18,
    content_availability: 16,
    subscription_billing: 22,
    account_access: 20,
    app_bug_crash: 18,
    feature_request: 16,
    feedback_complaint: 16,
    human_escalation_required: 17,
  };

  const goldenRecords: GoldenRecord[] = [];
  const usedIds = new Set<string>();

  const bucketQueues: Record<IntentKey, typeof rawCandidates> = {} as any;
  for (const intent of INTENT_KEYS) {
    bucketQueues[intent] = intentBuckets[intent].slice(0, targets[intent]);
  }

  let added = true;
  while (added) {
    added = false;
    for (const intent of INTENT_KEYS) {
      const item = bucketQueues[intent].shift();
      if (item && !usedIds.has(item.thread_id)) {
        added = true;
        usedIds.add(item.thread_id);
        const { escalate, reason, notes } = inferGroundTruth(item.initial_message, item.resolution_reply);
        goldenRecords.push({
          threadId: item.thread_id,
          customerMessage: item.initial_message,
          groundTruthIntent: intent,
          groundTruthEscalate: escalate,
          escalationReason: reason,
          referenceReply: item.resolution_reply,
          notes,
        });
      }
    }
  }

  console.log(`\nCurated ${goldenRecords.length} golden labeled evaluation examples (round-robin stratified across 9 intents).`);
  const escalations = goldenRecords.filter(r => r.groundTruthEscalate);
  console.log(`Ground truth escalation count: ${escalations.length} (${((escalations.length / goldenRecords.length) * 100).toFixed(1)}%)`);

  // Write to JSONL
  const jsonlContent = goldenRecords.map(r => JSON.stringify(r)).join('\n');
  fs.writeFileSync(jsonlPath, jsonlContent);
  console.log(`Wrote ${goldenRecords.length} golden eval records to ${jsonlPath}`);

  // Insert into Neon Database golden_eval_labels table
  if (process.env.DATABASE_URL) {
    console.log('Inserting records into Neon PostgreSQL database golden_eval_labels table...');
    const client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();

    for (const rec of goldenRecords) {
      await client.query(
        `
        INSERT INTO golden_eval_labels ("id", "threadId", "customerMessage", "groundTruthIntent", "groundTruthEscalate", "escalationReason", "referenceReply", "notes", "createdAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT ("threadId") DO UPDATE
        SET "customerMessage" = EXCLUDED."customerMessage",
            "groundTruthIntent" = EXCLUDED."groundTruthIntent",
            "groundTruthEscalate" = EXCLUDED."groundTruthEscalate",
            "escalationReason" = EXCLUDED."escalationReason",
            "referenceReply" = EXCLUDED."referenceReply",
            "notes" = EXCLUDED."notes"
        `,
        [rec.threadId, rec.customerMessage, rec.groundTruthIntent, rec.groundTruthEscalate, rec.escalationReason, rec.referenceReply, rec.notes || null]
      );
    }

    await client.end();
    console.log('Golden eval set successfully seeded in Neon PostgreSQL!');
  }
}

if (process.argv[1]?.endsWith('seedGoldenEvalSet.ts')) {
  seedGoldenSet().catch(console.error);
}
