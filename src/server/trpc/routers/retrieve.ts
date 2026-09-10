import { z } from 'zod';
import { publicProcedure } from '../trpc';
import { embedQuery } from '@/server/llm/gemini';
import pg from 'pg';
import { BRAND_KEYS, BrandKey, DEFAULT_BRAND } from '@/brands';

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
  query: z.string().min(1),
  topK: z.number().optional().default(3),
  brand: z.enum(BRAND_KEYS).default(DEFAULT_BRAND),
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
  topK = 3,
  brand: BrandKey = DEFAULT_BRAND
): Promise<RetrieveResult> {
  const pool = getDbPool();

  // 1. Generate 768-dim query embedding
  const queryEmbedding = await embedQuery(query);
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
      AND (brand = $3 OR metadata->>'brand' = $3)
    ORDER BY embedding <=> $1::vector ASC
    LIMIT $2;
  `;

  const res = await pool.query(queryText, [vectorStr, topK, brand]);

  const threads: RetrievedThread[] = res.rows.map(row => ({
    threadId: row.threadId,
    initialMessage: row.initialMessage,
    resolutionReply: row.resolutionReply,
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
    return await retrieveSimilarThreadsCore(input.query, input.topK, input.brand);
  });
