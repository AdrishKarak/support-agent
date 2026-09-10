import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';

interface Tweet {
  tweet_id: string;
  author_id: string;
  inbound: boolean;
  created_at: string;
  text: string;
  response_tweet_id?: string;
  in_response_to_tweet_id?: string;
}

async function testCandidateBrands() {
  const csvPath = path.resolve('data/raw/twcs/twcs.csv');
  const targetBrands = new Set(['SpotifyCares', 'AppleSupport', 'AmazonHelp', 'Uber_Support']);

  console.log('Scanning dataset for target brands...');

  // Map tweet_id -> Tweet for target brands and their interacting customers
  const brandTweets: Record<string, Tweet[]> = {
    SpotifyCares: [],
    AppleSupport: [],
    AmazonHelp: [],
    Uber_Support: [],
  };

  const parser = fs.createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    })
  );

  let rows = 0;
  for await (const record of parser) {
    rows++;
    const author = record.author_id;
    if (targetBrands.has(author)) {
      if (brandTweets[author].length < 1000) {
        brandTweets[author].push({
          tweet_id: record.tweet_id,
          author_id: author,
          inbound: record.inbound === 'True' || record.inbound === 'true',
          created_at: record.created_at,
          text: record.text,
          response_tweet_id: record.response_tweet_id,
          in_response_to_tweet_id: record.in_response_to_tweet_id,
        });
      }
    }
    if (Object.values(brandTweets).every(arr => arr.length >= 1000)) {
      break;
    }
  }

  console.log('Sampled 1000 outbound tweets for each target brand.');

  // Analyze boilerplate vs substantive replies:
  for (const brand of Object.keys(brandTweets)) {
    const tweets = brandTweets[brand];
    let dmDeflections = 0;
    let substantiveTroubleshooting = 0;
    const sampleTexts: string[] = [];

    for (const t of tweets) {
      const lower = t.text.toLowerCase();
      if (lower.includes('dm') || lower.includes('direct message') || lower.includes('private message')) {
        dmDeflections++;
      } else {
        substantiveTroubleshooting++;
        if (sampleTexts.length < 5) {
          sampleTexts.push(t.text);
        }
      }
    }

    console.log(`\n=== Brand: ${brand} ===`);
    console.log(`DM / Deflection Rate: ${((dmDeflections / tweets.length) * 100).toFixed(1)}%`);
    console.log(`Public Substantive / Troubleshooting Rate: ${((substantiveTroubleshooting / tweets.length) * 100).toFixed(1)}%`);
    console.log('Sample Substantive Replies:');
    sampleTexts.forEach((st, i) => console.log(`  ${i + 1}. ${st}`));
  }
}

testCandidateBrands().catch(console.error);
