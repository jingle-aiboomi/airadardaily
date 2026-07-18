/**
 * AIRadar — Notion "Site Copy" database → data/content.json
 * Optional: if NOTION_CONTENT_DB_ID isn't set, the committed content.json is kept.
 * Rows: Key (title) = content key, Text (rich_text) = the copy.
 * Inline markup in Text: **bold**, *italic*, [label](url), ==highlight==
 */
const { Client } = require('@notionhq/client');
const fs = require('fs');

if (!process.env.NOTION_TOKEN || !process.env.NOTION_CONTENT_DB_ID) {
  console.log('NOTION_CONTENT_DB_ID not set — keeping existing data/content.json');
  process.exit(0);
}
const notion = new Client({ auth: process.env.NOTION_TOKEN });

(async () => {
  const content = {};
  let cursor, count = 0;
  do {
    const res = await notion.databases.query({
      database_id: process.env.NOTION_CONTENT_DB_ID,
      start_cursor: cursor, page_size: 100,
    });
    for (const r of res.results) {
      // serialize Notion rich text back to the site's mini-markup, so links,
      // bold, and italics applied in Notion's UI survive the sync
      const seg = (t) => {
        let s = t.plain_text || '';
        if (!s) return s;
        if (t.annotations?.bold) s = `**${s}**`;
        else if (t.annotations?.italic) s = `*${s}*`;
        const url = t.href || t.text?.link?.url;
        if (url) s = `[${s}](${url})`;
        return s;
      };
      const key = (r.properties['Key']?.title || []).map(t => t.plain_text).join('').trim();
      // URL keys hold a raw address — take plain text, never markdown-wrap them
      const rich = r.properties['Text']?.rich_text || [];
      const text = key.endsWith('_url')
        ? rich.map(t => t.plain_text).join('').trim()
        : rich.map(seg).join('');
      if (key) { content[key] = text; count++; }
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  if (!count) throw new Error('Site Copy DB returned 0 rows — refusing to overwrite content.json');
  fs.writeFileSync('data/content.json', JSON.stringify(content, null, 2));
  console.log(`Wrote ${count} copy blocks to data/content.json`);
})().catch(e => { console.error(e); process.exit(1); });
