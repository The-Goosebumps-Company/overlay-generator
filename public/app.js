import { drawFrame, defaults, normalize, FPS_OPTIONS, fontStr } from './renderer.js';
import { makeZip, encodePNG, gzip } from './zip.js';
import { BUILTIN_PRESETS } from './presets.js';
import { log, errInfo, setRemoteLogging } from './log.js';
import { encodeMov } from './encode-wasm.js';
import { saveFont, listFonts } from './fonts-store.js';

// Log control tweaks without flooding: one entry per control after it settles
const ctlTimers = {};
const logControl = (k, v) => { clearTimeout(ctlTimers[k]); ctlTimers[k] = setTimeout(() => log('info', 'edit', { control: k, value: Array.isArray(v) ? v.join(',') : v }), 800); };

const $ = (id) => document.getElementById(id);
const GOOGLE_FONTS = ['Krona One', 'Figtree', 'Montserrat', 'Inter', 'Poppins', 'DM Sans', 'Archivo', 'Lexend', 'Unbounded', 'Syne', 'Space Grotesk', 'Michroma', 'Oswald', 'Bebas Neue', 'Anton'];
const customFonts = new Set();

let state = loadCurrent() || normalize(BUILTIN_PRESETS[0]);
let server = { ok: false, ffmpeg: false };
let sharedPresets = [];
let playing = true, t = 0, lastTs = 0;

