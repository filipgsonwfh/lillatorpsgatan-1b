(function(){
'use strict';
const {DEFAULTS, NOTES, CATALOG, KINDS, CATS} = PLAN;

/* ---------- Tillstånd ---------- */
let store = null;        // {activeId, versions:[{id,name,createdAt,updatedAt,state}]}
let state = null;        // den aktiva versionens ritning
let undoStack = [];
let mode = 'mobler';
let measureMode = false, measurePts = [];
let sel = null;          // {kind:'furn'|'room'|'open', id}
let tab = 'mobler';
let dragging = false;

function clone(o){ return JSON.parse(JSON.stringify(o)); }
function uid(){ return 'i' + Math.random().toString(36).slice(2,9); }
function num(v, d){ const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? d : n; }
function fmt(n){ return String(Math.round(n*10)/10).replace('.', ','); }
function fmtDate(ts){ try{ return new Date(ts).toLocaleString('sv-SE', {dateStyle:'medium', timeStyle:'short'}); }catch(e){ return ''; } }
function snap(v){ const s = state.snap || 1; return Math.round(v/s)*s; }
function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function freshState(){ const s = clone(DEFAULTS); s.baseVersion = DEFAULTS.version; s.updatedAt = 0; s.wallsEdited = false; delete s.version; return s; }
function markWalls(){ state.wallsEdited = true; }
function normalize(s){
  if(!s || typeof s !== 'object') return null;
  return {
    wall: num(s.wall, 10), snap: num(s.snap, 5),
    rooms: Array.isArray(s.rooms) ? s.rooms : [],
    walls: Array.isArray(s.walls) ? s.walls : [],
    openings: Array.isArray(s.openings) ? s.openings : [],
    furniture: Array.isArray(s.furniture) ? s.furniture : [],
    baseVersion: s.baseVersion || 0, updatedAt: num(s.updatedAt, 0), wallsEdited: !!s.wallsEdited
  };
}

/* ---------- Versioner ---------- */
function activeVersion(){ return store.versions.find(v => v.id === store.activeId) || store.versions[0]; }
function saveStore(){ if(!Versions.save(store)) toast('Kunde inte spara i webbläsaren'); }
function commit(){
  const v = activeVersion(); v.state = state; v.updatedAt = Date.now(); state.updatedAt = v.updatedAt;
  saveStore(); render(); renderPanel(); renderSelbar(); renderHeader();
}
function pushHistory(snapshot){ undoStack.push(snapshot); if(undoStack.length > 40) undoStack.shift(); }
function mutate(fn){ const before = JSON.stringify(state); fn(state); pushHistory(before); commit(); }
function undo(){ const prev = undoStack.pop(); if(!prev) return; state = normalize(JSON.parse(prev)); sel = null; commit(); }

function activate(id, opts){
  const v = store.versions.find(q => q.id === id); if(!v) return;
  store.activeId = v.id; state = v.state; undoStack = []; sel = null;
  measureMode = false; measurePts = []; document.getElementById('measure').setAttribute('aria-pressed', 'false');
  saveStore(); render(); renderPanel(); renderSelbar(); renderHeader(); checkVersion();
  if(!opts || opts.fit !== false) fit();
}
function addVersion(name, st, activateIt){
  const n = normalize(st); if(!n || !n.rooms.length) throw new Error('Innehåller ingen ritning');
  const v = Versions.make(name, n); store.versions.push(v); saveStore();
  if(activateIt) activate(v.id); else renderPanel();
  return v;
}
function uniqueName(base){
  const names = new Set(store.versions.map(v => v.name));
  let name = base, i = 2;
  while(names.has(name)) name = base + ' ' + (i++);
  return name;
}
function renderHeader(){ const v = activeVersion(); document.getElementById('vername').textContent = v ? v.name : ''; }
function dupVersion(v){
  const c = addVersion(uniqueName(v.name + ' (kopia)'), v.state, true);
  toast('Kopia skapad'); focusVersionName(c.id);
}
function focusVersionName(id){
  if(!matchMedia('(hover:hover)').matches) return; // inget tangentbord som hoppar upp på mobil
  const inp = content.querySelector('[data-vid="' + id + '"] input[data-vf="name"]');
  if(inp){ inp.focus(); inp.select(); }
}
async function shareVersion(v){
  try{
    const enc = await Versions.encodeShare(Versions.payload(v));
    const url = location.href.split('#')[0] + '#v=' + enc;
    if(navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)){
      try{ await navigator.share({title: v.name + ' – Lillatorpsgatan 1B', url}); return; }
      catch(e){ if(e && e.name === 'AbortError') return; }
    }
    try{ await navigator.clipboard.writeText(url); toast('Länk kopierad'); }
    catch(e){ showOut(url); }
  }catch(e){ toast('Kunde inte skapa länk'); }
}
function showOut(text){ const ta = document.getElementById('v-out'); if(!ta) return; ta.style.display = 'block'; ta.value = text; ta.focus(); ta.select(); }
function importParsed(p, suffix){
  const key = p.id && p.updatedAt ? p.id + ':' + p.updatedAt : null;
  const existing = key && store.versions.find(v => v.source === key || (v.id === p.id && v.updatedAt === p.updatedAt));
  if(existing){ activate(existing.id); toast('Versionen finns redan: ' + existing.name); return existing; }
  const v = addVersion(uniqueName((p.name || 'Importerad') + (suffix || '')), p.state, true);
  if(key){ v.source = key; saveStore(); }
  toast('Versionen "' + v.name + '" har lagts till');
  return v;
}
async function importText(text, suffix){ return importParsed(await Versions.parseImport(text), suffix); }
async function importFromHash(){
  const m = location.hash.match(/^#v=([A-Za-z0-9_-]+)/); if(!m) return false;
  window.history.replaceState(null, '', location.pathname + location.search);
  try{ await importText(m[1], ' (delad)'); tab = 'versioner'; syncTabs(); renderPanel(); return true; }
  catch(e){ toast('Kunde inte läsa länken'); return false; }
}
let toastTimer = 0;
function toast(msg){
  const el = document.getElementById('status'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

/* ---------- Ritningsversion (när plan.js uppdaterats) ---------- */
const isDefaultId = id => /^f\d+$/.test(id) || /^fx-/.test(id);
function applyDefaults(s){
  const d = clone(DEFAULTS);
  s.rooms = d.rooms; s.walls = d.walls; s.openings = d.openings; s.wall = d.wall;
  s.furniture = s.furniture.filter(f => !isDefaultId(f.id)).concat(d.furniture);
  s.baseVersion = DEFAULTS.version; s.wallsEdited = false;
}
function needsUpgrade(s){ return s.baseVersion !== DEFAULTS.version; }
const bannerEl = document.getElementById('banner');
function hideBanner(){ bannerEl.classList.remove('show'); bannerEl.innerHTML = ''; }
function checkVersion(){
  if(!needsUpgrade(state)){ hideBanner(); return; }
  if(!state.wallsEdited){
    applyDefaults(state); sel = null; commit();
    bannerEl.innerHTML = '<span>Versionen är uppdaterad till den senaste ritningen (v' + DEFAULTS.version + '). Dina egna möbler är kvar.</span><button id="banner-ok">OK</button>';
    bannerEl.classList.add('show');
    return;
  }
  bannerEl.innerHTML = '<span>Ritningen har uppdaterats sedan du ändrade väggar själv i den här versionen. Hämta den nya planen (väggar och fast inredning) och behåll dina egna möbler?</span><button id="banner-yes">Hämta nya</button><button id="banner-no">Behåll min</button>';
  bannerEl.classList.add('show');
}
bannerEl.addEventListener('click', e => {
  const b = e.target.closest('button'); if(!b) return;
  if(b.id === 'banner-yes'){ mutate(s => applyDefaults(s)); hideBanner(); }
  else if(b.id === 'banner-no'){ mutate(s => { s.baseVersion = DEFAULTS.version; }); hideBanner(); }
  else hideBanner();
});

/* ---------- Vy (viewBox i cm) ---------- */
const svg = document.getElementById('plan');
const wrap = document.getElementById('planwrap');
let vb = {x:-200, y:-100, w:1400, h:1200};
let viewTouched = false; // false tills användaren panorerat/zoomat: då följer vyn med vid storleksändring
function rectOf(){ return svg.getBoundingClientRect(); }
function scaleOf(){ const r = rectOf(); return vb.w / Math.max(1, r.width); }
function toWorld(cx, cy){ const r = rectOf(); const s = scaleOf(); return {x: vb.x + (cx - r.left)*s, y: vb.y + (cy - r.top)*s}; }
function applyVB(){ svg.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`); }
function bbox(){
  const t = state.wall;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  state.rooms.forEach(r => { x0=Math.min(x0,r.x-t); y0=Math.min(y0,r.y-t); x1=Math.max(x1,r.x+r.w+t); y1=Math.max(y1,r.y+r.h+t); });
  if(!isFinite(x0)){ x0=0;y0=0;x1=1000;y1=800; }
  return {x0,y0,x1,y1};
}
function fit(){
  const r = rectOf(); if(r.width < 2 || r.height < 2) return;
  const b = bbox(); const m = 70;
  const bw = b.x1-b.x0+2*m, bh = b.y1-b.y0+2*m;
  const s = Math.max(bw/r.width, bh/r.height);
  vb.w = r.width*s; vb.h = r.height*s;
  vb.x = (b.x0+b.x1)/2 - vb.w/2; vb.y = (b.y0+b.y1)/2 - vb.h/2;
  viewTouched = false;
  applyVB();
}
function zoomAt(cx, cy, f){
  viewTouched = true;
  const p = toWorld(cx, cy);
  vb.w = Math.min(6000, Math.max(150, vb.w*f)); const r = rectOf(); vb.h = vb.w * r.height / Math.max(1, r.width);
  const s = scaleOf();
  vb.x = p.x - (cx - r.left)*s; vb.y = p.y - (cy - r.top)*s;
  applyVB();
}
new ResizeObserver(() => {
  const r = rectOf(); if(r.width < 2 || r.height < 2) return;
  if(!viewTouched){ fit(); return; }
  vb.h = vb.w * r.height / r.width; applyVB();
}).observe(wrap);

/* ---------- Rendering ---------- */
function doorGeom(o, t0){
  const t = o.thick || t0;
  const {x,y,len,dir} = o; const hinge = o.hinge ? 1 : 0; const flip = !!o.flip;
  let H, tip, J;
  if(dir === 'h'){
    const ey = flip ? y : y + t; const s = flip ? -1 : 1;
    H = hinge ? [x+len, ey] : [x, ey]; J = hinge ? [x, ey] : [x+len, ey]; tip = [H[0], H[1] + s*len];
  } else {
    const ex = flip ? x : x + t; const s = flip ? -1 : 1;
    H = hinge ? [ex, y+len] : [ex, y]; J = hinge ? [ex, y] : [ex, y+len]; tip = [H[0] + s*len, H[1]];
  }
  const cross = (tip[0]-H[0])*(J[1]-H[1]) - (tip[1]-H[1])*(J[0]-H[0]);
  const sweep = cross > 0 ? 1 : 0;
  return {leaf:`M${H[0]} ${H[1]} L${tip[0]} ${tip[1]}`, arc:`M${tip[0]} ${tip[1]} A${len} ${len} 0 0 ${sweep} ${J[0]} ${J[1]}`};
}
function gapRect(o, t){ const th = o.thick || t; return o.dir === 'h' ? {x:o.x, y:o.y, w:o.len, h:th} : {x:o.x, y:o.y, w:th, h:o.len}; }
function unionArea(rects){
  const xs = [...new Set(rects.flatMap(r => [r.x, r.x+r.w]))].sort((a,b) => a-b);
  let area = 0;
  for(let i=0; i<xs.length-1; i++){
    const x0 = xs[i], x1 = xs[i+1];
    const ivs = rects.filter(r => r.x <= x0 && r.x+r.w >= x1).map(r => [r.y, r.y+r.h]).sort((a,b) => a[0]-b[0]);
    let len = 0, cs = null, ce = null;
    for(const [a,b] of ivs){ if(cs === null || a > ce){ if(cs !== null) len += ce-cs; cs = a; ce = b; } else ce = Math.max(ce, b); }
    if(cs !== null) len += ce-cs;
    area += (x1-x0)*len;
  }
  return area;
}
function roomArea(r){ return (r.group ? unionArea(state.rooms.filter(q => q.group === r.group)) : r.w*r.h) / 10000; }
function roomAt(px, py){ return state.rooms.find(r => r.kind !== 'balkong' && px >= r.x && px <= r.x+r.w && py >= r.y && py <= r.y+r.h); }

function render(){
  const t = state.wall;
  const b = bbox();
  let out = '';
  // Rutnät (1 m)
  out += '<g class="grid">';
  const gx0 = Math.floor((b.x0-200)/100)*100, gx1 = Math.ceil((b.x1+200)/100)*100;
  const gy0 = Math.floor((b.y0-200)/100)*100, gy1 = Math.ceil((b.y1+200)/100)*100;
  for(let x=gx0; x<=gx1; x+=100) out += `<line x1="${x}" y1="${gy0}" x2="${x}" y2="${gy1}"/>`;
  for(let y=gy0; y<=gy1; y+=100) out += `<line x1="${gx0}" y1="${y}" x2="${gx1}" y2="${y}"/>`;
  out += '</g>';
  // Väggar (unionen av rum + väggtjocklek)
  out += '<g class="walls">';
  state.rooms.forEach(r => { if(r.kind === 'balkong') return; out += `<rect class="wall" x="${r.x-t}" y="${r.y-t}" width="${r.w+2*t}" height="${r.h+2*t}"/>`; });
  out += '</g>';
  // Golv
  out += '<g class="floors">';
  state.rooms.forEach(r => {
    const rx = r.kind === 'balkong' ? ' rx="18"' : '';
    out += `<rect class="floor ${r.kind}" data-kind="room" data-id="${r.id}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"${rx}/>`;
  });
  out += '</g>';
  // Extra väggar
  out += '<g class="xwalls">';
  state.walls.forEach(w => { out += `<rect class="wall" x="${w.x}" y="${w.y}" width="${w.w}" height="${w.h}"/>`; });
  out += '</g>';
  // Öppningar
  out += '<g class="openings">';
  state.openings.forEach(o => {
    const g = gapRect(o, t);
    const cx = g.x + g.w/2, cy = g.y + g.h/2;
    const inRoom = roomAt(cx, cy);
    const vat = (inRoom && inRoom.kind === 'vat') ? ' vat' : '';
    out += `<g data-kind="open" data-id="${o.id}">`;
    if(o.type === 'window'){
      out += `<rect class="win" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/>`;
      if(o.dir === 'h') out += `<line class="winline" x1="${g.x}" y1="${cy}" x2="${g.x+g.w}" y2="${cy}"/>`;
      else out += `<line class="winline" x1="${cx}" y1="${g.y}" x2="${cx}" y2="${g.y+g.h}"/>`;
    } else {
      out += `<rect class="gap${vat}" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/>`;
      if(o.type === 'door'){
        const d = doorGeom(o, t);
        out += `<path class="arc" d="${d.arc}"/><path class="leaf" d="${d.leaf}"/>`;
      } else {
        if(o.dir === 'h') out += `<line class="openline" x1="${g.x}" y1="${cy}" x2="${g.x+g.w}" y2="${cy}"/>`;
        else out += `<line class="openline" x1="${cx}" y1="${g.y}" x2="${cx}" y2="${g.y+g.h}"/>`;
      }
    }
    if(mode === 'rum'){
      out += `<rect class="op-hit" x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}"/>`;
      if(sel && sel.kind === 'open' && sel.id === o.id) out += `<rect class="op-sel" x="${g.x-6}" y="${g.y-6}" width="${g.w+12}" height="${g.h+12}"/>`;
    }
    out += '</g>';
  });
  out += '</g>';
  // Möbler
  out += '<g class="furniture">';
  state.furniture.forEach(f => {
    const isSel = sel && sel.kind === 'furn' && sel.id === f.id;
    out += `<g class="furn ${f.cat || 'ovrigt'}${f.fixed ? ' fixed' : ''}${isSel ? ' sel' : ''}" data-kind="furn" data-id="${f.id}" transform="translate(${f.x} ${f.y})">`;
    if(f.shape === 'quarter') out += `<path class="body" d="M0 0 A${f.w} ${f.h} 0 0 0 ${f.w} ${f.h} L${f.w} 0 Z"/>`;
    else out += `<rect class="body" x="0" y="0" width="${f.w}" height="${f.h}" rx="${f.fixed ? 0 : 3}"/>`;
    if(f.w >= 18 && f.h >= 18 && f.name){
      const rot = f.h > f.w*1.4;
      const along = rot ? f.h : f.w, across = rot ? f.w : f.h;
      const fs = Math.max(8, Math.min(15, Math.min(along / (f.name.length*0.62), across*0.72)));
      const tx = f.shape === 'quarter' ? f.w*0.68 : f.w/2, ty = f.shape === 'quarter' ? f.h*0.3 : f.h/2;
      const tr = rot ? `translate(${tx} ${ty}) rotate(-90)` : `translate(${tx} ${ty})`;
      if(fs >= 8) out += `<text transform="${tr}" style="font-size:${fs}px">${esc(f.name)}</text>`;
    }
    out += '</g>';
  });
  out += '</g>';
  // Rumsetiketter
  out += '<g class="labels">';
  state.rooms.forEach(r => {
    if(!r.name && !(sel && sel.kind==='room' && sel.id===r.id)) return;
    const cx = r.x + r.w/2, cy = r.y + r.h/2;
    const area = roomArea(r);
    const showDims = mode === 'rum';
    const small = r.w < 180 || r.h < 150;
    if(small){
      out += `<text class="lbl" x="${cx}" y="${cy+8}" style="font-size:18px">${esc(r.name)}</text>`;
    } else {
      out += `<text class="lbl" x="${cx}" y="${cy-4}">${esc(r.name)}</text>`;
      if(r.kind !== 'balkong' && r.kind !== 'skap') out += `<text class="lbl-sub" x="${cx}" y="${cy+16}">${fmt(area)} m²</text>`;
      if(showDims) out += `<text class="dimtxt" x="${cx}" y="${cy+34}">${Math.round(r.w)} × ${Math.round(r.h)}</text>`;
    }
  });
  out += '</g>';
  // Markerat rum + handtag
  if(mode === 'rum' && sel && sel.kind === 'room'){
    const r = state.rooms.find(q => q.id === sel.id);
    if(r){
      const hs = 30 * scaleOf();
      out += `<rect class="room-sel" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;
      out += `<rect class="handle" data-kind="handle" data-id="${r.id}" x="${r.x+r.w-hs/2}" y="${r.y+r.h-hs/2}" width="${hs}" height="${hs}" rx="${hs/5}"/>`;
    }
  }
  // Mätning
  if(measurePts.length){
    const ps = scaleOf()*5;
    measurePts.forEach(p => { out += `<circle class="measure-pt" cx="${p.x}" cy="${p.y}" r="${ps}"/>`; });
    if(measurePts.length === 2){
      const [a,b2] = measurePts; const d = Math.hypot(b2.x-a.x, b2.y-a.y);
      out += `<line class="measure" x1="${a.x}" y1="${a.y}" x2="${b2.x}" y2="${b2.y}"/>`;
      out += `<text class="measure-lbl" x="${(a.x+b2.x)/2}" y="${(a.y+b2.y)/2 - 14}">${Math.round(d)} cm</text>`;
    }
  }
  svg.innerHTML = out;
  const total = unionArea(state.rooms.filter(r => r.kind !== 'balkong' && r.kind !== 'skap'))/10000;
  document.getElementById('total').textContent = `${fmt(total)} m² innermått`;
  document.getElementById('hint').textContent = measureMode ? 'Tryck på två punkter för att mäta'
    : (mode === 'mobler' ? 'Dra möbler. Dra på tomt golv för att panorera, nyp för att zooma.'
    : 'Tryck på ett rum, en dörr, ett fönster eller fast inredning för att flytta. Blått handtag ändrar storlek.');
}

/* ---------- Markering ---------- */
function selectedObj(){
  if(!sel) return null;
  const list = sel.kind === 'furn' ? state.furniture : sel.kind === 'room' ? state.rooms : state.openings;
  return list.find(o => o.id === sel.id) || null;
}
function renderSelbar(){
  const bar = document.getElementById('selbar');
  const o = selectedObj();
  if(!o){ bar.classList.remove('show'); bar.innerHTML = ''; return; }
  let html = '';
  if(sel.kind === 'furn'){
    html = `<span class="name">${o.fixed ? 'Fast: ' : ''}${esc(o.name)}</span><span class="dims">${Math.round(o.w)} × ${Math.round(o.h)} cm</span><span class="spacer"></span>
      <button data-act="rotate">Rotera</button>${o.fixed ? '<button data-act="unfix">Gör flyttbar</button>' : '<button data-act="dup">Kopiera</button><button data-act="fix">Lås fast</button>'}<button data-act="del" class="danger">Ta bort</button>`;
  } else if(sel.kind === 'room'){
    html = `<span class="name">${esc(o.name || 'Namnlös del')}</span><span class="dims">${Math.round(o.w)} × ${Math.round(o.h)} cm</span><span class="spacer"></span>
      <button data-act="del" class="danger">Ta bort</button>`;
  } else {
    const label = o.type === 'door' ? 'Dörr' : o.type === 'window' ? 'Fönster' : 'Öppning';
    html = `<span class="name">${label}${o.note ? ' – ' + esc(o.note) : ''}</span><span class="dims">${Math.round(o.len)} cm</span><span class="spacer"></span>
      ${o.type === 'door' ? '<button data-act="flip">Slår åt andra hållet</button><button data-act="hinge">Byt gångjärn</button>' : ''}
      <button data-act="turn">Vrid</button><button data-act="del" class="danger">Ta bort</button>`;
  }
  bar.innerHTML = html; bar.classList.add('show');
}
document.getElementById('selbar').addEventListener('click', e => {
  const btn = e.target.closest('button[data-act]'); if(!btn) return;
  const act = btn.dataset.act; const o = selectedObj(); if(!o) return;
  if(act === 'del'){
    mutate(s => {
      if(sel.kind !== 'furn' || o.fixed) s.wallsEdited = true;
      if(sel.kind === 'furn') s.furniture = s.furniture.filter(f => f.id !== o.id);
      else if(sel.kind === 'room') s.rooms = s.rooms.filter(r => r.id !== o.id);
      else s.openings = s.openings.filter(p => p.id !== o.id);
    });
    sel = null; render(); renderSelbar(); renderPanel();
  } else if(act === 'rotate'){ mutate(s => { const f = s.furniture.find(q => q.id === o.id); const w = f.w; f.w = f.h; f.h = w; }); }
  else if(act === 'unfix'){ mutate(s => { s.wallsEdited = true; const f = s.furniture.find(q => q.id === o.id); f.fixed = false; }); }
  else if(act === 'fix'){ mutate(s => { const f = s.furniture.find(q => q.id === o.id); f.fixed = true; }); }
  else if(act === 'dup'){ const c = clone(o); c.id = uid(); c.x += 20; c.y += 20; mutate(s => s.furniture.push(c)); sel = {kind:'furn', id:c.id}; render(); renderSelbar(); renderPanel(); }
  else if(act === 'flip'){ mutate(s => { s.wallsEdited = true; const p = s.openings.find(q => q.id === o.id); p.flip = !p.flip; }); }
  else if(act === 'hinge'){ mutate(s => { s.wallsEdited = true; const p = s.openings.find(q => q.id === o.id); p.hinge = p.hinge ? 0 : 1; }); }
  else if(act === 'turn'){ mutate(s => { s.wallsEdited = true; const p = s.openings.find(q => q.id === o.id); p.dir = p.dir === 'h' ? 'v' : 'h'; }); }
});

/* ---------- Pekare: dra, panorera, zooma, mäta ---------- */
const pointers = new Map();
let drag = null;
svg.addEventListener('pointerdown', e => {
  if(e.button !== undefined && e.button !== 0 && e.pointerType === 'mouse') return;
  svg.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(pointers.size === 2){
    if(drag && drag.before && drag.moved){ pushHistory(drag.before); commit(); }
    dragging = false;
    const pts = [...pointers.values()];
    drag = {kind:'pinch', d0: Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y), w0: vb.w, c0: toWorld((pts[0].x+pts[1].x)/2, (pts[0].y+pts[1].y)/2)};
    return;
  }
  const p = toWorld(e.clientX, e.clientY);
  if(measureMode){
    const q = {x:snap(p.x), y:snap(p.y)};
    if(measurePts.length >= 2) measurePts = [q]; else measurePts.push(q);
    render(); return;
  }
  const el = e.target.closest ? e.target.closest('[data-kind]') : null;
  const kind = el ? el.dataset.kind : null;
  const before = JSON.stringify(state);
  if(kind === 'furn'){
    const f = state.furniture.find(q => q.id === el.dataset.id);
    if(!f || (f.fixed ? mode !== 'rum' : mode !== 'mobler')){ drag = {kind:'pan', sx:e.clientX, sy:e.clientY, vx:vb.x, vy:vb.y, moved:false}; return; }
    sel = {kind:'furn', id:f.id};
    drag = {kind:'furn', obj:f, offX:p.x-f.x, offY:p.y-f.y, before, moved:false};
    dragging = true; render(); renderSelbar(); renderPanel(); return;
  }
  if(mode === 'rum' && kind === 'handle'){
    const r = state.rooms.find(q => q.id === el.dataset.id);
    drag = {kind:'handle', obj:r, before, moved:false}; dragging = true; return;
  }
  if(mode === 'rum' && kind === 'open'){
    const o = state.openings.find(q => q.id === el.dataset.id);
    sel = {kind:'open', id:o.id};
    drag = {kind:'open', obj:o, offX:p.x-o.x, offY:p.y-o.y, before, moved:false};
    dragging = true; render(); renderSelbar(); renderPanel(); return;
  }
  if(mode === 'rum' && kind === 'room'){
    const r = state.rooms.find(q => q.id === el.dataset.id);
    sel = {kind:'room', id:r.id};
    drag = {kind:'room', obj:r, offX:p.x-r.x, offY:p.y-r.y, before, moved:false};
    dragging = true; render(); renderSelbar(); renderPanel(); return;
  }
  // tomt: panorera, avmarkera vid klick
  drag = {kind:'pan', sx:e.clientX, sy:e.clientY, vx:vb.x, vy:vb.y, moved:false};
});
svg.addEventListener('pointermove', e => {
  if(!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(!drag) return;
  if(drag.kind === 'pinch'){
    if(pointers.size < 2) return;
    const pts = [...pointers.values()];
    const d1 = Math.hypot(pts[0].x-pts[1].x, pts[0].y-pts[1].y);
    const cx = (pts[0].x+pts[1].x)/2, cy = (pts[0].y+pts[1].y)/2;
    viewTouched = true;
    vb.w = Math.min(6000, Math.max(150, drag.w0 * drag.d0 / Math.max(1, d1)));
    const r = rectOf(); vb.h = vb.w * r.height / Math.max(1, r.width);
    const s = scaleOf();
    vb.x = drag.c0.x - (cx - r.left)*s; vb.y = drag.c0.y - (cy - r.top)*s;
    applyVB(); return;
  }
  const s = scaleOf();
  if(drag.kind === 'pan'){
    const dx = (e.clientX - drag.sx)*s, dy = (e.clientY - drag.sy)*s;
    if(Math.abs(e.clientX-drag.sx) + Math.abs(e.clientY-drag.sy) > 3){ drag.moved = true; viewTouched = true; }
    vb.x = drag.vx - dx; vb.y = drag.vy - dy; applyVB(); return;
  }
  const p = toWorld(e.clientX, e.clientY);
  if(drag.kind === 'furn' || drag.kind === 'open' || drag.kind === 'room'){
    const nx = snap(p.x - drag.offX), ny = snap(p.y - drag.offY);
    if(nx !== drag.obj.x || ny !== drag.obj.y){ drag.obj.x = nx; drag.obj.y = ny; drag.moved = true; scheduleRender(); }
  } else if(drag.kind === 'handle'){
    const nw = Math.max(30, snap(p.x - drag.obj.x)), nh = Math.max(30, snap(p.y - drag.obj.y));
    if(nw !== drag.obj.w || nh !== drag.obj.h){ drag.obj.w = nw; drag.obj.h = nh; drag.moved = true; scheduleRender(); }
  }
});
function endPointer(e){
  pointers.delete(e.pointerId);
  if(!drag) return;
  if(drag.kind === 'pinch'){ if(pointers.size === 0) drag = null; return; }
  if(drag.kind === 'pan'){
    if(!drag.moved && !measureMode){ sel = null; render(); renderSelbar(); renderPanel(); }
    drag = null; return;
  }
  dragging = false;
  if(drag.moved){ if(drag.kind !== 'furn' || drag.obj.fixed) markWalls(); pushHistory(drag.before); commit(); } else { render(); }
  drag = null;
}
svg.addEventListener('pointerup', endPointer);
svg.addEventListener('pointercancel', endPointer);
svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.12 : 0.89); }, {passive:false});
let raf = 0;
function scheduleRender(){ if(raf) return; raf = requestAnimationFrame(() => { raf = 0; render(); renderSelbar(); }); }

document.getElementById('zoomin').addEventListener('click', () => { const r = rectOf(); zoomAt(r.left+r.width/2, r.top+r.height/2, 0.8); });
document.getElementById('zoomout').addEventListener('click', () => { const r = rectOf(); zoomAt(r.left+r.width/2, r.top+r.height/2, 1.25); });
document.getElementById('fit').addEventListener('click', fit);
document.getElementById('undo').addEventListener('click', undo);
document.getElementById('measure').addEventListener('click', () => {
  measureMode = !measureMode; measurePts = [];
  document.getElementById('measure').setAttribute('aria-pressed', String(measureMode));
  render();
});
document.getElementById('verbtn').addEventListener('click', () => { tab = 'versioner'; syncTabs(); renderPanel(); });
function setMode(m){
  mode = m; sel = null; measureMode = false; measurePts = [];
  document.body.classList.toggle('mode-rum', m === 'rum');
  document.getElementById('measure').setAttribute('aria-pressed', 'false');
  document.getElementById('mode-mobler').setAttribute('aria-pressed', String(m === 'mobler'));
  document.getElementById('mode-rum').setAttribute('aria-pressed', String(m === 'rum'));
  if(m === 'rum' && tab === 'mobler') tab = 'rum';
  if(m === 'mobler' && (tab === 'rum' || tab === 'oppningar')) tab = 'mobler';
  syncTabs(); render(); renderSelbar(); renderPanel();
}
document.getElementById('mode-mobler').addEventListener('click', () => setMode('mobler'));
document.getElementById('mode-rum').addEventListener('click', () => setMode('rum'));

document.addEventListener('keydown', e => {
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if(tag === 'input' || tag === 'textarea' || tag === 'select') return;
  if((e.key === 'Delete' || e.key === 'Backspace') && sel){
    const bar = document.getElementById('selbar'); const b = bar.querySelector('button[data-act="del"]'); if(b) b.click();
  } else if((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey)){ e.preventDefault(); undo(); }
  else if(e.key === 'Escape'){ sel = null; measureMode = false; measurePts = []; document.getElementById('measure').setAttribute('aria-pressed','false'); render(); renderSelbar(); renderPanel(); }
});

/* ---------- Panel ---------- */
const content = document.getElementById('content');
function syncTabs(){ document.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab))); }
document.querySelector('.tabs').addEventListener('click', e => {
  const b = e.target.closest('.tab'); if(!b) return;
  tab = b.dataset.tab;
  if((tab === 'rum' || tab === 'oppningar') && mode !== 'rum') setMode('rum');
  else if(tab === 'mobler' && mode !== 'mobler') setMode('mobler');
  else { syncTabs(); renderPanel(); }
});
function numField(label, f, v, step){ return `<label>${label}<input type="number" step="${step||1}" data-f="${f}" value="${v}"></label>`; }

function renderPanel(){
  let html = '';
  if(tab === 'mobler'){
    const o = sel && sel.kind === 'furn' ? selectedObj() : null;
    if(o){
      html += `<h2>Vald möbel</h2><div class="row sel" data-obj="furn" data-id="${o.id}">
        <div class="top"><input type="text" data-f="name" value="${esc(o.name)}" aria-label="Namn">
          <select data-f="cat" aria-label="Typ">${Object.keys(CATS).map(k => `<option value="${k}"${o.cat===k?' selected':''}>${CATS[k]}</option>`).join('')}</select></div>
        <div class="fields">${numField('Bredd cm','w',o.w)}${numField('Djup cm','h',o.h)}${numField('x','x',o.x)}${numField('y','y',o.y)}</div></div>`;
    }
    html += `<h2>Lägg till möbel</h2><p>Måtten är typiska. Ändra dem efter dina egna möbler när de ligger i planen. Den fasta inredningen (garderober, kök, badrum) är låst här och ändras i läget Väggar.</p><div class="catalog">`;
    CATALOG.forEach((c,i) => { html += `<button data-add="${i}"><span class="n">${esc(c[0])}</span><span class="d">${c[1]} × ${c[2]} cm</span></button>`; });
    html += `</div><h2>Egen möbel</h2><div class="fields f3" id="custom">
      <label>Namn<input type="text" id="c-name" placeholder="t.ex. Vår soffa"></label><label>Bredd cm<input type="number" id="c-w" value="120"></label><label>Djup cm<input type="number" id="c-h" value="60"></label></div>
      <div class="btnrow"><button class="btn primary" id="c-add">Lägg till</button></div>`;
  } else if(tab === 'rum'){
    html += `<p>Innermått i cm. Flytta rum genom att dra i planen, eller skriv in exakta mått här.</p>`;
    state.rooms.forEach(r => {
      const isSel = sel && sel.kind === 'room' && sel.id === r.id;
      html += `<div class="row${isSel?' sel':''}" data-obj="room" data-id="${r.id}">
        <div class="top"><input type="text" data-f="name" value="${esc(r.name)}" placeholder="Namnlös del" aria-label="Rumsnamn">
          <select data-f="kind" aria-label="Typ">${Object.keys(KINDS).map(k => `<option value="${k}"${r.kind===k?' selected':''}>${KINDS[k]}</option>`).join('')}</select>
          <button class="x" data-del="room" aria-label="Ta bort rum">×</button></div>
        <div class="fields">${numField('x','x',r.x)}${numField('y','y',r.y)}${numField('Bredd','w',r.w)}${numField('Djup','h',r.h)}</div></div>`;
    });
    html += `<div class="btnrow"><button class="btn" id="add-room">Nytt rum</button></div>`;
    html += `<h2>Extra väggbitar</h2><p>Små väggstycken som fyller igen springor mellan rum.</p>`;
    state.walls.forEach(w => {
      html += `<div class="row" data-obj="wall" data-id="${w.id}"><div class="fields f5">${numField('x','x',w.x)}${numField('y','y',w.y)}${numField('Bredd','w',w.w)}${numField('Höjd','h',w.h)}<label>&nbsp;<button class="btn danger" data-del="wall">Ta bort</button></label></div></div>`;
    });
    html += `<div class="btnrow"><button class="btn" id="add-wall">Ny väggbit</button></div>`;
    html += `<h2>Fast inredning</h2><p>Garderober, kök och badrum enligt planritningen. Går att flytta i planen eller justera här.</p>`;
    state.furniture.filter(f => f.fixed).forEach(f => {
      const isSel = sel && sel.kind === 'furn' && sel.id === f.id;
      html += `<div class="row${isSel?' sel':''}" data-obj="furn" data-id="${f.id}">
        <div class="top"><input type="text" data-f="name" value="${esc(f.name)}" aria-label="Namn"><button class="x" data-del="furn" aria-label="Ta bort">×</button></div>
        <div class="fields">${numField('x','x',f.x)}${numField('y','y',f.y)}${numField('Bredd','w',f.w)}${numField('Djup','h',f.h)}</div></div>`;
    });
  } else if(tab === 'oppningar'){
    html += `<p>Dörrar, fönster och öppningar. x och y är öppningens övre vänstra hörn i väggen. Riktning h = i en vågrät vägg, v = i en lodrät vägg.</p>`;
    state.openings.forEach(o => {
      const isSel = sel && sel.kind === 'open' && sel.id === o.id;
      html += `<div class="row${isSel?' sel':''}" data-obj="open" data-id="${o.id}">
        <div class="top"><select data-f="type" aria-label="Typ"><option value="door"${o.type==='door'?' selected':''}>Dörr</option><option value="window"${o.type==='window'?' selected':''}>Fönster</option><option value="opening"${o.type==='opening'?' selected':''}>Öppning</option></select>
          <input type="text" data-f="note" value="${esc(o.note||'')}" placeholder="Anteckning" aria-label="Anteckning">
          <button class="x" data-del="open" aria-label="Ta bort">×</button></div>
        <div class="fields f3">${numField('x','x',o.x)}${numField('y','y',o.y)}${numField('Längd','len',o.len)}</div>
        <div class="fields f3" style="margin-top:6px"><label>Riktning<select data-f="dir"><option value="h"${o.dir==='h'?' selected':''}>h</option><option value="v"${o.dir==='v'?' selected':''}>v</option></select></label>
          ${o.type==='door' ? `<label>Gångjärn<select data-f="hinge"><option value="0"${!o.hinge?' selected':''}>start</option><option value="1"${o.hinge?' selected':''}>slut</option></select></label>` : '<label>&nbsp;<span></span></label>'}
          ${numField('Väggtjocklek','thick',o.thick || state.wall)}
        </div></div>`;
    });
    html += `<div class="btnrow"><button class="btn" data-new-open="door">Ny dörr</button><button class="btn" data-new-open="window">Nytt fönster</button><button class="btn" data-new-open="opening">Ny öppning</button></div>`;
  } else if(tab === 'versioner'){
    html += `<p>Varje version är en egen möblering av samma lägenhet, så ni kan prova olika idéer sida vid sida. Allt sparas i den här webbläsaren. Dela en länk eller ladda ner en fil för att ta med en version till en annan enhet eller person.</p>
      <div class="btnrow"><button class="btn primary" id="v-new">Ny version från ritningen</button><button class="btn" id="v-dup">Kopiera aktiv</button><button class="btn" id="v-open">Öppna fil…</button></div>
      <input type="file" id="v-file" accept=".json,application/json" hidden>`;
    store.versions.forEach(v => {
      const active = v.id === store.activeId;
      const n = (v.state.furniture || []).filter(f => !f.fixed).length;
      html += `<div class="row ver${active?' active':''}" data-vid="${v.id}">
        <div class="top"><input type="text" data-vf="name" value="${esc(v.name)}" aria-label="Versionsnamn">${active ? '<span class="badge">Aktiv</span>' : '<button class="btn" data-vact="open">Öppna</button>'}</div>
        <div class="meta">Ändrad ${fmtDate(v.updatedAt)} · ${n} ${n === 1 ? 'möbel' : 'möbler'}</div>
        <div class="btnrow"><button data-vact="dup">Kopiera</button><button data-vact="share">Dela länk</button><button data-vact="download">Ladda ner</button><button data-vact="del" class="danger"${store.versions.length < 2 ? ' disabled' : ''}>Ta bort</button></div></div>`;
    });
    html += `<h2>Läs in från länk eller fil</h2><p>Har du fått en länk, eller innehållet i en nedladdad fil som text? Klistra in här.</p>
      <textarea class="json" id="v-paste" placeholder="Klistra in här"></textarea>
      <div class="btnrow"><button class="btn primary" id="v-paste-btn">Läs in som ny version</button></div>
      <textarea class="json" id="v-out" style="display:none" readonly aria-label="Delningslänk"></textarea>`;
  } else {
    html += `<h2>Att kolla mot verkligheten</h2><p>Det här är sådant i skissen som fick gissas. Mät på plats och rätta i läget Väggar, eller direkt i filen plan.js.</p><ul class="notes">${NOTES.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
    html += `<h2>Inställningar</h2>
      <div class="inline"><label for="s-wall">Väggtjocklek</label><input type="number" id="s-wall" value="${state.wall}" style="width:80px"> cm</div>
      <div class="inline"><label for="s-snap">Fäst mot rutnät</label><select id="s-snap"><option value="1"${state.snap==1?' selected':''}>1 cm</option><option value="5"${state.snap==5?' selected':''}>5 cm</option><option value="10"${state.snap==10?' selected':''}>10 cm</option></select></div>`;
    html += `<h2>Aktiv version: ${esc(activeVersion().name)}</h2><p>Börja om den här versionen från mäklarens ritning. Andra versioner påverkas inte.</p>
      <div class="btnrow"><button class="btn danger" id="reset">Börja om från ritningen</button></div>`;
    html += `<h2>Om</h2><p>Allt sparas automatiskt i den här webbläsaren. Vill du ha samma versioner på en annan enhet: dela en länk eller ladda ner en fil under Versioner.</p>
      <p><a href="../">Till annonsen</a> · <a href="https://github.com/filipgsonwfh/lillatorpsgatan-1b" rel="noopener">Källkod på GitHub</a></p>`;
  }
  content.innerHTML = html;
}

content.addEventListener('change', e => {
  const inp = e.target; const row = inp.closest('[data-obj]');
  if(row && inp.dataset.f){
    const kind = row.dataset.obj, id = row.dataset.id, f = inp.dataset.f;
    mutate(s => {
      const list = kind === 'furn' ? s.furniture : kind === 'room' ? s.rooms : kind === 'wall' ? s.walls : s.openings;
      const o = list.find(q => q.id === id); if(!o) return;
      if(kind !== 'furn' || o.fixed) s.wallsEdited = true;
      if(f === 'name' || f === 'note' || f === 'cat' || f === 'kind' || f === 'type' || f === 'dir') o[f] = inp.value;
      else if(f === 'hinge') o.hinge = inp.value === '1' ? 1 : 0;
      else { let v = num(inp.value, o[f]); if((f === 'w' || f === 'h' || f === 'len') && v < 5) v = 5; o[f] = v; }
    });
    return;
  }
  if(inp.dataset.vf === 'name'){
    const vrow = inp.closest('[data-vid]'); const v = store.versions.find(q => q.id === vrow.dataset.vid); if(!v) return;
    v.name = inp.value.trim() || 'Namnlös version'; if(inp.value !== v.name) inp.value = v.name;
    saveStore(); renderHeader(); return;
  }
  if(inp.id === 'v-file'){
    const file = inp.files && inp.files[0]; if(!file) return;
    Versions.readFile(file).then(p => importParsed(p), err => alert('Det gick inte att läsa filen: ' + (err && err.message || 'okänt fel')));
    inp.value = ''; return;
  }
  if(inp.id === 's-wall'){ mutate(s => { s.wall = Math.min(60, Math.max(2, num(inp.value, 14))); }); }
  if(inp.id === 's-snap'){ mutate(s => { s.snap = num(inp.value, 5); }); }
});
content.addEventListener('click', e => {
  const btn = e.target.closest('button'); if(!btn) return;
  if(btn.dataset.add !== undefined){
    const c = CATALOG[+btn.dataset.add];
    addFurniture(c[0], c[1], c[2], c[3]); return;
  }
  if(btn.id === 'c-add'){
    const name = document.getElementById('c-name').value.trim() || 'Möbel';
    addFurniture(name, Math.max(5, num(document.getElementById('c-w').value, 100)), Math.max(5, num(document.getElementById('c-h').value, 60)), 'ovrigt'); return;
  }
  if(btn.dataset.del){
    const row = btn.closest('[data-obj]'); const id = row.dataset.id; const kind = btn.dataset.del;
    if(kind === 'room' && !confirm('Ta bort rummet?')) return;
    mutate(s => { s.wallsEdited = true; if(kind === 'room') s.rooms = s.rooms.filter(r => r.id !== id); else if(kind === 'wall') s.walls = s.walls.filter(w => w.id !== id); else if(kind === 'furn') s.furniture = s.furniture.filter(f => f.id !== id); else s.openings = s.openings.filter(o => o.id !== id); });
    if(sel && sel.id === id) sel = null; render(); renderSelbar(); renderPanel(); return;
  }
  if(btn.id === 'add-room'){
    const c = {x: vb.x + vb.w/2, y: vb.y + vb.h/2};
    const r = {id:uid(), name:'Nytt rum', x:snap(c.x-150), y:snap(c.y-100), w:300, h:200, kind:'rum'};
    mutate(s => { s.wallsEdited = true; s.rooms.push(r); }); sel = {kind:'room', id:r.id}; render(); renderSelbar(); renderPanel(); return;
  }
  if(btn.id === 'add-wall'){
    const c = {x: vb.x + vb.w/2, y: vb.y + vb.h/2};
    mutate(s => { s.wallsEdited = true; s.walls.push({id:uid(), x:snap(c.x), y:snap(c.y), w:state.wall, h:100}); }); return;
  }
  if(btn.dataset.newOpen){
    const c = {x: vb.x + vb.w/2, y: vb.y + vb.h/2}; const type = btn.dataset.newOpen;
    const o = {id:uid(), type, x:snap(c.x), y:snap(c.y), len: type === 'window' ? 100 : 80, dir:'h', hinge:0, flip:false, note:''};
    mutate(s => { s.wallsEdited = true; s.openings.push(o); }); sel = {kind:'open', id:o.id}; render(); renderSelbar(); renderPanel(); return;
  }
  /* Versioner */
  if(btn.id === 'v-new'){
    const v = addVersion(uniqueName('Version ' + (store.versions.length + 1)), freshState(), true);
    toast('Ny version skapad'); focusVersionName(v.id); return;
  }
  if(btn.id === 'v-dup'){ dupVersion(activeVersion()); return; }
  if(btn.id === 'v-open'){ document.getElementById('v-file').click(); return; }
  if(btn.id === 'v-paste-btn'){
    const ta = document.getElementById('v-paste');
    importText(ta.value).then(() => { ta.value = ''; }, err => alert('Det gick inte att läsa in: ' + (err && err.message || 'okänt fel')));
    return;
  }
  if(btn.dataset.vact){
    const vrow = btn.closest('[data-vid]'); const v = store.versions.find(q => q.id === vrow.dataset.vid); if(!v) return;
    const act = btn.dataset.vact;
    if(act === 'open') activate(v.id);
    else if(act === 'dup') dupVersion(v);
    else if(act === 'share') shareVersion(v);
    else if(act === 'download') Versions.download('lillatorpsgatan-1b-' + Versions.slug(v.name) + '.json', Versions.payload(v));
    else if(act === 'del'){
      if(store.versions.length < 2) return;
      if(!confirm('Ta bort versionen "' + v.name + '"? Det går inte att ångra.')) return;
      const wasActive = v.id === store.activeId;
      store.versions = store.versions.filter(q => q.id !== v.id);
      if(wasActive) activate(store.versions[0].id); else { saveStore(); renderPanel(); }
      toast('Versionen togs bort');
    }
    return;
  }
  if(btn.id === 'reset'){
    if(!confirm('Börja om den här versionen från ritningen? Flyttade möbler och ändringar i versionen försvinner (Ångra fungerar en gång).')) return;
    const before = JSON.stringify(state); state = freshState(); pushHistory(before); sel = null; commit(); checkVersion(); fit(); return;
  }
});
function addFurniture(name, w, h, cat){
  const c = {x: vb.x + vb.w/2, y: vb.y + vb.h/2};
  const f = {id:uid(), name, x:snap(c.x - w/2), y:snap(c.y - h/2), w, h, cat};
  mutate(s => s.furniture.push(f));
  sel = {kind:'furn', id:f.id}; render(); renderSelbar(); renderPanel();
}

/* ---------- Start ---------- */
function init(){
  store = Versions.load();
  if(!store){
    store = {activeId: null, versions: []};
    const legacy = normalize(Versions.loadLegacy());
    const v = Versions.make('Grundplan', legacy && legacy.rooms.length ? legacy : freshState());
    store.versions.push(v); store.activeId = v.id;
  }
  store.versions.forEach(v => { v.state = normalize(v.state) || freshState(); if(!v.name) v.name = 'Namnlös version'; });
  const a = activeVersion(); store.activeId = a.id; state = a.state;
  saveStore();
  document.body.classList.toggle('mode-rum', mode === 'rum');
  render(); renderPanel(); renderSelbar(); renderHeader(); checkVersion();
  requestAnimationFrame(fit);
  importFromHash();
  window.addEventListener('hashchange', importFromHash);
}
init();
})();
