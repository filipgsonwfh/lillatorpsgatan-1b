/* Versioner: lagring i webbläsaren, delningslänkar och filer.
 *
 * Lagringsformat (localStorage):
 *   { activeId, versions: [{ id, name, createdAt, updatedAt, source?, state }] }
 *
 * Delningslänk: #v=<d|j><base64url>
 *   d = deflate-raw-packad JSON, j = opackad JSON (reserv för äldre webbläsare)
 */
const Versions = (function(){
  'use strict';
  const STORE_KEY = 'lgh-planner-versions-v1';
  const LEGACY_KEY = 'lgh-planner-v1';

  function uid(){ return 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function clone(o){ return JSON.parse(JSON.stringify(o)); }

  function load(){
    try{
      const raw = localStorage.getItem(STORE_KEY); if(!raw) return null;
      const s = JSON.parse(raw);
      if(!s || !Array.isArray(s.versions) || !s.versions.length) return null;
      return s;
    }catch(e){ return null; }
  }
  function loadLegacy(){ try{ const raw = localStorage.getItem(LEGACY_KEY); return raw ? JSON.parse(raw) : null; }catch(e){ return null; } }
  function save(store){ try{ localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; }catch(e){ return false; } }
  function make(name, state){
    const now = Date.now();
    return {id: uid(), name: name || 'Namnlös version', createdAt: now, updatedAt: now, state: clone(state)};
  }

  /* ---- base64url + deflate ---- */
  function b64u(bytes){
    let s = '';
    for(let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function unb64u(str){
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while(str.length % 4) str += '=';
    const bin = atob(str); const out = new Uint8Array(bin.length);
    for(let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function pipe(bytes, stream){
    const w = stream.writable.getWriter();
    const written = w.write(bytes).then(() => w.close());
    const reader = stream.readable.getReader();
    const chunks = []; let len = 0;
    for(;;){
      const {value, done} = await reader.read();
      if(done) break;
      chunks.push(value); len += value.length;
    }
    await written;
    const out = new Uint8Array(len); let o = 0;
    for(const c of chunks){ out.set(c, o); o += c.length; }
    return out;
  }
  const canDeflate = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

  async function encodeShare(obj){
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    if(canDeflate){
      try{ return 'd' + b64u(await pipe(bytes, new CompressionStream('deflate-raw'))); }catch(e){ /* reserv nedan */ }
    }
    return 'j' + b64u(bytes);
  }
  async function decodeShare(str){
    str = String(str || '').trim();
    const kind = str[0]; let bytes = unb64u(str.slice(1));
    if(kind === 'd'){
      if(!canDeflate) throw new Error('Webbläsaren kan inte packa upp länken');
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
    } else if(kind !== 'j') throw new Error('Okänt länkformat');
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  /* ---- Tolka inklistrad text: hel länk, bara koden eller JSON från en fil ---- */
  function fromPayload(p){
    if(!p || typeof p !== 'object') throw new Error('Tomt innehåll');
    if(p.state && Array.isArray(p.state.rooms)) return {id: p.id, name: p.name, updatedAt: p.updatedAt, state: p.state};
    if(Array.isArray(p.rooms)) return {name: 'Importerad', state: p};
    throw new Error('Innehåller ingen ritning');
  }
  async function parseImport(text){
    text = String(text || '').trim();
    if(!text) throw new Error('Inget att läsa in');
    const m = text.match(/#v=([A-Za-z0-9_-]+)/);
    if(m) return fromPayload(await decodeShare(m[1]));
    if(text[0] === '{') return fromPayload(JSON.parse(text));
    if(/^[dj][A-Za-z0-9_-]+$/.test(text)) return fromPayload(await decodeShare(text));
    throw new Error('Kände inte igen formatet');
  }
  async function readFile(file){ return parseImport(await file.text()); }

  /* ---- Export ---- */
  function payload(v){ return {app: 'lagenhetsplaneraren', v: 1, id: v.id, name: v.name, updatedAt: v.updatedAt, state: v.state}; }
  function download(filename, obj){
    const blob = new Blob([JSON.stringify(obj, null, 1)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function slug(s){
    return String(s || 'version').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'version';
  }

  return {load, loadLegacy, save, make, encodeShare, decodeShare, parseImport, readFile, payload, download, slug};
})();
