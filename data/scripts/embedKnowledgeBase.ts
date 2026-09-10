import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import 'dotenv/config';
import pg from 'pg';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConversationThread } from './cleanAndThread';

const { Client } = pg;

export interface KnowledgeBaseEntry {
  id: string;
  threadId: string;
  question: string;
  answer: string;
  embedding: number[];
  brand: string;
  metadata: {
    turn_count: number;
    brand: string;
  };
}

function computeHash(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

export async function embedAndIndexKnowledgeBase(limit = 600) {
  const jsonlPath = path.resolve('data/processed/knowledge_base.jsonl');
  if (!fs.existsSync(jsonlPath)) {
    throw new Error(`Knowledge base file not found at ${jsonlPath}. Run cleanAndThread.ts first.`);
  }

  const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n').filter(Boolean);
  console.log(`Loaded ${lines.length} total KB candidate threads from ${jsonlPath}.`);

  const threads: ConversationThread[] = lines.map(line => JSON.parse(line));
  const targetThreads = threads.slice(0, limit);
  console.log(`Selected ${targetThreads.length} threads for idempotent indexing.`);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is missing in .env');

  const genAI = new GoogleGenerativeAI(apiKey);
  const embModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  console.log('Connected to Neon PostgreSQL.');

  // Fetch existing hashes from DB
  const existingRes = await client.query('SELECT "threadId", "contentHash" FROM knowledge_base_entries');
  const existingMap = new Map<string, string>();
  for (const row of existingRes.rows) {
    existingMap.set(row.threadId, row.contentHash);
  }
  console.log(`Found ${existingMap.size} existing entries in knowledge_base_entries table.`);

  let indexedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < targetThreads.length; i++) {
    const thread = targetThreads[i];
    const contentToEmbed = `Customer: ${thread.initial_message}\nResolution: ${thread.resolution_reply}`;
    const hash = computeHash(contentToEmbed);

    if (existingMap.has(thread.thread_id) && existingMap.get(thread.thread_id) === hash) {
      skippedCount++;
      continue;
    }

    // Embed with retry/backoff
    let embeddingValues: number[] | null = null;
    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
      try {
        const res = await embModel.embedContent({
          content: { role: 'user', parts: [{ text: contentToEmbed }] },
          outputDimensionality: 768,
        } as any);
        embeddingValues = res.embedding.values;
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) {
          console.error(`Failed to embed thread ${thread.thread_id}:`, err.message);
          errorCount++;
          break;
        }
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
      }
    }

    if (embeddingValues) {
      const entry: KnowledgeBaseEntry = {
        id: thread.thread_id,
        threadId: thread.thread_id,
        question: thread.initial_message,
        answer: thread.resolution_reply,
        embedding: embeddingValues,
        brand: thread.brand,
        metadata: {
          turn_count: thread.turn_count,
          brand: thread.brand,
        },
      };
      const vectorStr = `[${entry.embedding.join(',')}]`;
      const metadata = JSON.stringify(entry.metadata);

      // Upsert into DB
      await client.query(
        `
        INSERT INTO knowledge_base_entries ("id", "threadId", "brand", "initialMessage", "resolutionReply", "contentHash", "embedding", "metadata", "createdAt", "updatedAt")
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6::vector, $7::jsonb, NOW(), NOW())
        ON CONFLICT ("threadId") DO UPDATE
        SET "brand" = EXCLUDED."brand",
            "initialMessage" = EXCLUDED."initialMessage",
            "resolutionReply" = EXCLUDED."resolutionReply",
            "contentHash" = EXCLUDED."contentHash",
            "embedding" = EXCLUDED."embedding",
            "metadata" = EXCLUDED."metadata",
            "updatedAt" = NOW()
        `,
        [entry.threadId, entry.brand, entry.question, entry.answer, hash, vectorStr, metadata]
      );

      indexedCount++;
      existingMap.set(thread.thread_id, hash);
    }

    if ((i + 1) % 25 === 0 || i === targetThreads.length - 1) {
      console.log(`Progress: ${i + 1}/${targetThreads.length} | Indexed: ${indexedCount} | Skipped: ${skippedCount} | Errors: ${errorCount}`);
    }

    // Rate limiting pause
    await new Promise(r => setTimeout(r, 120));
  }

  await client.end();
  console.log(`\nKnowledge Base indexing complete! Indexed: ${indexedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`);
}

if (process.argv[1]?.endsWith('embedKnowledgeBase.ts')) {
  const limitArg = process.argv[2] ? parseInt(process.argv[2], 10) : 500;
  embedAndIndexKnowledgeBase(limitArg).catch(console.error);
}
