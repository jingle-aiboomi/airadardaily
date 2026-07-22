/* ============================================================
   AIRadar search — concept-aware scoring search
   Matches company names, founders, sectors, snippets and the
   full write-ups, and understands problem statements by
   expanding query words into related domain vocabulary.
   ============================================================ */
const STOP = new Set(('a an the and or of for to in on at by with from is are was were be been being that this these those ' +
  'it its as we our us you your they their he she who whom which what when where how why not no any some all can could ' +
  'will would should do does did done have has had into out up down over under about across than then them if but so ' +
  'such very more most other others one two i me my mine startup startups company companies india indian ai').split(' '));

/* Clusters of related domain vocabulary. Any word in a cluster is
   treated as a soft match for any other word in the same cluster,
   so "doctor" finds clinical products, "hiring" finds recruitment. */
const CONCEPTS = [
  ['health','healthcare','medical','clinical','patient','doctor','physician','clinic','hospital','care','ehr','emr','nurse','diagnosis','diagnostic','medicare','provider','dental','dentist','therapy','wellness','radiology','oncology','pharma','prescription','lab'],
  ['insurance','claim','denial','payer','eligibility','underwriting','coverage','billing','reimbursement','rcm','deductible','copay','policyholder','adjuster'],
  ['finance','financial','fintech','bank','banking','lending','loan','mortgage','credit','payment','accounting','bookkeeping','tax','audit','treasury','investment','equity','trading','invoice','ledger','reconciliation','borrower','collections','wealth'],
  ['hiring','hire','recruit','recruitment','recruiter','talent','candidate','resume','interview','staffing','workforce','employee','onboarding','payroll','hr'],
  ['support','service','ticket','helpdesk','chatbot','cx','resolution','complaint','query','agent','inbox','escalation','customer'],
  ['sales','gtm','crm','pipeline','revenue','outbound','lead','prospect','deal','quota','buyer','seller','conversion','funnel'],
  ['marketing','ad','ads','advertising','campaign','seo','brand','creative','content','growth','performance','audience','engagement','copywriting','influencer'],
  ['voice','speech','audio','call','calling','telephony','ivr','tts','conversation','conversational','phone','dialogue','speaking','accent','transcription'],
  ['code','coding','developer','engineer','engineering','software','programming','devtools','api','deploy','deployment','testing','debug','repository','github','qa','review','sdk','frontend','backend','stack'],
  ['infrastructure','infra','gpu','cloud','compute','inference','model','llm','training','latency','serving','pipeline','platform','observability','monitoring','orchestration','memory','embedding','rag','vector','fine','tuning','evaluation','eval','integration','middleware'],
  ['security','cyber','cybersecurity','vulnerability','threat','breach','compliance','governance','risk','privacy','attack','appsec','fraud','authentication','audit','regulation','regulatory'],
  ['legal','law','lawyer','attorney','contract','litigation','court','judgment','paralegal','counsel','case'],
  ['agriculture','agri','farmer','farm','crop','kisan','harvest','soil','livestock','rural','irrigation'],
  ['manufacturing','factory','industrial','production','plant','machine','machinery','quality','inspection','defect','maintenance','equipment','shopfloor','vision'],
  ['retail','ecommerce','commerce','shop','shopping','store','d2c','catalog','merchandising','listing','consumer','checkout','cart','sku'],
  ['supply','chain','logistics','warehouse','inventory','shipping','procurement','fulfilment','fulfillment','delivery','vendor','freight'],
  ['education','learning','student','teacher','edtech','training','course','curriculum','school','skill','tutor'],
  ['video','image','photo','visual','media','film','editing','camera','footage','render','animation','avatar','thumbnail'],
  ['data','analytics','dashboard','insight','report','intelligence','research','bi','metric','benchmark','signal','due','diligence'],
  ['agentic','autonomous','copilot','assistant','automation','workflow','bot','automate','multiagent','reasoning'],
  ['design','ux','ui','interface','prototype','figma','wireframe','layout'],
  ['real','estate','property','construction','contractor','building','architecture','landscaping','takeoff','estimation','blueprint'],
  ['salon','spa','restaurant','hotel','booking','appointment','local','beauty','hospitality','reservation','scheduling'],
  ['document','pdf','paperwork','form','filing','extraction','ocr','parsing','summarization','note','notes'],
  ['translation','multilingual','language','localization','dubbing','regional','vernacular','hindi'],
  ['energy','battery','solar','power','grid','ev','charging','emission','carbon','sustainability','climate'],
  ['search','discovery','recommendation','ranking','personalization','relevance'],
  ['mental','loneliness','companion','emotional','empathy','wellbeing','lonely'],
  ['enterprise','saas','b2b','business','operations','ops','back','office','productivity','team','internal'],
];

