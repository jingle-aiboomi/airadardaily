# AIRadarDaily — Landing Page

A static directory of AI-native Indian startups profiled by AIRadarDaily (an AIBoomi initiative).
No build step, no framework, no dependencies — plain HTML/CSS/JS.

## Folder structure

```
airadardaily/
├── index.html            ← page structure (rarely touched)
├── styles.css            ← all styling (rarely touched)
├── app.js                ← search / filter / sort / modal logic (rarely touched)
├── data/
│   └── companies.json    ← ★ THE ONLY FILE YOU EDIT to add startups
└── assets/
    ├── aiboomi-logo-white.png
    ├── logo-wall-100.jpg
    └── avinash.jpg
```

---

## Taking it live

### Route A — aiboomi.org/airadardaily (needs hosting access)

aiboomi.org runs on WordPress. Static folders in the web root are served as-is.

1. Get cPanel or SFTP credentials from whoever manages aiboomi.org's hosting.
2. In cPanel → File Manager (or FileZilla via SFTP), open the web root — usually `public_html/`.
3. Upload this entire `airadardaily` folder into it.
4. Visit `https://aiboomi.org/airadardaily/` — done.

To update later: replace `public_html/airadardaily/data/companies.json` with the new version.

### Route B — GitHub + Netlify (recommended: enables browser-based updates)

1. Create a repo at github.com (e.g. `aiboomi/airadardaily`), upload these files
   (drag-and-drop works: repo → "Add file" → "Upload files").
2. Sign in to netlify.com with GitHub → "Add new site" → "Import an existing project"
   → pick the repo. Build command: none. Publish directory: `/` (root). Deploy.
3. You get a URL like `airadardaily.netlify.app` immediately.
4. To serve it on the AIBoomi domain: in Netlify → Domain settings → add custom domain
   `airadar.aiboomi.org`, then add a DNS CNAME record (`airadar` → `<yoursite>.netlify.app`)
   wherever aiboomi.org's DNS is managed. HTTPS is automatic.

Every commit to the repo redeploys the site in ~30 seconds.

You can do BOTH: Route B as the live workflow, and periodically copy the folder
to the WordPress server if the /airadardaily path is required.

---

## Adding a new startup (the weekly ritual)

1. Open `data/companies.json` — on GitHub: navigate to the file → click the pencil (Edit).
2. Scroll to the end. After the LAST record's closing `}`, add a comma, then paste
   the template below and fill it in.
3. Commit ("Commit changes" button). Netlify redeploys automatically.

### Record template (copy–paste)

```json
{
  "seq": 108,
  "n": 114,
  "name": "CompanyName",
  "founders": "Founder One, Founder Two",
  "sector": "Horizontal AI",
  "date": "13 Jul 2026",
  "iso": "2026-07-13",
  "site": "https://companyname.com/",
  "snippet": "One or two lines describing what the company does — shows on the card.",
  "post": "The full LinkedIn write-up goes here.\n\nUse \\n\\n between paragraphs.\n\n#AIRadarDaily #Startups"
}
```

### Field guide

| Field    | What it is                                                                  |
|----------|------------------------------------------------------------------------------|
| seq      | Display number on the card (#108). Previous record's seq + 1.                |
| n        | Internal unique id. Previous record's n + 1. Never reuse a number.           |
| name     | Company name as shown on the card.                                           |
| founders | Comma-separated. Searchable.                                                 |
| sector   | Must be EXACTLY one of the nine (next section) — typos create a new filter chip. |
| date     | Display date, format `13 Jul 2026`.                                          |
| iso      | Same date as `YYYY-MM-DD` — used for date sorting.                           |
| site     | Full URL with https://, or `""` if none.                                     |
| snippet  | Card description, ~1–2 lines (under ~200 characters reads best).             |
| post     | Full write-up. Newlines must be written as `\n`. Quotes inside must be `\"`. |

### The nine sectors (copy exactly)

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

### JSON gotchas (the only two ways to break the page)

1. **Commas** — every record ends with `},` EXCEPT the last one, which ends with `}`.
2. **Escaping in `post`** — real line breaks are not allowed inside JSON strings.
   Write `\n` for a line break and `\"` for a quote mark.

Before committing, paste the whole file into **jsonlint.com** → Validate.
If you do break it, the page shows a friendly error pointing at this file
(the rest of the page still renders) — fix the JSON and recommit.

Tip: ask Claude to convert a finished LinkedIn post into a ready-to-paste
JSON record — it handles the escaping for you.

---

## Updating the "100+" numbers and images

- Hero stats (100+, 225+, Mon–Fri) are plain text in `index.html` — search and edit.
- To refresh the logo wall: overwrite `assets/logo-wall-100.jpg` (keep the filename).
- The "showing X of Y signals" counter is automatic — it reads the JSON.

## Fonts

The CSS references AIBoomi's brand fonts first (Degular, IvyJournal) with free
Google Fonts stand-ins (Hanken Grotesk, Newsreader, Geist Mono) as fallbacks.
If the AIBoomi web-font kit (e.g. Adobe Fonts embed) is added to index.html,
the page upgrades to the real brand fonts automatically — no CSS changes needed.

## Previewing locally

Opening index.html by double-click won't load the JSON (browsers block fetch on file://).
Either preview on Netlify, or run a one-line local server from this folder:

```
python3 -m http.server 8000        # then open http://localhost:8000
```
