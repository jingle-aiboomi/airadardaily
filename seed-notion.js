/**
 * AIRadarDaily — ONE-TIME backfill: data/companies.json → Notion database
 *
 * Idempotent: reads existing PostNo values from Notion first and only creates
 * rows that are missing, so it's safe to run multiple times.
 *
 * How to run (no local tooling needed):
 *   1. In Netlify → Environment variables, temporarily add SEED_NOTION = true
 *      (NOTION_TOKEN + NOTION_DATABASE_ID must already be set, and the
 *      integration needs "Insert content" capability)
 *   2. Trigger a deploy — the build seeds Notion, then syncs as usual
 *   3. Remove SEED_NOTION when done
 */
const { Client } = require('@notionhq/client');
const fs = require('fs');

if (process.env.SEED_NOTION !== 'true') {
  console.log('SEED_NOTION not set — skipping backfill');
  process.exit(0);
}
if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
  console.error('SEED_NOTION=true but NOTION_TOKEN / NOTION_DATABASE_ID missing');
  process.exit(1);
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB = process.env.NOTION_DATABASE_ID;
// Notion select options can't contain commas — map site sector -> Notion option
const SECTOR_TO_NOTION = { 'Commerce, Retail & Supply AI': 'Commerce Retail & Supply AI' };

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function existingPostNos() {
  const nos = new Set();
  let cursor;
  do {
    const res = await notion.databases.query({ database_id: DB, start_cursor: cursor, page_size: 100 });
    for (const r of res.results) {
      const n = r.properties['PostNo']?.number;
      if (n != null) nos.add(n);
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return nos;
}

function postBlocks(post) {
  // split into paragraphs; chunk any paragraph over Notion's 2000-char rich_text limit
  const paras = post.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const blocks = [];
  for (const p of paras) {
    for (let i = 0; i < p.length; i += 1900) {
      blocks.push({
        object: 'block', type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', text: { content: p.slice(i, i + 1900) } }] },
      });
    }
  }
  return blocks.slice(0, 100); // Notion caps children per request
}

(async () => {
  const data = JSON.parse(fs.readFileSync('data/companies.json', 'utf8'));
  const have = await existingPostNos();
  const todo = data.filter(c => !have.has(c.n));
  console.log(`Notion has ${have.size} rows; creating ${todo.length} missing of ${data.length}`);
  let done = 0;
  for (const c of todo) {
    await notion.pages.create({
      parent: { database_id: DB },
      properties: {
        'Name': { title: [{ text: { content: c.name } }] },
        'Seq': { number: c.seq },
        'PostNo': { number: c.n },
        'Founders': { rich_text: [{ text: { content: c.founders } }] },
        'Sector': { select: { name: SECTOR_TO_NOTION[c.sector] || c.sector } },
        'Date': { date: { start: c.iso } },
        'Website': { url: c.site || null },
        'Snippet': { rich_text: [{ text: { content: c.snippet.slice(0, 1900) } }] },
        'Published': { checkbox: true },
      },
      children: postBlocks(c.post),
    });
    done++;
    process.stdout.write(`\rseeded ${done}/${todo.length}`);
    await sleep(350); // stay under Notion's ~3 req/s limit
  }
  console.log('\nBackfill complete.');
})().catch(e => { console.error(e); process.exit(1); });