function stem(w){
  if (w.length > 4){
    if (w.endsWith('ing')) return w.slice(0, -3);
    if (w.endsWith('ies')) return w.slice(0, -3) + 'y';
    if (w.endsWith('ed'))  return w.slice(0, -2);
    if (w.endsWith('es'))  return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  }
  return w;
}
function tokenize(s){
  return (String(s).toLowerCase().match(/[a-z0-9+#.]{2,}/g) || [])
    .map(t => t.replace(/^\.+|\.+$/g, ''))
    .filter(t => t && !STOP.has(t))
    .map(stem);
}

/* word -> Set of related words (both directions, stemmed) */
const SYN = (() => {
  const m = new Map();
  CONCEPTS.forEach(group => {
    const g = group.map(stem);
    g.forEach(w => {
      if (!m.has(w)) m.set(w, new Set());
      g.forEach(o => { if (o !== w) m.get(w).add(o); });
    });
  });
  return m;
})();

const FIELDS = [
  ['_tName',     14],
  ['_tSector',    9],
  ['_tSnippet',   7],
  ['_tFounders',  7],
  ['_tPost',      2.5],
];

function indexCompanies(list){
  list.forEach(c => {
    c._tName     = new Set(tokenize(c.name));
    c._tFounders = new Set(tokenize(c.founders));
    c._tSector   = new Set(tokenize(c.sector));
    c._tSnippet  = new Set(tokenize(c.snippet));
    c._tPost     = new Set(tokenize(c.post));
    c._hay = (c.name + ' ' + c.founders + ' ' + c.sector + ' ' + c.snippet + ' ' + c.post).toLowerCase();
  });
}

/* does a query token hit this field's token set? 1 = direct, 0.4 = related concept */
function hit(qt, set, syns){
  if (set.has(qt)) return 1;
  for (const t of set){
    if (qt.length >= 3 && (t.startsWith(qt) || qt.startsWith(t))) return 0.85;
  }
  if (syns) for (const s of syns){ if (set.has(s)) return 0.4; }
  return 0;
}

function search(query, list){
  const raw = String(query).toLowerCase().trim();
  if (!raw) return list.map(c => ({ c, score: 0 }));
  const qTokens = [...new Set(tokenize(raw))];
  if (!qTokens.length){
    return list.filter(c => c._hay.includes(raw)).map(c => ({ c, score: 1 }));
  }
  const need = qTokens.length >= 3 ? Math.ceil(qTokens.length * 0.6) : 1;
  const out = [];
  for (const c of list){
    let score = 0, matched = 0, strong = 0;
    for (const qt of qTokens){
      const syns = SYN.get(qt);
      let best = 0;
      for (const [f, w] of FIELDS){
        const q = hit(qt, c[f], syns);
        if (q > 0) best = Math.max(best, q * w);
      }
      if (best > 0){ score += best; matched++; if (best >= 2.5) strong++; }
    }
    if (matched < need) continue;
    if (strong === 0) continue;                      // concept-only noise guard
    score *= 1 + (matched / qTokens.length) * 0.5;   // reward full coverage
    if (c._hay.includes(raw)) score += 10;           // exact phrase in the text
    if (c.name.toLowerCase().startsWith(raw)) score += 25;
    out.push({ c, score });
  }
  out.sort((a, b) => b.score - a.score || b.c.seq - a.c.seq);
  if (!out.length) return out;
  // trim the long tail of faint matches relative to the best hit
  const floor = Math.max(out[0].score * 0.22, 3.5);
  return out.filter(x => x.score >= floor);
}

let DATA = [];

let CONTENT = {};

function md(s){
  const d = document.createElement('div'); d.textContent = s; s = d.innerHTML;
  s = s.replace(/\[([^\]]+)\]\((mailto:[^)\s]+|https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/==([^=]+)==/g, '<span class="hl">$1</span>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return s;
}

function applyContent(){
  document.querySelectorAll('[data-c]').forEach(el => {
    const v = CONTENT[el.dataset.c];
    if (typeof v === 'string' && v.trim()) el.innerHTML = md(v);
  });
  document.querySelectorAll('[data-c-href]').forEach(el => {
    let v = CONTENT[el.dataset.cHref];
    if (typeof v !== 'string' || !v.trim()) return;
    v = v.trim();
    const m = v.match(/^\[[^\]]*\]\(([^)]+)\)$/); // unwrap [label](url)
    if (m) v = m[1];
    if (/^(https?:|mailto:|#)/.test(v)) el.setAttribute('href', v);
  });
  document.querySelectorAll('[data-c-placeholder]').forEach(el => {
    const v = CONTENT[el.dataset.cPlaceholder];
    if (typeof v === 'string' && v.trim()) el.setAttribute('placeholder', v.trim());
  });
  if (CONTENT.meta_title) document.title = CONTENT.meta_title;
}

async function init(){
  try{
    const c = await fetch('data/content.json', {cache:'no-store'});
    if (c.ok) CONTENT = await c.json();
  }catch(e){ /* content is optional; page keeps its built-in copy */ }
  applyContent();
  try{
    const res = await fetch('data/companies.json', {cache:'no-store'});
    DATA = await res.json();
    boot();
  }catch(err){
    document.getElementById('count').textContent = '// could not load data/companies.json — check the file for a JSON syntax error (jsonlint.com)';
    console.error(err);
  }
}

function boot(){
// exact, always-current stats
  const startupsEl = document.getElementById('stat-startups');
  if (startupsEl) startupsEl.textContent = DATA.length;
  const foundersEl = document.getElementById('stat-founders');
  if (foundersEl){
    const set = new Set();
    DATA.forEach(c => c.founders.split(/,|\band\b|&/).forEach(f => { f = f.trim(); if (f.length > 2) set.add(f.toLowerCase()); }));
    foundersEl.textContent = set.size;
  }
  const subEl = document.getElementById('signals-sub');
  if (subEl){
    const tpl = (CONTENT.signals_sub && CONTENT.signals_sub.trim()) || '// {N} AI-native startups, profiled one day at a time';
    subEl.textContent = tpl.replace('{N}', DATA.length);
  }
  // build the search index (names, founders, sectors, snippets, full write-ups)
  indexCompanies(DATA);

  const grid = document.getElementById('grid');
const count = document.getElementById('count');
const empty = document.getElementById('empty');
const overlay = document.getElementById('overlay');
const chipsEl = document.getElementById('chips');
let lastFocus = null;
const state = { q: '', sector: 'All', sort: 'date-desc', userSort: false };

function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML;}
function pad(n){return String(n).padStart(3,'0');}

// build sector chips
const sectorCounts = {};
DATA.forEach(c => sectorCounts[c.sector] = (sectorCounts[c.sector]||0)+1);
const sectors = ['All', ...Object.keys(sectorCounts).sort((a,b)=>sectorCounts[b]-sectorCounts[a])];
chipsEl.innerHTML = sectors.map(s =>
  `<button class="chip${s==='All'?' active':''}" data-s="${esc(s)}">${esc(s)}<span class="c">${s==='All'?DATA.length:sectorCounts[s]}</span></button>`
).join('');
chipsEl.addEventListener('click', e => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  state.sector = chip.dataset.s;
  chipsEl.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === chip));
  apply();
});

const sortEl = document.getElementById('sort');
document.getElementById('search').addEventListener('input', e => {
  state.q = e.target.value.trim();
  // while searching, order by best match unless the reader picked an order
  if (!state.userSort){
    state.sort = state.q ? 'relevance' : 'date-desc';
    sortEl.value = state.sort;
  }
  apply();
});
sortEl.addEventListener('change', e => { state.sort = e.target.value; state.userSort = true; apply(); });

function apply(){
  const pool = DATA.filter(c => state.sector === 'All' || c.sector === state.sector);
  const scored = state.q ? search(state.q, pool) : pool.map(c => ({ c, score: 0 }));
  let list = scored.map(x => x.c);            // search() returns best-match order
  if (state.sort !== 'relevance' || !state.q){
    const [key, dir] = (state.sort === 'relevance' ? 'date-desc' : state.sort).split('-');
    list = list.slice().sort((a,b) => {
      const r = key === 'date' ? a.iso.localeCompare(b.iso) : a.name.localeCompare(b.name, undefined, {sensitivity:'base'});
      return dir === 'asc' ? r : -r;
    });
  }
  render(list);
}

function render(list){
  grid.innerHTML = list.map(c => `
    <button class="card" data-n="${c.n}">
      <div class="sig">#${pad(c.seq)} <span class="d">${esc(c.date)}</span></div>
      <h4>${esc(c.name)}</h4>
      <span class="tag-sector" data-sector="${esc(c.sector)}">${esc(c.sector)}</span>
      <div class="founders">${esc(c.founders)}</div>
      <div class="snip">${esc(c.snippet)}</div>
      <span class="read">READ →</span>
    </button>`).join('');
  count.innerHTML = `// showing <b>${list.length}</b> of ${DATA.length} signals`;
  empty.style.display = list.length ? 'none' : 'block';
}

grid.addEventListener('click', e => {
  const card = e.target.closest('.card');
  if (!card) return;
  const c = DATA.find(x => x.n == card.dataset.n);
  if (!c) return;
  lastFocus = card;
  document.getElementById('m-sig').textContent = `// #${pad(c.seq)} · ${c.date}`;
  document.getElementById('m-title').textContent = c.name;
  document.getElementById('m-meta').innerHTML =
    `Founded by ${esc(c.founders)}` + (c.site ? ` · <a href="${esc(/^https?:\/\//.test(c.site) ? c.site : 'https://'+c.site)}" target="_blank" rel="noopener">Visit website ↗</a>` : '') +
    `<br><span class="tag-radar">// RADAR</span><span class="tag-sector" data-sector="${esc(c.sector)}">${esc(c.sector)}</span>`;
  document.getElementById('m-body').innerHTML =
    esc(c.post).replace(/(#[A-Za-z0-9_]+)/g, '<span class="hash">$1</span>');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  document.getElementById('close').focus();
});

function closeModal(){
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  if (lastFocus) lastFocus.focus();
}
document.getElementById('close').addEventListener('click', closeModal);
overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });

apply();
}

init();


// mobile menu
(() => {
  const btn = document.getElementById('menu-btn');
  const menu = document.getElementById('mobile-menu');
  if (!btn || !menu) return;
  const shut = () => { menu.classList.remove('open'); menu.setAttribute('aria-hidden','true'); btn.setAttribute('aria-expanded','false'); document.body.style.overflow = ''; };
  btn.addEventListener('click', () => { menu.classList.add('open'); menu.setAttribute('aria-hidden','false'); btn.setAttribute('aria-expanded','true'); document.body.style.overflow = 'hidden'; });
  document.getElementById('menu-close').addEventListener('click', shut);
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', shut));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menu.classList.contains('open')) shut(); });
})();


// shrinking header on scroll (matches aiboomi.org)
(() => {
  const nav = document.querySelector('.topnav');
  if (!nav) return;
  let ticking = false;
  const update = () => { nav.classList.toggle('scrolled', window.scrollY > 60); ticking = false; };
  window.addEventListener('scroll', () => {
    if (!ticking) { requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
})();
