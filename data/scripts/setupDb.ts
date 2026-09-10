import 'dotenv/config';
import pg from 'pg';
import { execSync } from 'node:child_process';

const { Client } = pg;

export async function setupDatabase() {
  console.log('--- Setting up Neon PostgreSQL + pgvector ---');

  // 1. Ensure extension is installed using direct connection
  const connString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const client = new Client({
    connectionString: connString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log('Connected to database.');

  await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
  console.log('Verified vector extension.');

  // 2. Run prisma db push
  console.log('Running prisma db push...');
  execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });

  // 3. Create HNSW index on embedding for vector similarity search
  console.log('Creating HNSW vector index if not exists...');
  try {
    await client.query(`
      CREATE INDEX IF NOT EXISTS kb_embedding_hnsw_idx 
      ON knowledge_base_entries 
      USING hnsw (embedding vector_cosine_ops);
    `);
    console.log('HNSW vector index ready.');
  } catch (err: any) {
    console.warn('Note on index creation:', err.message);
  }

  await client.end();
  console.log('Database schema and HNSW vector index ready.');

  // 4. Seed Golden Eval Set into Neon
  console.log('--- Seeding Golden Eval Set ---');
  const { seedGoldenSet } = await import('./seedGoldenEvalSet');
  await seedGoldenSet();

  // 5. Seed Knowledge Base Embeddings into Neon
  console.log('--- Seeding Knowledge Base Embeddings ---');
  const { embedAndIndexKnowledgeBase } = await import('./embedKnowledgeBase');
  await embedAndIndexKnowledgeBase(300);

  console.log('\n===============================================================');
  console.log('   NEON POSTGRESQL + PGVECTOR SETUP & SEEDING COMPLETE!        ');
  console.log('===============================================================');
}

if (process.argv[1]?.endsWith('setupDb.ts')) {
  setupDatabase().catch(console.error);
}
