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
  // precompute exhaustive search haystack: name + founders + sector + snippet + full post
  DATA.forEach(c => { c._hay = (c.name + ' ' + c.founders + ' ' + c.sector + ' ' + c.snippet + ' ' + c.post).toLowerCase(); });

  const grid = document.getElementById('grid');
const count = document.getElementById('count');
const empty = document.getElementById('empty');
const overlay = document.getElementById('overlay');
const chipsEl = document.getElementById('chips');
let lastFocus = null;
const state = { q: '', sector: 'All', sort: 'date-asc' };

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

document.getElementById('search').addEventListener('input', e => { state.q = e.target.value.trim().toLowerCase(); apply(); });
document.getElementById('sort').addEventListener('change', e => { state.sort = e.target.value; apply(); });

function apply(){
  let list = DATA.filter(c =>
    (state.sector === 'All' || c.sector === state.sector) &&
    (!state.q || c._hay.includes(state.q))
  );
  const [key, dir] = state.sort.split('-');
  list = list.slice().sort((a,b) => {
    const r = key === 'date' ? a.iso.localeCompare(b.iso) : a.name.localeCompare(b.name, undefined, {sensitivity:'base'});
    return dir === 'asc' ? r : -r;
  });
  render(list);
}

function render(list){
  grid.innerHTML = list.map(c => `
    <button class="card" data-n="${c.n}">
      <div class="sig">#${pad(c.seq)} <span class="d">${esc(c.date)}</span></div>
      <h4>${esc(c.name)}</h4>
      <div class="founders">${esc(c.founders)}</div>
      <span class="tag-sector" data-sector="${esc(c.sector)}">${esc(c.sector)}</span>
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
