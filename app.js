let DATA = [];

async function init(){
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
    (!state.q || c.name.toLowerCase().includes(state.q) || c.founders.toLowerCase().includes(state.q))
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
