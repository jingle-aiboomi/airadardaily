/**
 * AIRadarDaily — Notion → companies.json sync
 * Runs at Netlify build time. Pulls all Published rows from the Notion
 * database and regenerates data/companies.json.
 *
 * Env vars (set in Netlify → Site settings → Environment variables):
 *   NOTION_TOKEN        - internal integration secret (ntn_...)
 *   NOTION_DATABASE_ID  - the database's ID
 */
const { Client } = require('@notionhq/client');
const fs = require('fs');

if (!process.env.NOTION_TOKEN || !process.env.NOTION_DATABASE_ID) {
  console.warn('NOTION_TOKEN / NOTION_DATABASE_ID not set — keeping existing data/companies.json');
  process.exit(0); // graceful: deploy proceeds with the committed JSON
}

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB = process.env.NOTION_DATABASE_ID;

const rt = (p) => (p?.rich_text || []).map(t => t.plain_text).join('');
const title = (p) => (p?.title || []).map(t => t.plain_text).join('');

async function allRows() {
  const rows = [];
  let cursor;
  do {
    const res = await notion.databases.query({
      database_id: DB,
      start_cursor: cursor,
      page_size: 100,
      filter: { property: 'Published', checkbox: { equals: true } },
    });
    rows.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return rows;
}

async function pageText(id) {
  const parts = [];
  let cursor;
  do {
    const res = await notion.blocks.children.list({ block_id: id, start_cursor: cursor, page_size: 100 });
    for (const b of res.results) {
      const t = b[b.type]?.rich_text;
      if (t && t.length) parts.push(t.map(x => x.plain_text).join(''));
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return parts.join('\n\n').trim();
}

(async () => {
  const rows = await allRows();
  if (!rows.length) throw new Error('Notion returned 0 published rows — refusing to overwrite companies.json');
  const out = [];
  for (const r of rows) {
    const p = r.properties;
    const iso = p['Date']?.date?.start || '';
    const disp = iso
      ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
      : '';
    let site = (p['Website']?.url || '').trim();
    if (site && !/^https?:\/\//.test(site)) site = 'https://' + site;
    out.push({
      seq: p['Seq']?.number ?? 0,
      n: p['PostNo']?.number ?? 0,
      name: title(p['Name']),
      founders: rt(p['Founders']),
      sector: (p['Sector']?.select?.name || '').replace('Commerce Retail & Supply AI', 'Commerce, Retail & Supply AI'),
      date: disp,
      iso,
      site,
      snippet: rt(p['Snippet']),
      post: await pageText(r.id),
    });
    process.stdout.write(`\rsynced ${out.length}/${rows.length}`);
  }
  console.log('');
  out.sort((a, b) => a.seq - b.seq);
  fs.writeFileSync('data/companies.json', JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} companies to data/companies.json`);
})().catch(e => { console.error(e); process.exit(1); });
