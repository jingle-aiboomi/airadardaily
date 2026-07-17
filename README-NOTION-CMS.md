# AIRadarDaily — Notion CMS + Netlify Setup

Architecture: **Notion (editing) → sync script (build time) → static site (Netlify)**

You edit rows in a Notion database. Every deploy runs `scripts/sync-notion.js`,
which pulls all **Published** rows and regenerates `data/companies.json`.
The site itself stays 100% static — no runtime Notion dependency, and if a
build ever fails, the previous version stays live untouched.

---

## Part 1 — The Notion database

Create a database (full-page) called **AIRadarDaily** with EXACTLY these
properties (names are case-sensitive — the sync script matches on them):

| Property   | Type      | Notes |
|------------|-----------|-------|
| Name       | Title     | Company name |
| Seq        | Number    | Display number (#001…). Previous + 1. |
| PostNo     | Number    | Internal unique id (LinkedIn post #). Previous + 1. |
| Founders   | Text      | Comma-separated |
| Sector     | Select    | Create the 9 options below, spelled exactly |
| Date       | Date      | Publish date |
| Website    | URL       | Company site |
| Snippet    | Text      | 1–2 line card description |
| Published  | Checkbox  | ✅ = appears on the site. Unchecked rows are drafts. |

**The full LinkedIn write-up goes in the PAGE BODY** (open the row, paste the
post as normal paragraphs) — not in a property. Notion properties cap at 2,000
characters; page bodies don't. Paragraph breaks in Notion become paragraph
breaks on the site.

Sector options (copy exactly):
```
AI Infra & Dev Tooling
Horizontal AI
Healthcare AI
Financial Services AI
Legal & Professional AI
Commerce, Retail & Supply AI
Industrial & Physical AI
Consumer AI
AI-Native Services
```

## Part 2 — Notion integration (one-time, ~3 min)

1. Go to https://www.notion.so/my-integrations → **New integration**
   - Name: `AIRadarDaily Sync` · Workspace: yours · Type: Internal
   - Capabilities: **Read content** is all it needs
2. Copy the **Internal Integration Secret** (starts `ntn_` or `secret_`).
3. Open the AIRadarDaily database in Notion → `•••` menu → **Connections**
   → add `AIRadarDaily Sync`. (Without this the API can't see the database.)
4. Get the **database ID**: open the database as a full page — the URL looks like
   `notion.so/yourspace/AIRadarDaily-1a2b3c4d5e6f...`
   The 32-character string after the name (before any `?v=`) is the ID.

## Part 3 — Netlify (one-time, ~10 min)

1. Push this folder to a GitHub repo (github.com → New repo → upload files).
2. netlify.com → **Add new site → Import an existing project** → pick the repo.
   Build command and publish dir are read automatically from `netlify.toml`.
3. Before the first deploy: **Site settings → Environment variables** → add:
   - `NOTION_TOKEN` = the integration secret
   - `NOTION_DATABASE_ID` = the database ID
4. Deploy. Build takes ~1–2 min (it reads every Notion row).
5. Custom domain: **Domain settings** → add `airadar.aiboomi.org` (or similar)
   → add the CNAME record wherever aiboomi.org's DNS lives. HTTPS is automatic.

Note: if the env vars are missing, the build still succeeds using the
`data/companies.json` committed in the repo — so the first deploy works even
before Notion is wired up.

## Part 4 — Your weekly ritual (~2 min)

1. Open the Notion database → **New row**: fill Name, Seq, PostNo, Founders,
   Sector, Date, Website, Snippet. Open the row, paste the post into the body.
2. Tick **Published**.
3. Trigger a deploy — any of:
   - **Manual**: Netlify app/site → Deploys → *Trigger deploy* (works from phone)
   - **Build hook**: Site settings → Build & deploy → Build hooks → create one.
     POST that URL to rebuild. Pair it with cron-job.org for a free nightly
     auto-rebuild — then step 3 disappears entirely.
   - **n8n**: a workflow that watches the Notion database for new/edited rows
     and POSTs the build hook — fully automatic within minutes of your edit.

Drafting tip: fill rows any time and leave Published unchecked — they won't
appear until you tick the box and a build runs.

## Safety rails built into the sync

- Notion returning zero rows → build fails on purpose (never blanks the site).
- Missing https:// on a Website URL → added automatically.
- Rows sort by Seq regardless of Notion's view order.
- Only `Published = ✅` rows are synced.
