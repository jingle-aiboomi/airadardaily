/**
 * AIRadar — ONE-TIME backfill: founded years from data/companies.json → Notion.
 * Matches on PostNo, writes the Founded property. Idempotent (skips rows already set).
 *
 * Run: add BACKFILL_FOUNDED=true in Netlify env vars, trigger one deploy, then remove it.
 * The Notion integration needs "Update content" capability.
 */
const { Client } = require('@notionhq/client');
const fs = require('fs');

if (process.env.BACKFILL_FOUNDED !== 'true') {
  console.log('BACKFILL_FOUNDED not set — skipping founded-year backfill');
  process.exit(0);
}
if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
  console.error('NOTION_TOKEN / NOTION_DATABASE_ID missing'); process.exit(1);
}
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const data = JSON.parse(fs.readFileSync('data/companies.json', 'utf8'));
  const byPost = new Map(data.filter(c => c.founded).map(c => [c.n, c.founded]));

  const rows = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: process.env.NOTION_DATABASE_ID, start_cursor: cursor, page_size: 100,
    });
    rows.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  let done = 0, skipped = 0, missing = 0;
  for (const r of rows) {
    const postNo = r.properties['PostNo']?.number;
    const already = r.properties['Founded']?.number;
    const year = byPost.get(postNo);
    if (already != null) { skipped++; continue; }
    if (!year) { missing++; continue; }
    await notion.pages.update({ page_id: r.id, properties: { 'Founded': { number: year } } });
    done++;
    process.stdout.write(`\rbackfilled ${done}`);
    await sleep(350);
  }
  console.log(`\nFounded backfill complete — set ${done}, already set ${skipped}, no data ${missing}`);
})().catch(e => { console.error(e); process.exit(1); });
