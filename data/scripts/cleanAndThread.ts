import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';

export interface RawTweet {
  tweet_id: string;
  author_id: string;
  inbound: boolean;
  created_at: string;
  text: string;
  response_tweet_id?: string;
  in_response_to_tweet_id?: string;
}

export interface ThreadMessage {
  tweet_id: string;
  author: 'customer' | 'brand';
  author_id: string;
  text: string;
  created_at: string;
}

export interface ConversationThread {
  thread_id: string;
  brand: string;
  initial_message: string;
  resolution_reply: string;
  turn_count: number;
  is_resolved: boolean;
  messages: ThreadMessage[];
}

// PII Stripping Function
export function sanitizeText(raw: string): string {
  let text = raw;
  // 1. Remove/normalize user handles like @115887, @SpotifyCares, etc.
  text = text.replace(/@SpotifyCares\b/gi, '__SUPPORT_TAG__');
  text = text.replace(/@\d+\b/g, '@user');
  text = text.replace(/@[A-Za-z0-9_]+\b/g, '@user');
  text = text.replace(/__SUPPORT_TAG__/g, '@support');

  // 2. Mask email addresses
  text = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');

  // 3. Mask phone numbers
  text = text.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, '[PHONE]');

  // 4. Normalize URLs (t.co links)
  text = text.replace(/https?:\/\/t\.co\/[A-Za-z0-9]+/g, '[LINK]');

  // 5. Clean excessive whitespaces
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