// ---------- controls schema ----------
const SECTIONS = [
  { title: 'Text', open: true, items: [
    { k: 'text.content', type: 'textarea', label: 'Text (one line per row)' },
    { k: 'text.uppercase', type: 'check', label: 'ALL CAPS' },
    { k: 'text.font', type: 'font', label: 'Font' },
    { k: 'text.weight', type: 'select', label: 'Weight', options: [300, 400, 500, 600, 700, 800, 900] },
    { k: 'text.size', type: 'range', label: 'Size', min: 12, max: 220, step: 1 },
    { k: 'text.lineHeight', type: 'range', label: 'Line height', min: 0.7, max: 2, step: 0.01 },
    { k: 'text.tracking', type: 'range', label: 'Letter spacing', min: -0.1, max: 0.5, step: 0.005 },
    { k: 'text.align', type: 'select', label: 'Align', options: ['left', 'center', 'right'] },
    { k: 'text.color', type: 'color', label: 'Colour' },
    { k: 'text.revealTint', type: 'color', label: 'Reveal tint' },
    { k: 'text.shadow', type: 'range', label: 'Text shadow', min: 0, max: 40, step: 1 },
  ] },
  { title: 'Box & glow', open: true, items: [
    { k: 'card.colors', type: 'colors', label: 'Glow colours', max: 5 },
    { k: 'card.angle', type: 'range', label: 'Gradient angle', min: 0, max: 360, step: 1 },
    { k: 'card.glow', type: 'range', label: 'Glow depth', min: 4, max: 400, step: 1 },
    { k: 'card.softness', type: 'range', label: 'Softness', min: 0.2, max: 2.5, step: 0.05 },
    { k: 'card.opacity', type: 'range', label: 'Glow opacity', min: 0, max: 1, step: 0.01 },
    { k: 'card.radius', type: 'range', label: 'Corner radius', min: 0, max: 160, step: 1 },
    { k: 'card.padX', type: 'range', label: 'Padding X', min: 0, max: 400, step: 1 },
    { k: 'card.padY', type: 'range', label: 'Padding Y', min: 0, max: 400, step: 1 },
    { k: 'card.minWidth', type: 'range', label: 'Min width', min: 0, max: 3000, step: 1 },
    { k: 'card.minHeight', type: 'range', label: 'Min height', min: 0, max: 2000, step: 1 },
    { k: 'card.fill', type: 'color', label: 'Backing tint' },
    { k: 'card.fillOpacity', type: 'range', label: 'Tint opacity', min: 0, max: 1, step: 0.01 },
  ] },
  { title: 'Moving light', items: [
    { k: 'blobs.enabled', type: 'check', label: 'Animated light blobs' },
    { k: 'blobs.colors', type: 'colors', label: 'Colours', max: 4 },
    { k: 'blobs.count', type: 'range', label: 'Count', min: 0, max: 8, step: 1 },
    { k: 'blobs.size', type: 'range', label: 'Size', min: 0.05, max: 1, step: 0.01 },
    { k: 'blobs.speed', type: 'range', label: 'Speed', min: 0, max: 5, step: 0.05 },
    { k: 'blobs.intensity', type: 'range', label: 'Intensity', min: 0, max: 1, step: 0.01 },
  ] },
  { title: 'Badge (time / tag)', items: [
    { k: 'badge.enabled', type: 'check', label: 'Show badge above text' },
    { k: 'badge.text', type: 'text', label: 'Badge text' },
    { k: 'badge.scramble', type: 'check', label: 'Scramble digits on reveal' },
    { k: 'badge.size', type: 'range', label: 'Size', min: 12, max: 220, step: 1 },
    { k: 'badge.weight', type: 'select', label: 'Weight', options: [300, 400, 500, 600, 700, 800, 900] },
    { k: 'badge.colors', type: 'colors', label: 'Glow colours', max: 4 },
    { k: 'badge.glow', type: 'range', label: 'Glow depth', min: 2, max: 200, step: 1 },
    { k: 'badge.radius', type: 'range', label: 'Corner radius', min: 0, max: 100, step: 1 },
    { k: 'badge.padX', type: 'range', label: 'Padding X', min: 0, max: 200, step: 1 },
    { k: 'badge.padY', type: 'range', label: 'Padding Y', min: 0, max: 120, step: 1 },
    { k: 'badge.gap', type: 'range', label: 'Gap to text', min: 0, max: 200, step: 1 },
  ] },
  { title: 'Animation', open: true, items: [
    { k: 'anim.in', type: 'check', label: 'Animate IN' },
    { k: 'anim.inStyle', type: 'select', label: 'In style', options: [['line', 'Line → box'], ['fade', 'Fade'], ['pop', 'Pop'], ['slide', 'Slide up']] },
    { k: 'anim.inDur', type: 'range', label: 'In length (s)', min: 0.2, max: 5, step: 0.05 },
    { k: 'anim.out', type: 'check', label: 'Animate OUT' },
    { k: 'anim.outStyle', type: 'select', label: 'Out style', options: [['line', 'Box → line'], ['fade', 'Fade'], ['pop', 'Shrink'], ['slide', 'Slide up']] },
    { k: 'anim.outDur', type: 'range', label: 'Out length (s)', min: 0.2, max: 5, step: 0.05 },
    { k: 'anim.textStyle', type: 'select', label: 'Text reveal', options: [['cascade', 'Letter cascade'], ['words', 'Word by word'], ['lines', 'Line by line'], ['typewriter', 'Typewriter'], ['fade', 'Fade']] },
  ] },
  { title: 'Position', items: [
    { k: 'layout.anchor', type: 'select', label: 'Anchor', options: [['top-left', 'Top left'], ['top-center', 'Top centre'], ['top-right', 'Top right'], ['middle-left', 'Middle left'], ['center', 'Centre'], ['middle-right', 'Middle right'], ['bottom-left', 'Bottom left (lower third)'], ['bottom-center', 'Bottom centre'], ['bottom-right', 'Bottom right']] },
    { k: 'layout.scale', type: 'range', label: 'Scale', min: 0.2, max: 3, step: 0.01 },
    { k: 'layout.offsetX', type: 'range', label: 'Nudge X %', min: -50, max: 50, step: 0.5 },
    { k: 'layout.offsetY', type: 'range', label: 'Nudge Y %', min: -50, max: 50, step: 0.5 },
    { k: 'layout.safe', type: 'range', label: 'Safe margin %', min: 0, max: 20, step: 0.5 },
    { k: 'layout.autoFit', type: 'check', label: 'Auto-shrink to fit frame' },
  ] },
];

const getP = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const setP = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const binders = [];

