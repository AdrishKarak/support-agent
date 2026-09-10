import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'csv-parse';

async function profileBrands() {
  const csvPath = path.resolve('data/raw/twcs/twcs.csv');
  console.log('Reading:', csvPath);

  const brandCounts: Record<string, number> = {};
  let totalRows = 0;

  const parser = fs.createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      relax_column_count: true,
    })
  );

  for await (const record of parser) {
    totalRows++;
    // if inbound is false, author_id is a brand handle
    if (record.inbound === 'False' || record.inbound === 'false') {
      const brand = record.author_id;
      brandCounts[brand] = (brandCounts[brand] || 0) + 1;
    }

    if (totalRows % 500000 === 0) {
      console.log(`Processed ${totalRows} rows...`);
    }
  }

  console.log(`Total rows processed: ${totalRows}`);
  const sorted = Object.entries(brandCounts).sort((a, b) => b[1] - a[1]);
  console.log('\nTop 25 Brands by Outbound Tweets:');
  for (const [brand, count] of sorted.slice(0, 25)) {
    console.log(`- ${brand}: ${count.toLocaleString()} tweets`);
  }
}

profileBrands().catch(console.error);
