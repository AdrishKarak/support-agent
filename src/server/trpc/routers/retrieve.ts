import { z } from 'zod';
import { publicProcedure } from '../trpc';
import { embedQuery } from '@/server/llm/gemini';
import pg from 'pg';
import { redactCustomerText } from '@/server/privacy';

const { Pool } = pg;

let poolInstance: pg.Pool | null = null;

function getDbPool(): pg.Pool {
  if (!poolInstance) {
    const connStr = process.env.DATABASE_URL;
    if (!connStr) throw new Error('DATABASE_URL is not defined in .env');
    poolInstance = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 10,
    });
  }
  return poolInstance;
}

export const RetrieveInputSchema = z.object({
  query: z.string().min(1).max(1000),
  topK: z.number().int().min(1).max(5).optional().default(3),
});

export const RetrievedThreadSchema = z.object({
  threadId: z.string(),
  initialMessage: z.string(),
  resolutionReply: z.string(),
  similarity: z.number(),
});

export const RetrieveOutputSchema = z.object({
  threads: z.array(RetrievedThreadSchema),
  topSimilarity: z.number(),
});

export type RetrievedThread = z.infer<typeof RetrievedThreadSchema>;
export type RetrieveResult = z.infer<typeof RetrieveOutputSchema>;

export async function retrieveSimilarThreadsCore(
  query: string,
  topK = 3
): Promise<RetrieveResult> {
  const pool = getDbPool();

  // 1. Generate 768-dim query embedding
  const queryEmbedding = await embedQuery(redactCustomerText(query));
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  // 2. Perform cosine distance search in Neon pgvector
  const queryText = `
    SELECT 
      "threadId",
      "initialMessage",
      "resolutionReply",
      1 - (embedding <=> $1::vector) as similarity
    FROM knowledge_base_entries
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> $1::vector ASC
    LIMIT $2;
  `;

  const res = await pool.query(queryText, [vectorStr, Math.min(5, Math.max(1, Math.floor(topK)))]);

  const threads: RetrievedThread[] = res.rows.map(row => ({
    threadId: row.threadId,
    // Bound context so a malformed database row cannot dominate the model prompt.
    initialMessage: redactCustomerText(String(row.initialMessage)).slice(0, 1_000),
    resolutionReply: redactCustomerText(String(row.resolutionReply)).slice(0, 1_500),
    similarity: Math.max(0, parseFloat(row.similarity) || 0),
  }));

  const topSimilarity = threads.length > 0 ? threads[0].similarity : 0;

  return {
    threads,
    topSimilarity,
  };
}

export const retrieveRouter = publicProcedure
  .input(RetrieveInputSchema)
  .output(RetrieveOutputSchema)
  .mutation(async ({ input }) => {
    return await retrieveSimilarThreadsCore(input.query, input.topK);
  });