function buildControls() {
  const root = $('controls');
  root.innerHTML = '';
  binders.length = 0;
  const openState = JSON.parse(localStorage.getItem('og-open') || '{}');
  for (const sec of SECTIONS) {
    const d = document.createElement('details');
    d.className = 'section';
    d.open = openState[sec.title] ?? !!sec.open;
    d.addEventListener('toggle', () => { openState[sec.title] = d.open; localStorage.setItem('og-open', JSON.stringify(openState)); });
    d.innerHTML = `<summary>${sec.title}</summary><div class="body"></div>`;
    const body = d.querySelector('.body');
    for (const it of sec.items) body.appendChild(makeControl(it));
    root.appendChild(d);
  }
}

function makeControl(it) {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  const label = `<span>${it.label}</span>`;
  const commit = (v) => { setP(state, it.k, v); logControl(it.k, v); changed(); };
  if (it.type === 'range') {
    wrap.innerHTML = `${label}<input type="range" min="${it.min}" max="${it.max}" step="${it.step}"><span class="val"><input type="number" step="${it.step}"></span>`;
    const [r, n] = wrap.querySelectorAll('input');
    r.oninput = () => { n.value = r.value; commit(+r.value); };
    n.onchange = () => { r.value = n.value; commit(+n.value); };
    binders.push(() => { const v = getP(state, it.k); r.value = v; n.value = v; });
  } else if (it.type === 'textarea') {
    wrap.className = 'ctl full';
    wrap.innerHTML = `${label}<textarea spellcheck="false"></textarea>`;
    const ta = wrap.querySelector('textarea');
    ta.oninput = () => commit(ta.value);
    binders.push(() => { ta.value = getP(state, it.k); });
  } else if (it.type === 'text') {
    wrap.className = 'ctl wide2';
    wrap.innerHTML = `${label}<input type="text">`;
    const el = wrap.querySelector('input');
    el.oninput = () => commit(el.value);
    binders.push(() => { el.value = getP(state, it.k); });
  } else if (it.type === 'check') {
    wrap.className = 'ctl full';
    wrap.innerHTML = `<label class="check"><input type="checkbox"> ${it.label}</label>`;
    const el = wrap.querySelector('input');
    el.onchange = () => commit(el.checked);
    binders.push(() => { el.checked = !!getP(state, it.k); });
  } else if (it.type === 'color') {
    wrap.className = 'ctl wide2';
    wrap.innerHTML = `${label}<input type="color">`;
    const el = wrap.querySelector('input');
    el.oninput = () => commit(el.value);
    binders.push(() => { el.value = getP(state, it.k); });
  } else if (it.type === 'select') {
    wrap.className = 'ctl wide2';
    const opts = it.options.map((o) => (Array.isArray(o) ? o : [o, o]));
    wrap.innerHTML = `${label}<select>${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
    const el = wrap.querySelector('select');
    el.onchange = () => commit(typeof opts[0][0] === 'number' ? +el.value : el.value);
    binders.push(() => { el.value = getP(state, it.k); });
  } else if (it.type === 'colors') {
    wrap.className = 'ctl wide2';
    wrap.innerHTML = `${label}<div class="colors"></div>`;
    const box = wrap.querySelector('.colors');
    const render = () => {
      const arr = getP(state, it.k);
      box.innerHTML = '';
      arr.forEach((c, i) => {
        const el = document.createElement('input');
        el.type = 'color'; el.value = c;
        el.oninput = () => { arr[i] = el.value; changed(); };
        box.appendChild(el);
      });
      if (arr.length < it.max) { const b = document.createElement('button'); b.textContent = '+'; b.title = 'Add colour'; b.onclick = () => { arr.push(arr[arr.length - 1] || '#ffffff'); render(); changed(); }; box.appendChild(b); }
      if (arr.length > 1) { const b = document.createElement('button'); b.textContent = '−'; b.title = 'Remove colour'; b.onclick = () => { arr.pop(); render(); changed(); }; box.appendChild(b); }
    };
    binders.push(render);
  } else if (it.type === 'font') {
    wrap.className = 'ctl full';
    wrap.innerHTML = `${label}<div class="font-row"><select></select><label class="btn" title="Upload a brand font (.ttf/.otf/.woff/.woff2). Shared with the office when running on the server.">Upload<input type="file" accept=".ttf,.otf,.woff,.woff2" hidden></label></div>`;
    const sel = wrap.querySelector('select');
    const file = wrap.querySelector('input[type=file]');
    const fill = () => {
      const cur = getP(state, it.k);
      const all = [...customFonts, ...GOOGLE_FONTS];
      if (!all.includes(cur)) all.unshift(cur);
      sel.innerHTML = '';
      if (customFonts.size) sel.innerHTML += `<optgroup label="Brand fonts">${[...customFonts].map((f) => `<option>${f}</option>`).join('')}</optgroup>`;
      sel.innerHTML += `<optgroup label="Google fonts">${all.filter((f) => !customFonts.has(f)).map((f) => `<option>${f}</option>`).join('')}</optgroup>`;
      sel.value = cur;
    };
    sel.onchange = () => commit(sel.value);
    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      const fam = await addFontFile(f);
      setP(state, it.k, fam);
      fill(); changed();
      file.value = '';
    };
    binders.push(fill);
    fontSelectRefreshers.push(fill);
  }
  return wrap;
}
const fontSelectRefreshers = [];
const syncControls = () => binders.forEach((b) => b());

// ---------- fonts ----------
const familyFromFile = (name) => name.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').trim();
async function registerFont(family, src) {
  const face = new FontFace(family, src);
  await face.load();
  document.fonts.add(face);
  customFonts.add(family);
}
async function addFontFile(file) {
  const buf = await file.arrayBuffer();
  const fam = familyFromFile(file.name);
  log('info', 'font.upload', { file: file.name, family: fam, kb: Math.round(buf.byteLength / 1024) });
  try { await registerFont(fam, buf); } catch (e) { log('error', 'font.invalid', { file: file.name, ...errInfo(e) }); toast(`Couldn’t read “${file.name}” as a font`); throw e; }
  if (server.ok) {
    const r = await fetch(`/api/fonts?file=${encodeURIComponent(file.name)}`, { method: 'POST', body: buf });
    toast(r.ok ? `“${fam}” uploaded and shared with everyone` : `“${fam}” loaded (couldn't share it with the office)`);
  } else {
    try { await saveFont(fam, file.name, buf); toast(`“${fam}” installed in this app`); }
    catch (e) { log('warn', 'font.persist.failed', errInfo(e)); toast(`“${fam}” loaded for this session`); }
  }
  return fam;
}
async function loadFonts() {
  const jobs = [];
  if (server.ok) {
    try {
      const list = await (await fetch('/api/fonts')).json();
      for (const f of list) jobs.push(registerFont(f.family, `url("/fonts/${encodeURIComponent(f.file)}")`));
    } catch (e) { log('warn', 'fonts.server.failed', errInfo(e)); }
  } else {
    for (const f of teamLibrary.fonts || []) jobs.push(registerFont(f.family, `url("shared/fonts/${encodeURIComponent(f.file)}")`));
    try { for (const f of await listFonts()) jobs.push(registerFont(f.family, f.data)); } catch (e) { log('warn', 'fonts.local.failed', errInfo(e)); }
  }
  const results = await Promise.allSettled(jobs);
  results.filter((r) => r.status === 'rejected').forEach((r) => log('warn', 'font.load.failed', errInfo(r.reason)));
  fontSelectRefreshers.forEach((f) => f());
}
async function ensureFonts(s = state) {
  const loads = [document.fonts.load(fontStr(s.text.weight, 40, s.text.font), s.text.content || 'A')];
  if (s.badge.enabled) loads.push(document.fonts.load(fontStr(s.badge.weight, 40, s.text.font), s.badge.text || '0'));
  try { await Promise.all(loads); } catch {}
}

// ---------- preview ----------
const canvas = $('preview');
const ctx = canvas.getContext('2d');
const fpsNum = () => FPS_OPTIONS[state.fps].num;

function fitViewport() {
  const wrap = $('viewportWrap');
  const vw = wrap.clientWidth, vh = wrap.clientHeight;
  if (!vw || !vh) return;
  const ar = state.width / state.height;
  let w = vw, h = vw / ar;
  if (h > vh) { h = vh; w = vh * ar; }
  const vp = $('viewport');
  vp.style.width = `${Math.floor(w)}px`;
  vp.style.height = `${Math.floor(h)}px`;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.min(state.width, Math.round(w * dpr));
  canvas.height = Math.round(canvas.width * state.height / state.width);
  drawMarkers();
  render();
}
function render() { drawFrame(ctx, state, t, state.width, state.height); }

function drawMarkers() {
  const m = $('markers');
  const D = state.duration;
  m.innerHTML = '';
  if (state.anim.in) m.innerHTML += `<span style="left:0;width:${(Math.min(state.anim.inDur, D) / D) * 100}%"></span>`;
  if (state.anim.out) m.innerHTML += `<span class="out" style="left:${(Math.max(0, D - state.anim.outDur) / D) * 100}%;width:${(Math.min(state.anim.outDur, D) / D) * 100}%"></span>`;
}

function fmtTime(sec) {
  const f = Math.floor((sec % 1) * fpsNum());
  return `${String(Math.floor(sec)).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
}
function loop(ts) {
  const dt = lastTs ? (ts - lastTs) / 1000 : 0;
  lastTs = ts;
  if (playing) {
    t += dt;
    if (t > state.duration + 0.4) t = 0; // small pause after the out
  }
  render();
  $('scrub').value = Math.round((Math.min(t, state.duration) / state.duration) * 1000);
  $('timecode').textContent = fmtTime(Math.min(t, state.duration));
  requestAnimationFrame(loop);
}

let saveTimer;
let fontTimer;
function changed() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => localStorage.setItem('og-current', JSON.stringify(state)), 300);
  clearTimeout(fontTimer);
  fontTimer = setTimeout(() => ensureFonts().then(render), 50);
  drawMarkers();
  render();
}
function loadCurrent() { try { const s = JSON.parse(localStorage.getItem('og-current')); return s ? normalize(s) : null; } catch { return null; } }

function applyState(s) {
  log('info', 'design.load', { name: s?.name, size: `${s?.width}x${s?.height}` });
  state = normalize(s);
  syncOutputUI();
  syncControls();
  ensureFonts().then(fitViewport);
  t = 0;
  changed();
}

// ---------- output settings ----------
function syncOutputUI() {
  const key = `${state.width}x${state.height}`;
  const sel = $('resSelect');
  sel.value = [...sel.options].some((o) => o.value === key) ? key : 'custom';
  $('customRes').hidden = sel.value !== 'custom';
  $('resW').value = state.width; $('resH').value = state.height;
  $('fpsSelect').value = state.fps;
  $('durInput').value = state.duration;
}
function setupOutput() {
  $('fpsSelect').innerHTML = Object.keys(FPS_OPTIONS).map((f) => `<option value="${f}">${f} fps</option>`).join('');
  $('resSelect').onchange = () => {
    const v = $('resSelect').value;
    $('customRes').hidden = v !== 'custom';
    if (v !== 'custom') { const [w, h] = v.split('x').map(Number); state.width = w; state.height = h; syncOutputUI(); fitViewport(); changed(); }
  };
  const custom = () => { state.width = Math.max(16, +$('resW').value || 1920); state.height = Math.max(16, +$('resH').value || 1080); fitViewport(); changed(); };
  $('resW').onchange = custom; $('resH').onchange = custom;
  $('fpsSelect').onchange = () => { state.fps = $('fpsSelect').value; changed(); };
  $('durInput').onchange = () => { state.duration = Math.max(0.5, +$('durInput').value || 5); changed(); };
  $('formatSelect').onchange = updateFormatHint;
}
function updateFormatHint() {
  const f = $('formatSelect').value;
  const hints = {
    prores: 'Best choice. Plays smoothly in Premiere, After Effects and DaVinci Resolve. Large files.',
    qtrle: 'Same lossless codec as the design team’s files. Very large; can be slow in Resolve.',
    png: 'Lossless frames in a .zip. Works in every editing app.',
  };
  let h = hints[f];
  if (f !== 'png' && !server.ffmpeg) h += ' Encoded on this computer (the first export loads a 32 MB encoder).';
  $('formatHint').textContent = h;
  $('exportBtn').disabled = false;
}

// ---------- export ----------
const slug = (s) => (s || 'overlay').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 60) || 'overlay';
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
function progress(p, text) {
  $('progress').hidden = p == null;
  $('progressBar').style.width = `${Math.round((p || 0) * 100)}%`;
  $('progressText').textContent = text || '';
}
const outName = () => slug(state.text.content.split('\n').join(' '));

async function exportOverlay() {
  const fmt = $('formatSelect').value;
  const tStart = performance.now();
  log('info', 'export.start', { engine: fmt === 'png' ? 'browser' : server.ffmpeg ? 'server' : 'browser-ffmpeg', format: fmt, name: state.name, size: `${state.width}x${state.height}`, fps: state.fps, duration: state.duration, text: state.text.content.replace(/\n/g, ' / ') });
  const s = structuredClone(state);
  await ensureFonts(s);
  const W = s.width, H = s.height, fr = FPS_OPTIONS[s.fps];
  const N = Math.max(1, Math.round(s.duration * fr.num));
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d', { willReadFrequently: true });
  const pixels = (n) => { drawFrame(octx, s, n / fr.num, W, H); return octx.getImageData(0, 0, W, H).data; };
  const name = `${outName()}_${W}x${H}_${s.fps}fps`;
  $('exportBtn').disabled = true;
  try {
    if (fmt === 'png') {
      const files = [];
      for (let n = 0; n < N; n++) {
        files.push({ name: `${name}/${name}_${String(n).padStart(5, '0')}.png`, data: await encodePNG(pixels(n), W, H) });
        progress((n + 1) / N, `Rendering frame ${n + 1} / ${N}`);
      }
      progress(1, 'Zipping…');
      download(makeZip(files), `${name}_PNG.zip`);
    } else if (!server.ffmpeg) {
      // No server: encode on this computer with ffmpeg.wasm
      const blob = await encodeMov({ count: N, rate: fr.rate, format: fmt, frame: (n) => encodePNG(pixels(n), W, H), onProgress: (p, msg) => progress(p, msg) });
      download(blob, `${name}${fmt === 'prores' ? '_ProRes4444' : '_Animation'}.mov`);
    } else {
      const job = await (await fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fps: s.fps, width: W, height: H, format: fmt, name, frames: N }) })).json();
      if (!job.id) throw new Error(job.error || 'Server refused the job');
      const inflight = new Set();
      let sent = 0;
      for (let n = 0; n < N; n++) {
        const body = await gzip(pixels(n));
        const p = fetch(`/api/render/${job.id}/${n}`, { method: 'PUT', body }).then((r) => { if (!r.ok) throw new Error('Upload failed'); sent++; progress(sent / N * 0.9, `Rendering frame ${sent} / ${N}`); });
        inflight.add(p); p.finally(() => inflight.delete(p));
        if (inflight.size >= 6) await Promise.race(inflight);
      }
      await Promise.all(inflight);
      progress(0.93, fmt === 'prores' ? 'Encoding ProRes 4444…' : 'Encoding QuickTime Animation…');
      const r = await fetch(`/api/render/${job.id}/finish`, { method: 'POST' });
      if (!r.ok) throw new Error(await r.text());
      download(await r.blob(), `${name}${fmt === 'prores' ? '_ProRes4444' : '_Animation'}.mov`);
    }
    log('info', 'export.done', { format: fmt, seconds: +((performance.now() - tStart) / 1000).toFixed(1) });
    progress(1, 'Done ✓');
    toast('Export finished. Check your Downloads folder.');
    setTimeout(() => progress(null), 2500);
  } catch (e) {
    log('error', 'export.failed', { format: fmt, ...errInfo(e) });
    progress(null);
    toast(`Export failed: ${e.message}`);
  } finally {
    updateFormatHint();
  }
}
async function exportStill() {
  log('info', 'export.still', { t: +t.toFixed(2) });
  const s = structuredClone(state);
  await ensureFonts(s);
  const off = document.createElement('canvas');
  off.width = s.width; off.height = s.height;
  const c = off.getContext('2d', { willReadFrequently: true });
  drawFrame(c, s, Math.min(t, s.duration - 0.001), s.width, s.height);
  const png = await encodePNG(c.getImageData(0, 0, s.width, s.height).data, s.width, s.height);
  download(new Blob([png], { type: 'image/png' }), `${outName()}_${s.width}x${s.height}.png`);
}

// ---------- presets ----------
function presetOptions() {
  const sel = $('presetSelect');
  const local = JSON.parse(localStorage.getItem('og-presets') || '[]');
  sel.innerHTML = `<option value="">Presets…</option>`
    + `<optgroup label="Built-in">${BUILTIN_PRESETS.map((p, i) => `<option value="b:${i}">${p.name}</option>`).join('')}</optgroup>`
    + (sharedPresets.length ? `<optgroup label="${server.ok ? 'Shared (office)' : 'Team presets'}">${sharedPresets.map((p, i) => `<option value="s:${i}">${p.name}</option>`).join('')}</optgroup>` : '')
    + (local.length ? `<optgroup label="This browser">${local.map((p, i) => `<option value="l:${i}">${p.name}</option>`).join('')}</optgroup>` : '');
}
let teamLibrary = { presets: [], fonts: [] };
async function loadTeamLibrary() {
  // Presets + brand fonts bundled into the package by the build script (shared/library.json)
  try {
    const r = await fetch('shared/library.json', { cache: 'no-cache' });
    if (r.ok) teamLibrary = await r.json();
  } catch {}
}
async function loadShared() {
  if (server.ok) {
    try { sharedPresets = await (await fetch('/api/presets')).json(); } catch { sharedPresets = []; }
  } else sharedPresets = teamLibrary.presets || [];
  presetOptions();
}
function setupPresets() {
  presetOptions();
  $('presetSelect').onchange = () => {
    const v = $('presetSelect').value; if (!v) return;
    const [kind, i] = v.split(':');
    const src = kind === 'b' ? BUILTIN_PRESETS : kind === 's' ? sharedPresets : JSON.parse(localStorage.getItem('og-presets') || '[]');
    applyState(src[+i]);
    $('deletePreset').disabled = kind === 'b';
  };
  $('savePreset').onclick = async () => {
    const name = prompt('Preset name (e.g. "Event schedule – purple")', state.name && state.name !== 'Untitled' ? state.name : '');
    if (!name) return;
    state.name = name;
    if (server.ok) {
      const r = await fetch('/api/presets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) });
      if (r.ok) { toast(`Saved “${name}”. Everyone in the office can now use it.`); await loadShared(); return; }
    }
    const local = JSON.parse(localStorage.getItem('og-presets') || '[]').filter((p) => p.name !== name);
    local.push(structuredClone(state));
    localStorage.setItem('og-presets', JSON.stringify(local));
    presetOptions();
    toast(`Saved “${name}” in this browser`);
  };
  $('deletePreset').onclick = async () => {
    const v = $('presetSelect').value; if (!v || v.startsWith('b:')) return toast('Pick a shared or saved preset to delete');
    const [kind, i] = v.split(':');
    const list = kind === 's' ? sharedPresets : JSON.parse(localStorage.getItem('og-presets') || '[]');
    const p = list[+i];
    if (!confirm(`Delete preset “${p.name}”?`)) return;
    if (kind === 's' && !server.ok) return toast('Team presets come with the app and can’t be deleted here');
    if (kind === 's') { await fetch(`/api/presets?name=${encodeURIComponent(p.name)}`, { method: 'DELETE' }); await loadShared(); }
    else { list.splice(+i, 1); localStorage.setItem('og-presets', JSON.stringify(list)); presetOptions(); }
    toast('Preset deleted');
  };
  $('exportJson').onclick = () => download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `${slug(state.name || outName())}.json`);
  $('importJson').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { applyState(JSON.parse(await f.text())); toast('Design loaded'); } catch (err) { log('error', 'json.import.failed', { file: f.name, ...errInfo(err) }); toast('That file isn’t a valid overlay design'); }
    e.target.value = '';
  };
}

// ---------- background ----------
function setupBackground() {
  const vp = $('viewport');
  $('bgSelect').onchange = () => {
    const v = $('bgSelect').value;
    if (v === 'media') { $('bgFile').click(); return; }
    vp.className = `viewport bg-${v}`;
    $('bgImage').hidden = true; $('bgVideo').hidden = true; $('bgVideo').pause();
  };
  $('bgFile').onchange = () => {
    const f = $('bgFile').files[0]; if (!f) { $('bgSelect').value = 'checker'; return; }
    const url = URL.createObjectURL(f);
    vp.className = 'viewport bg-media';
    if (f.type.startsWith('video')) { $('bgVideo').src = url; $('bgVideo').hidden = false; $('bgImage').hidden = true; $('bgVideo').play(); }
    else { $('bgImage').src = url; $('bgImage').hidden = false; $('bgVideo').hidden = true; }
  };
}

// ---------- misc ----------
function toast(msg) {
  const el = $('toast').content.firstElementChild.cloneNode(true);
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}
async function checkServer(initial = false) {
  const pill = $('serverStatus');
  const was = server.ok;
  let st = null;
  try {
    const r = await fetch('/api/status', { cache: 'no-store' });
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) st = await r.json();
  } catch {}
  if (st?.ok) {
    server = { ok: true, ffmpeg: !!st.ffmpeg };
    setRemoteLogging(true);
    pill.textContent = st.local ? '● Running on this computer' : '● Connected to office server';
    pill.className = 'pill ok';
    if (initial) log('info', 'server.status', { ffmpeg: st.ffmpeg });
    else if (!was) { log('info', 'server.back'); toast('Reconnected to the office server'); }
  } else {
    server = { ok: false, ffmpeg: false };
    setRemoteLogging(false);
    pill.textContent = '● Running on this computer';
    pill.className = 'pill ok';
    if (was) { log('warn', 'server.lost'); toast('Lost the office server. Exports now run on this computer.'); }
  }
  updateFormatHint();
  return !!st?.ok;
}

function setupTransport() {
  const btn = $('playBtn');
  const sync = () => { btn.textContent = playing ? '❚❚' : '▶'; };
  btn.onclick = () => { playing = !playing; if (playing && t >= state.duration) t = 0; sync(); };
  $('scrub').oninput = () => { playing = false; sync(); t = ($('scrub').value / 1000) * state.duration; };
  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.code === 'Space') { e.preventDefault(); btn.click(); }
    if (e.code === 'ArrowRight') { playing = false; sync(); t = Math.min(state.duration, t + 1 / fpsNum()); }
    if (e.code === 'ArrowLeft') { playing = false; sync(); t = Math.max(0, t - 1 / fpsNum()); }
  });
}

function setupPWA() {
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').then(
      (reg) => log('info', 'pwa.sw.ready', { scope: reg.scope }),
      (e) => log('warn', 'pwa.sw.failed', errInfo(e)),
    );
  }
  let deferred = null;
  const btn = $('installBtn');
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; btn.hidden = false; });
  btn.onclick = async () => {
    if (!deferred) return;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    log('info', 'pwa.install', { outcome });
    deferred = null; btn.hidden = true;
  };
  window.addEventListener('appinstalled', () => { btn.hidden = true; toast('Installed! Open “Overlay Generator” from your apps.'); });
  // Download the encoder in the background so exports also work offline
  if (!server.ffmpeg) setTimeout(() => fetch('vendor/ffmpeg/ffmpeg-core.wasm').then((r) => r.blob()).catch(() => {}), 4000);
}

async function init() {
  log('info', 'session.start', { browser: navigator.userAgent, window: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio, design: state.name });
  buildControls();
  syncControls();
  setupOutput();
  syncOutputUI();
  setupPresets();
  setupBackground();
  setupTransport();
  $('exportBtn').onclick = exportOverlay;
  $('stillBtn').onclick = exportStill;
  new ResizeObserver(fitViewport).observe($('viewportWrap'));
  // Only poll when there's a server to talk to (standalone/PWA mode has none)
  if (await checkServer(true)) setInterval(() => checkServer(false), 10000);
  if (!server.ok) await loadTeamLibrary();
  await loadFonts();
  await loadShared();
  setupPWA();
  await document.fonts.ready;
  await ensureFonts();
  fitViewport();
  requestAnimationFrame(loop);
}
init();
