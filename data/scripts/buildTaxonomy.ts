import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ConversationThread } from './cleanAndThread';

interface SampledItem {
  id: string;
  text: string;
  embedding?: number[];
  cluster?: number;
}

// Simple cosine distance
function cosineDistance(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return 1 - dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-9);
}

// Basic K-Means clustering in pure TypeScript
function kMeans(data: SampledItem[], k: number, maxIters = 30): { centroids: number[][]; clusters: SampledItem[][] } {
  const dim = data[0].embedding!.length;

  // Initialize centroids using k-means++ style spread
  const centroids: number[][] = [];
  centroids.push([...data[Math.floor(Math.random() * data.length)].embedding!]);

  while (centroids.length < k) {
    const distances = data.map(item => {
      const minDist = Math.min(...centroids.map(c => cosineDistance(item.embedding!, c)));
      return minDist * minDist;
    });
    const sumDist = distances.reduce((a, b) => a + b, 0);
    let r = Math.random() * sumDist;
    let chosenIndex = 0;
    for (let i = 0; i < distances.length; i++) {
      r -= distances[i];
      if (r <= 0) {
        chosenIndex = i;
        break;
      }
    }
    centroids.push([...data[chosenIndex].embedding!]);
  }

  // Iterate
  let clusters: SampledItem[][] = Array.from({ length: k }, () => []);

  for (let iter = 0; iter < maxIters; iter++) {
    clusters = Array.from({ length: k }, () => []);

    // Assign to nearest centroid
    for (const item of data) {
      let bestCluster = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const d = cosineDistance(item.embedding!, centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          bestCluster = c;
        }
      }
      item.cluster = bestCluster;
      clusters[bestCluster].push(item);
    }

    // Recompute centroids
    let shift = 0;
    for (let c = 0; c < k; c++) {
      if (clusters[c].length === 0) continue;
      const newCentroid = new Array(dim).fill(0);
      for (const item of clusters[c]) {
        for (let d = 0; d < dim; d++) {
          newCentroid[d] += item.embedding![d];
        }
      }
      for (let d = 0; d < dim; d++) {
        newCentroid[d] /= clusters[c].length;
      }
      shift += cosineDistance(centroids[c], newCentroid);
      centroids[c] = newCentroid;
    }

    if (shift < 1e-4) break;
  }

  return { centroids, clusters };
}

async function runTaxonomyClustering() {
  const threadsPath = path.resolve('data/processed/knowledge_base.json');
  if (!fs.existsSync(threadsPath)) {
    throw new Error(`knowledge_base.json not found at ${threadsPath}. Run cleanAndThread.ts first.`);
  }

  const threads: ConversationThread[] = JSON.parse(fs.readFileSync(threadsPath, 'utf-8'));
  console.log(`Loaded ${threads.length} threads. Sampling 250 real customer messages for clustering...`);

  // Filter out messages that are too short or just tags
  const validCandidates = threads.filter(t => t.initial_message.length >= 25 && !t.initial_message.startsWith('@user @user @user'));

  // Deterministic sample of 250 items
  const sampled: SampledItem[] = validCandidates.slice(0, 250).map(t => ({
    id: t.thread_id,
    text: t.initial_message,
  }));

  console.log(`Generating embeddings for ${sampled.length} messages using Gemini embedding model...`);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not defined in .env');

  const genAI = new GoogleGenerativeAI(apiKey);
  const embModel = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });

  // Batch embed with small delay to respect rate limits
  const batchSize = 10;
  for (let i = 0; i < sampled.length; i += batchSize) {
    const batch = sampled.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async item => {
        try {
          const res = await embModel.embedContent({
            content: { role: 'user', parts: [{ text: item.text }] },
            outputDimensionality: 768,
          } as any);
          item.embedding = res.embedding.values;
        } catch (err: any) {
          console.error(`Error embedding item ${item.id}:`, err.message);
        }
      })
    );
    process.stdout.write(`Embedded ${Math.min(i + batchSize, sampled.length)}/${sampled.length}...\r`);
    await new Promise(r => setTimeout(r, 200)); // rate limiting delay
  }

  const validEmbedded = sampled.filter(s => s.embedding && s.embedding.length > 0);
  console.log(`\nSuccessfully embedded ${validEmbedded.length} messages. Running K-Means (k=12)...`);

  const k = 12;
  const { centroids, clusters } = kMeans(validEmbedded, k, 40);

  console.log('\n======================================================');
  console.log('         EMPIRICAL CLUSTER ANALYSIS (k=12)            ');
  console.log('======================================================\n');

  const clusterSummaries = [];

  for (let c = 0; c < k; c++) {
    const items = clusters[c];
    if (items.length === 0) continue;

    // Sort items by closeness to centroid
    items.sort((a, b) => cosineDistance(a.embedding!, centroids[c]) - cosineDistance(b.embedding!, centroids[c]));

    console.log(`--- Cluster ${c + 1} (${items.length} messages) ---`);
    console.log('Top Representative Messages:');
    const examples = items.slice(0, 5).map(it => it.text);
    examples.forEach((ex, idx) => console.log(`  ${idx + 1}. "${ex}"`));
    console.log('');

    clusterSummaries.push({
      clusterId: c + 1,
      size: items.length,
      examples,
    });
  }

  // Save clustering results to data/processed/clusters.json
  fs.writeFileSync('data/processed/clusters.json', JSON.stringify(clusterSummaries, null, 2));
  console.log('Clustering results saved to data/processed/clusters.json');
}

runTaxonomyClustering().catch(console.error);