async function runThreadReconstruction(targetBrand = 'SpotifyCares') {
  const csvPath = path.resolve('data/raw/twcs/twcs.csv');
  console.log(`Starting thread reconstruction for brand: ${targetBrand}`);

  const tweetsById = new Map<string, RawTweet>();
  const brandTweetIds = new Set<string>();
  const customerInboundIds = new Set<string>();

  console.log('Pass 1: Identifying all brand and linked inbound tweets...');
  const parserPass1 = fs.createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    })
  );

  let rows = 0;
  for await (const row of parserPass1) {
    rows++;
    const isInbound = row.inbound === 'True' || row.inbound === 'true';
    const author = row.author_id;

    if (!isInbound && author === targetBrand) {
      brandTweetIds.add(row.tweet_id);
      if (row.in_response_to_tweet_id) {
        customerInboundIds.add(row.in_response_to_tweet_id);
      }
    }

    if (rows % 1000000 === 0) {
      console.log(`Pass 1: Processed ${rows.toLocaleString()} rows...`);
    }
  }

  console.log(`Pass 1 complete. Found ${brandTweetIds.size} ${targetBrand} tweets and ${customerInboundIds.size} direct parent tweets.`);

  console.log('Pass 2: Loading relevant tweets into memory...');
  const parserPass2 = fs.createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    })
  );

  rows = 0;
  for await (const row of parserPass2) {
    rows++;
    const id = row.tweet_id;
    const author = row.author_id;
    const isInbound = row.inbound === 'True' || row.inbound === 'true';

    // Store if it's a brand tweet, a parent tweet, or mentions brand/in response to brand
    if (brandTweetIds.has(id) || customerInboundIds.has(id) || (isInbound && row.in_response_to_tweet_id && brandTweetIds.has(row.in_response_to_tweet_id))) {
      tweetsById.set(id, {
        tweet_id: id,
        author_id: author,
        inbound: isInbound,
        created_at: row.created_at,
        text: row.text,
        response_tweet_id: row.response_tweet_id,
        in_response_to_tweet_id: row.in_response_to_tweet_id,
      });
    }

    if (rows % 1000000 === 0) {
      console.log(`Pass 2: Processed ${rows.toLocaleString()} rows... (Loaded ${tweetsById.size} tweets)`);
    }
  }

  console.log(`Pass 2 complete. Total relevant tweets cached: ${tweetsById.size}`);

  console.log('Pass 3: Reconstructing conversation threads...');
  const childMap = new Map<string, string[]>();
  for (const [id, tweet] of tweetsById.entries()) {
    if (tweet.in_response_to_tweet_id && tweetsById.has(tweet.in_response_to_tweet_id)) {
      const parentId = tweet.in_response_to_tweet_id;
      if (!childMap.has(parentId)) childMap.set(parentId, []);
      childMap.get(parentId)!.push(id);
    }
  }

  const threads: ConversationThread[] = [];
  const visited = new Set<string>();

  // Find root customer tweets
  for (const [id, tweet] of tweetsById.entries()) {
    if (tweet.inbound && (!tweet.in_response_to_tweet_id || !tweetsById.has(tweet.in_response_to_tweet_id))) {
      // Root customer inquiry
      const threadMsgs: ThreadMessage[] = [];
      let currentId: string | undefined = id;

      while (currentId && tweetsById.has(currentId)) {
        visited.add(currentId);
        const curr = tweetsById.get(currentId)!;
        threadMsgs.push({
          tweet_id: curr.tweet_id,
          author: curr.inbound ? 'customer' : 'brand',
          author_id: curr.author_id,
          text: sanitizeText(curr.text),
          created_at: curr.created_at,
        });

        const children = childMap.get(currentId);
        if (children && children.length > 0) {
          // Take the primary reply
          currentId = children[0];
        } else {
          currentId = undefined;
        }
      }

      // We need at least 1 customer turn and 1 brand turn
      const customerTurns = threadMsgs.filter(m => m.author === 'customer');
      const brandTurns = threadMsgs.filter(m => m.author === 'brand');

      if (customerTurns.length >= 1 && brandTurns.length >= 1) {
        // Find initial customer message and brand reply
        const initialCust = customerTurns[0].text;
        const brandReply = brandTurns[0].text;

        // Simple resolution heuristic:
        // A thread is substantive/resolved if brand reply is not just an immediate deflection to DM
        // or if customer later said thanks / it worked, or brand provided actionable instructions.
        const lowerReply = brandReply.toLowerCase();
        const isDmDeflection = lowerReply.includes('dm us') || lowerReply.includes('direct message') || lowerReply.includes('private message');
        const hasThanks = threadMsgs.some(m => m.author === 'customer' && (m.text.toLowerCase().includes('thank') || m.text.toLowerCase().includes('fixed') || m.text.toLowerCase().includes('working now')));
        const hasTroubleshooting = lowerReply.includes('restart') || lowerReply.includes('reinstall') || lowerReply.includes('cache') || lowerReply.includes('settings') || lowerReply.includes('check') || lowerReply.includes('try') || lowerReply.includes('update') || lowerReply.includes('link') || lowerReply.includes('guide');

        const isResolved = (!isDmDeflection || hasThanks || hasTroubleshooting);

        threads.push({
          thread_id: id,
          brand: targetBrand,
          initial_message: initialCust,
          resolution_reply: brandReply,
          turn_count: threadMsgs.length,
          is_resolved: isResolved,
          messages: threadMsgs,
        });
      }
    }
  }

  console.log(`\nReconstructed ${threads.length} complete customer<->brand conversation threads!`);
  const resolvedThreads = threads.filter(t => t.is_resolved);
  console.log(`Substantive/Resolved threads: ${resolvedThreads.length} (${((resolvedThreads.length / threads.length) * 100).toFixed(1)}%)`);

  // Ensure processed directory exists
  fs.mkdirSync('data/processed', { recursive: true });

  // Save full cleaned threads
  fs.writeFileSync('data/processed/all_threads.json', JSON.stringify(threads, null, 2));

  // Split into Knowledge Base (resolved past threads for RAG) vs Eval pool
  // Filter out extremely short messages (< 15 chars)
  const validResolved = resolvedThreads.filter(t => t.initial_message.length >= 15 && t.resolution_reply.length >= 15);
  console.log(`Valid resolved threads with substantial text: ${validResolved.length}`);

  // Shuffle with deterministic seed
  const shuffled = [...validResolved].sort((a, b) => a.thread_id.localeCompare(b.thread_id));

  // Knowledge base gets majority (e.g. 1500-2000 threads)
  // Eval pool gets ~400 candidate threads from which we sample golden set
  const evalCandidates = shuffled.slice(0, 500);
  const kbThreads = shuffled.slice(500, 2500); // 2000 threads for RAG KB

  fs.writeFileSync('data/processed/eval_candidates.json', JSON.stringify(evalCandidates, null, 2));
  fs.writeFileSync('data/processed/knowledge_base.json', JSON.stringify(kbThreads, null, 2));

  // Also write as JSONL
  const kbJsonl = kbThreads.map(t => JSON.stringify(t)).join('\n');
  fs.writeFileSync('data/processed/knowledge_base.jsonl', kbJsonl);

  console.log(`Knowledge base size: ${kbThreads.length} threads written to data/processed/knowledge_base.jsonl`);
  console.log(`Eval candidates size: ${evalCandidates.length} threads written to data/processed/eval_candidates.json`);

  // Print 5 samples
  console.log('\n--- 5 Sample Reconstructed Threads ---');
  for (let i = 0; i < Math.min(5, validResolved.length); i++) {
    const t = validResolved[i];
    console.log(`\n[Thread ${i + 1} | ID: ${t.thread_id} | Turns: ${t.turn_count} | Resolved: ${t.is_resolved}]`);
    for (const msg of t.messages) {
      console.log(`  ${msg.author.toUpperCase()}: ${msg.text}`);
    }
  }
}

// Only execute when run directly
if (process.argv[1]?.endsWith('cleanAndThread.ts')) {
  runThreadReconstruction('SpotifyCares').catch(console.error);
}
