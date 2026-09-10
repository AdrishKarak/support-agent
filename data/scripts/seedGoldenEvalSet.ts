import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import pg from 'pg';
import { INTENTS, INTENT_KEYS, IntentKey } from '../../src/taxonomy/intents';

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
  const jsonlPath = path.resolve('data/processed/golden_eval_set.jsonl');

  if (!fs.existsSync(candidatesPath)) {
    throw new Error(`Eval candidates not found at ${candidatesPath}`);
  }

  const rawCandidates: Array<{
    thread_id: string;
    initial_message: string;
    resolution_reply: string;
  }> = JSON.parse(fs.readFileSync(candidatesPath, 'utf-8'));

  console.log(`Loaded ${rawCandidates.length} eval candidate threads.`);

  // Stratified keyword/heuristic matcher with manual curated edge cases
  const goldenRecords: GoldenRecord[] = [];
  const usedIds = new Set<string>();

  // Helper to categorize accurately
  function inferGroundTruth(text: string, reply: string): {
    intent: IntentKey;
    escalate: boolean;
    reason: string;
    notes?: string;
  } {
    const lower = text.toLowerCase();

    // 1. Human Escalation Triggers
    if (
      /\b(lawyer|attorney|lawsuit|sue|fraud|police|unauthorized charge|speak to a human|real person|real human|phone number|call me)\b/i.test(lower)
    ) {
      return {
        intent: 'human_escalation_required',
        escalate: true,
        reason: 'Explicit escalation trigger: legal threat, fraud, or direct demand for human specialist',
        notes: 'Edge case: high-urgency escalation',
      };
    }

    // 2. Account Access & Security
    if (
      /\b(hacked|stolen account|compromised|changed my email|reset my password|password|log in|login|sign in|can’t get back in|cant get back in)\b/i.test(lower)
    ) {
      const isHacked = /hacked|stolen|someone changed/i.test(lower);
      return {
        intent: 'account_access',
        escalate: isHacked, // hacked accounts require escalation, regular password resets can be auto-handled
        reason: isHacked
          ? 'Security alert: user reports compromised or hacked account'
          : 'Auto-handled: password reset or account lookup troubleshooting available in KB',
        notes: isHacked ? 'Security escalation' : 'Standard account guidance',
      };
    }

    // 3. Subscription & Billing
    if (
      /\b(payment|charged|charge|refund|billing|subscription|premium|student discount|family plan|card)\b/i.test(lower)
    ) {
      const isDispute = /refund|double charge|unauthorized/i.test(lower);
      return {
        intent: 'subscription_billing',
        escalate: isDispute,
        reason: isDispute
          ? 'Escalated: customer reports financial dispute or refund demand requiring billing verification'
          : 'Auto-handled: standard payment method update or discount verification workflow',
        notes: isDispute ? 'Financial escalation' : 'Billing troubleshooting',
      };
    }

    // 4. Offline & Download
    if (
      /\b(download|downloaded|offline|sd card|sync|syncing)\b/i.test(lower)
    ) {
      return {
        intent: 'offline_download',
        escalate: false,
        reason: 'Auto-handled: verified cache and offline download troubleshooting procedure in KB',
        notes: 'Standard offline procedure',
      };
    }

    // 5. Content Availability
    if (
      /\b(missing|not available|greyed out|grey out|licensing|catalog|album removed|song removed)\b/i.test(lower) ||
      /disappointed there was no|gone.*vanished|where have all my saved.*gone/i.test(lower)
    ) {
      return {
        intent: 'content_availability',
        escalate: false,
        reason: 'Auto-handled: music licensing / catalog availability guidance provided',
        notes: 'Catalog inquiry',
      };
    }

    // 6. App Bug & Crash
    if (
      /\b(crash|crashes|crashing|freeze|frozen|freezes|bugfest|black screen|error code|wont open|not opening)\b/i.test(lower)
    ) {
      return {
        intent: 'app_bug_crash',
        escalate: false,
        reason: 'Auto-handled: app reinstallation or device cache clear troubleshooting available',
        notes: 'Technical bug handling',
      };
    }

    // 7. Feature Request
    if (
      /\b(feature|wish you|please add|can you add|option to|would be great|sleep timer|folder|sort)\b/i.test(lower) ||
      /personalized playlist|create a.*playlist|hide.*playlist|change the picture.*playlist/i.test(lower)
    ) {
      return {
        intent: 'feature_request',
        escalate: false,
        reason: 'Auto-handled: feature request logged or community ideaboard redirected',
        notes: 'Product feedback',
      };
    }

    // 8. Playback Issue
    if (
      /\b(shuffle|repeat|pause|skip|skipping|stutter|cutting out|buffering|no sound|volume)\b/i.test(lower) ||
      (/\b(play|playing|plays|played)\b/i.test(lower) && !/\b(playlist|webplayer|player)\b/i.test(lower))
    ) {
      return {
        intent: 'playback_issue',
        escalate: false,
        reason: 'Auto-handled: standard restart and playback settings troubleshooting in KB',
        notes: 'Playback controls',
      };
    }

    // 9. Feedback & Complaint (Default fallback)
    return {
      intent: 'feedback_complaint',
      escalate: false,
      reason: 'Auto-handled: acknowledge customer feedback and brand experience',
      notes: 'General sentiment/comment',
    };
  }

  // Group candidates into buckets to ensure balanced representation
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
    const inferred = inferGroundTruth(c.initial_message, c.resolution_reply);
    intentBuckets[inferred.intent].push(c);
  }

  console.log('\nCandidate distribution across categories:');
  for (const [intent, list] of Object.entries(intentBuckets)) {
    console.log(`- ${intent}: ${list.length} candidates`);
  }

  // Balanced target counts
  const targets: Record<IntentKey, number> = {
    playback_issue: 26,
    offline_download: 22,
    content_availability: 25,
    subscription_billing: 26,
    account_access: 24,
    app_bug_crash: 25,
    feature_request: 18,
    feedback_complaint: 18,
    human_escalation_required: 16,
  };

  // Round-robin interleave across all 9 intent buckets so ANY prefix slice (e.g. first 15, 20, 50) is strictly stratified!
  const bucketQueues: Record<IntentKey, typeof rawCandidates> = {} as any;
  for (const intent of INTENT_KEYS) {
    bucketQueues[intent] = intentBuckets[intent].slice(0, targets[intent]);
  }

  let added = true;
  while (added) {
    added = false;
    for (const intent of INTENT_KEYS) {
      const item = bucketQueues[intent].shift();
      if (item) {
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

  console.log(`\nCurated ${goldenRecords.length} balanced golden examples with round-robin stratification.`);
  const escalations = goldenRecords.filter(r => r.groundTruthEscalate);
  console.log(`Ground truth escalation count: ${escalations.length} (${((escalations.length / goldenRecords.length) * 100).toFixed(1)}%)`);

  // Write to JSONL
  const jsonlContent = goldenRecords.map(r => JSON.stringify(r)).join('\n');
  fs.writeFileSync(jsonlPath, jsonlContent);
  console.log(`Wrote golden eval set to ${jsonlPath}`);

  // Insert into Neon Database golden_eval_labels table
  console.log('Inserting into Neon database golden_eval_labels table...');
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

if (process.argv[1]?.endsWith('seedGoldenEvalSet.ts')) {
  seedGoldenSet().catch(console.error);
}
