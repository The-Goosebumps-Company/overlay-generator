import { drawFrame, normalize, FPS_OPTIONS, fontStr } from './renderer.js';
import { makeZip, encodePNG, gzip } from './zip.js';
import { BUILTIN_PRESETS } from './presets.js';
import { log, errInfo, setRemoteLogging } from './log.js';
import { encodeMov, cancelEncode } from './encode-wasm.js';
import { saveFont, listFonts } from './fonts-store.js';

const $ = (id) => document.getElementById(id);

// ---------- brand ----------
const BRAND_COLORS = [
  ['Pyro Amber', '#FB690C'], ['Crimson Surge', '#790000'], ['Aqua Beam', '#044E61'],
  ['Backline Blue', '#071A26'], ['White', '#FFFFFF'], ['Black', '#000000'],
];
const BRAND_GRADIENTS = {
  card: [['Pyro', ['#FB690C', '#790000']], ['Frequency', ['#0B6F88', '#044E61', '#071A26']], ['Pyro → Aqua', ['#FB690C', '#044E61']]],
  blobs: [['Pyro', ['#FB690C', '#FFB36B']], ['Aqua', ['#0B6F88', '#3FB6CF']], ['Mixed', ['#FB690C', '#0B6F88']]],
};

// Monoline icons (Lucide shapes, 1.5px stroke, as per the G&G iconography rules)
const ICON_PATHS = {
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
  reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7"/><path d="M7 3v4a1 1 0 0 0 1 1h7"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  folder: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  install: '<path d="M12 13V7"/><path d="m15 10-3 3-3-3"/><rect width="20" height="14" x="2" y="3" rx="2"/><path d="M12 17v4"/><path d="M8 21h8"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  film: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  minus: '<path d="M5 12h14"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
const hydrateIcons = (root = document) => root.querySelectorAll('i[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
const setIcon = (btn, name) => { const i = btn.querySelector('i[data-icon]'); if (i) { i.dataset.icon = name; i.innerHTML = icon(name); } };

// Log control tweaks without flooding: one entry per control after it settles
const ctlTimers = {};
const logControl = (k, v) => { clearTimeout(ctlTimers[k]); ctlTimers[k] = setTimeout(() => log('info', 'edit', { control: k, value: Array.isArray(v) ? v.join(',') : v }), 800); };

const GOOGLE_FONTS = ['Bricolage Grotesque', 'Krona One', 'Figtree', 'Montserrat', 'Inter', 'Poppins', 'DM Sans', 'Archivo', 'Lexend', 'Unbounded', 'Syne', 'Space Grotesk', 'Michroma', 'Oswald', 'Bebas Neue', 'Anton'];
const customFonts = new Set();

let state = loadCurrent() || normalize(BUILTIN_PRESETS[0]);
let server = { ok: false, ffmpeg: false };
let sharedPresets = [];
let playing = true, t = 0, lastTs = 0;
let currentTemplate = localStorage.getItem('og-template') || 'b:0';

// ---------- controls schema ----------
const WEIGHTS = [200, 300, 400, 500, 600, 700, 800, 900];
const SECTIONS = [
  { title: 'Text', open: true, items: [
    { k: 'text.content', type: 'textarea', label: 'Your text', help: 'Each line in the box becomes a line on screen.' },
    { k: 'text.font', type: 'font', label: 'Font' },
    { k: 'text.weight', type: 'select', label: 'Weight', options: WEIGHTS },
    { k: 'text.size', type: 'range', label: 'Size', min: 12, max: 220, step: 1 },
    { k: 'text.lineHeight', type: 'range', label: 'Line height', min: 0.7, max: 2, step: 0.01 },
    { k: 'text.tracking', type: 'range', label: 'Letter spacing', min: -0.1, max: 0.5, step: 0.005 },
    { k: 'text.align', type: 'select', label: 'Align', options: [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']] },
    { k: 'text.uppercase', type: 'check', label: 'All caps' },
    { k: 'text.color', type: 'color', label: 'Colour' },
    { k: 'text.revealTint', type: 'color', label: 'Reveal tint' },
    { k: 'text.shadow', type: 'range', label: 'Shadow', min: 0, max: 40, step: 1 },
  ] },
  { title: 'Animation', open: true, items: [
    { k: 'anim.in', type: 'check', label: 'Animate in' },
    { k: 'anim.inStyle', type: 'select', label: 'In style', options: [['line', 'Line → box'], ['fade', 'Fade'], ['pop', 'Pop'], ['slide', 'Slide up']] },
    { k: 'anim.inDur', type: 'range', label: 'In length (s)', min: 0.2, max: 5, step: 0.05 },
    { k: 'anim.out', type: 'check', label: 'Animate out' },
    { k: 'anim.outStyle', type: 'select', label: 'Out style', options: [['line', 'Box → line'], ['fade', 'Fade'], ['pop', 'Shrink'], ['slide', 'Slide up']] },
    { k: 'anim.outDur', type: 'range', label: 'Out length (s)', min: 0.2, max: 5, step: 0.05 },
    { k: 'anim.textStyle', type: 'select', label: 'Text reveal', options: [['cascade', 'Letter cascade'], ['words', 'Word by word'], ['lines', 'Line by line'], ['typewriter', 'Typewriter'], ['fade', 'Fade']] },
  ] },
  { title: 'Box & glow', items: [
    { k: 'card.colors', type: 'colors', label: 'Glow', max: 5, gradients: 'card' },
    { k: 'card.angle', type: 'range', label: 'Angle', min: 0, max: 360, step: 1 },
    { k: 'card.glow', type: 'range', label: 'Glow depth', min: 4, max: 400, step: 1 },
    { k: 'card.softness', type: 'range', label: 'Softness', min: 0.2, max: 2.5, step: 0.05 },
    { k: 'card.opacity', type: 'range', label: 'Glow opacity', min: 0, max: 1, step: 0.01 },
    { k: 'card.radius', type: 'range', label: 'Corners', min: 0, max: 160, step: 1 },
    { k: 'card.padX', type: 'range', label: 'Padding X', min: 0, max: 400, step: 1 },
    { k: 'card.padY', type: 'range', label: 'Padding Y', min: 0, max: 400, step: 1 },
    { k: 'card.minWidth', type: 'range', label: 'Min width', min: 0, max: 3000, step: 1 },
    { k: 'card.minHeight', type: 'range', label: 'Min height', min: 0, max: 2000, step: 1 },
    { k: 'card.fill', type: 'color', label: 'Backing' },
    { k: 'card.fillOpacity', type: 'range', label: 'Backing opacity', min: 0, max: 1, step: 0.01 },
  ] },
  { title: 'Moving light', items: [
    { k: 'blobs.enabled', type: 'check', label: 'Light drifting along the edge' },
    { k: 'blobs.colors', type: 'colors', label: 'Colours', max: 4, gradients: 'blobs' },
    { k: 'blobs.count', type: 'range', label: 'Count', min: 0, max: 8, step: 1 },
    { k: 'blobs.size', type: 'range', label: 'Size', min: 0.05, max: 1, step: 0.01 },
    { k: 'blobs.speed', type: 'range', label: 'Speed', min: 0, max: 5, step: 0.05 },
    { k: 'blobs.intensity', type: 'range', label: 'Intensity', min: 0, max: 1, step: 0.01 },
  ] },
  { title: 'Badge', items: [
    { k: 'badge.enabled', type: 'check', label: 'Show a badge above the text (time, tag…)' },
    { k: 'badge.text', type: 'text', label: 'Badge text' },
    { k: 'badge.scramble', type: 'check', label: 'Scramble digits as it appears' },
    { k: 'badge.size', type: 'range', label: 'Size', min: 12, max: 220, step: 1 },
    { k: 'badge.weight', type: 'select', label: 'Weight', options: WEIGHTS },
    { k: 'badge.colors', type: 'colors', label: 'Glow', max: 4, gradients: 'card' },
    { k: 'badge.glow', type: 'range', label: 'Glow depth', min: 2, max: 200, step: 1 },
    { k: 'badge.radius', type: 'range', label: 'Corners', min: 0, max: 100, step: 1 },
    { k: 'badge.padX', type: 'range', label: 'Padding X', min: 0, max: 200, step: 1 },
    { k: 'badge.padY', type: 'range', label: 'Padding Y', min: 0, max: 120, step: 1 },
    { k: 'badge.gap', type: 'range', label: 'Gap to text', min: 0, max: 200, step: 1 },
  ] },
  { title: 'Position', items: [
    { k: 'layout.anchor', type: 'select', label: 'Anchor', options: [['top-left', 'Top left'], ['top-center', 'Top centre'], ['top-right', 'Top right'], ['middle-left', 'Middle left'], ['center', 'Centre'], ['middle-right', 'Middle right'], ['bottom-left', 'Lower third · left'], ['bottom-center', 'Lower third · centre'], ['bottom-right', 'Lower third · right']] },
    { k: 'layout.scale', type: 'range', label: 'Scale', min: 0.2, max: 3, step: 0.01 },
    { k: 'layout.offsetX', type: 'range', label: 'Nudge X %', min: -50, max: 50, step: 0.5 },
    { k: 'layout.offsetY', type: 'range', label: 'Nudge Y %', min: -50, max: 50, step: 0.5 },
    { k: 'layout.safe', type: 'range', label: 'Safe margin %', min: 0, max: 20, step: 0.5 },
    { k: 'layout.autoFit', type: 'check', label: 'Shrink to fit inside the frame' },
  ] },
];

const getP = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const setP = (o, p, v) => { const ks = p.split('.'); const last = ks.pop(); ks.reduce((a, k) => a[k], o)[last] = v; };
const binders = [];
let uid = 0;

function buildControls() {
  const root = $('controls');
  root.innerHTML = '';
  binders.length = 0;
  const openState = JSON.parse(localStorage.getItem('og-open-v2') || '{}');
  for (const sec of SECTIONS) {
    const d = document.createElement('details');
    d.className = 'section';
    d.open = openState[sec.title] ?? !!sec.open;
    d.addEventListener('toggle', () => { openState[sec.title] = d.open; localStorage.setItem('og-open-v2', JSON.stringify(openState)); });
    d.innerHTML = `<summary><span class="eyebrow">${sec.title}</span></summary><div class="body"></div>`;
    const body = d.querySelector('.body');
    for (const it of sec.items) body.appendChild(makeControl(it));
    root.appendChild(d);
  }
}

const setFill = (r) => r.style.setProperty('--fill', `${((r.value - r.min) / (r.max - r.min)) * 100}%`);

function swatchRow(onPick) {
  const row = document.createElement('div');
  row.className = 'swatches';
  for (const [name, hex] of BRAND_COLORS) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'swatch'; b.style.background = hex; b.title = name; b.setAttribute('aria-label', `Use ${name}`);
    b.onclick = () => onPick(hex);
    row.appendChild(b);
  }
  return row;
}

function makeControl(it) {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  const id = `c${++uid}`;
  const label = `<label for="${id}">${it.label}</label>`;
  const commit = (v) => { setP(state, it.k, v); logControl(it.k, v); changed(); };
  if (it.type === 'range') {
    wrap.innerHTML = `${label}<input id="${id}" type="range" min="${it.min}" max="${it.max}" step="${it.step}"><span class="val"><input type="number" step="${it.step}" aria-label="${it.label} value"></span>`;
    const [r, n] = wrap.querySelectorAll('input');
    r.oninput = () => { n.value = r.value; setFill(r); commit(+r.value); };
    n.onchange = () => { r.value = n.value; setFill(r); commit(+n.value); };
    binders.push(() => { const v = getP(state, it.k); r.value = v; n.value = v; setFill(r); });
  } else if (it.type === 'textarea') {
    wrap.className = 'ctl full';
    wrap.innerHTML = `${label}<textarea id="${id}" spellcheck="false" rows="3"></textarea>${it.help ? `<span class="help-text">${it.help}</span>` : ''}`;
    const ta = wrap.querySelector('textarea');
    ta.oninput = () => commit(ta.value);
    binders.push(() => { if (document.activeElement !== ta) ta.value = getP(state, it.k); });
  } else if (it.type === 'text') {
    wrap.className = 'ctl wide2';
    wrap.innerHTML = `${label}<input id="${id}" type="text">`;
    const el = wrap.querySelector('input');
    el.oninput = () => commit(el.value);
    binders.push(() => { if (document.activeElement !== el) el.value = getP(state, it.k); });
  } else if (it.type === 'check') {
    wrap.className = 'ctl full';
    wrap.innerHTML = `<label class="check"><input type="checkbox"> ${it.label}</label>`;
    const el = wrap.querySelector('input');
    el.onchange = () => commit(el.checked);
    binders.push(() => { el.checked = !!getP(state, it.k); });
  } else if (it.type === 'color') {
    wrap.className = 'ctl wide2';
    wrap.innerHTML = `${label}<div class="colors"><input id="${id}" type="color"></div>`;
    const el = wrap.querySelector('input');
    el.oninput = () => commit(el.value);
    wrap.querySelector('.colors').appendChild(swatchRow((hex) => { el.value = hex; commit(hex); }));
    binders.push(() => { el.value = getP(state, it.k); });
  } else if (it.type === 'select') {
    wrap.className = 'ctl wide2';
    const opts = it.options.map((o) => (Array.isArray(o) ? o : [o, o]));
    wrap.innerHTML = `${label}<select id="${id}">${opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>`;
    const el = wrap.querySelector('select');
    el.onchange = () => commit(typeof opts[0][0] === 'number' ? +el.value : el.value);
    binders.push(() => { el.value = getP(state, it.k); });
  } else if (it.type === 'colors') {
    wrap.className = 'ctl full';
    wrap.innerHTML = `<span>${it.label}</span><div class="colors"></div><div class="swatches grads"></div>`;
    const box = wrap.querySelector('.colors');
    const grads = wrap.querySelector('.grads');
    for (const [name, cols] of BRAND_GRADIENTS[it.gradients] || []) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn ghost small'; b.style.height = '28px'; b.style.padding = '0 10px';
      b.innerHTML = `<span class="swatch" style="width:14px;height:14px;background:linear-gradient(135deg,${cols.join(',')})"></span>${name}`;
      b.onclick = () => { setP(state, it.k, [...cols]); render(); changed(); };
      grads.appendChild(b);
    }
    const render = () => {
      const arr = getP(state, it.k);
      box.innerHTML = '';
      arr.forEach((c, i) => {
        const el = document.createElement('input');
        el.type = 'color'; el.value = c; el.setAttribute('aria-label', `${it.label} colour ${i + 1}`);
        el.oninput = () => { arr[i] = el.value; changed(); };
        box.appendChild(el);
      });
      if (arr.length < it.max) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.innerHTML = icon('plus'); b.title = 'Add colour'; b.setAttribute('aria-label', 'Add colour'); b.onclick = () => { arr.push(arr[arr.length - 1] || '#ffffff'); render(); changed(); }; box.appendChild(b); }
      if (arr.length > 1) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn ghost'; b.innerHTML = icon('minus'); b.title = 'Remove colour'; b.setAttribute('aria-label', 'Remove colour'); b.onclick = () => { arr.pop(); render(); changed(); }; box.appendChild(b); }
    };
    binders.push(render);
  } else if (it.type === 'font') {
    wrap.className = 'ctl full';
    wrap.innerHTML = `${label}<div class="font-row"><select id="${id}"></select><label class="btn ghost" title="Add a font file (.ttf, .otf, .woff, .woff2)">${icon('upload')}<span>Add</span><input type="file" accept=".ttf,.otf,.woff,.woff2" hidden></label></div>`;
    const sel = wrap.querySelector('select');
    const file = wrap.querySelector('input[type=file]');
    const fill = () => {
      const cur = getP(state, it.k);
      const all = [...customFonts, ...GOOGLE_FONTS];
      if (!all.includes(cur)) all.unshift(cur);
      sel.innerHTML = '';
      if (customFonts.size) sel.innerHTML += `<optgroup label="Brand fonts">${[...customFonts].map((f) => `<option>${f}</option>`).join('')}</optgroup>`;
      sel.innerHTML += `<optgroup label="Fonts">${all.filter((f) => !customFonts.has(f)).map((f) => `<option>${f}</option>`).join('')}</optgroup>`;
      sel.value = cur;
    };
    sel.onchange = () => commit(sel.value);
    file.onchange = async () => {
      const f = file.files[0]; if (!f) return;
      try {
        const fam = await addFontFile(f);
        setP(state, it.k, fam);
        fill(); changed();
      } catch {}
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
  try { await registerFont(fam, buf); } catch (e) { log('error', 'font.invalid', { file: file.name, ...errInfo(e) }); toast(`Couldn’t read “${file.name}” as a font.`); throw e; }
  if (server.ok) {
    const r = await fetch(`/api/fonts?file=${encodeURIComponent(file.name)}`, { method: 'POST', body: buf });
    toast(r.ok ? `“${fam}” added. Everyone can use it now.` : `“${fam}” added for you. Sharing it with the office failed.`);
  } else {
    try { await saveFont(fam, file.name, buf); toast(`“${fam}” added to this app.`); }
    catch (e) { log('warn', 'font.persist.failed', errInfo(e)); toast(`“${fam}” added for this session.`); }
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
  const scrub = $('scrub');
  scrub.value = Math.round((Math.min(t, state.duration) / state.duration) * 1000);
  setFill(scrub);
  $('timecode').textContent = `${fmtTime(Math.min(t, state.duration))} / ${fmtTime(state.duration)}`;
  requestAnimationFrame(loop);
}

// ---------- state, autosave, undo ----------
let saveTimer, fontTimer, histTimer;
const history = { stack: [], index: -1 };
function pushHistory() {
  const snap = JSON.stringify(state);
  if (history.stack[history.index] === snap) return;
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(snap);
  if (history.stack.length > 150) history.stack.shift();
  history.index = history.stack.length - 1;
  syncUndo();
}
function syncUndo() {
  $('undoBtn').disabled = history.index <= 0;
  $('redoBtn').disabled = history.index >= history.stack.length - 1;
}
function restore(snap) {
  state = normalize(JSON.parse(snap));
  syncOutputUI();
  syncControls();
  fitViewport();
  ensureFonts().then(render);
  localStorage.setItem('og-current', snap);
  drawMarkers();
}
function undo() { if (history.index > 0) { history.index--; restore(history.stack[history.index]); syncUndo(); log('info', 'undo'); } }
function redo() { if (history.index < history.stack.length - 1) { history.index++; restore(history.stack[history.index]); syncUndo(); log('info', 'redo'); } }

function changed() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => localStorage.setItem('og-current', JSON.stringify(state)), 300);
  clearTimeout(fontTimer);
  fontTimer = setTimeout(() => ensureFonts().then(render), 50);
  clearTimeout(histTimer);
  histTimer = setTimeout(pushHistory, 400);
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
  t = 0; playing = true; syncPlay();
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
    prores: 'The one to pick. Plays smoothly in Premiere, After Effects and Resolve.',
    qtrle: 'Lossless, same codec the design team uses. Big files, can stutter in Resolve.',
    png: 'Lossless frames in a .zip. Works in every editing app.',
  };
  let h = hints[f];
  if (f !== 'png' && !server.ffmpeg) h += ' Encoded on this computer, so it takes a little longer.';
  $('formatHint').textContent = h;
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

let exporting = false, cancelRequested = false;
class Cancelled extends Error {}
const checkCancel = () => { if (cancelRequested) throw new Cancelled('cancelled'); };
function setExporting(on) {
  exporting = on;
  $('exportBtn').hidden = on;
  $('cancelBtn').hidden = !on;
  $('stillBtn').disabled = on;
}

async function exportOverlay() {
  if (exporting) return;
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
  const pixels = (n) => { checkCancel(); drawFrame(octx, s, n / fr.num, W, H); return octx.getImageData(0, 0, W, H).data; };
  const name = `${outName()}_${W}x${H}_${s.fps}fps`;
  cancelRequested = false;
  setExporting(true);
  progress(0, 'Starting…');
  try {
    if (fmt === 'png') {
      const files = [];
      for (let n = 0; n < N; n++) {
        files.push({ name: `${name}/${name}_${String(n).padStart(5, '0')}.png`, data: await encodePNG(pixels(n), W, H) });
        progress((n + 1) / N, `Frame ${n + 1} of ${N}`);
      }
      progress(1, 'Zipping…');
      download(makeZip(files), `${name}_PNG.zip`);
    } else if (!server.ffmpeg) {
      // No server: encode on this computer with ffmpeg.wasm
      const blob = await encodeMov({ count: N, rate: fr.rate, format: fmt, frame: (n) => encodePNG(pixels(n), W, H), onProgress: (p, msg) => { checkCancel(); progress(p, msg); } });
      checkCancel();
      download(blob, `${name}${fmt === 'prores' ? '_ProRes4444' : '_Animation'}.mov`);
    } else {
      const job = await (await fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fps: s.fps, width: W, height: H, format: fmt, name, frames: N }) })).json();
      if (!job.id) throw new Error(job.error || 'Server refused the job');
      const inflight = new Set();
      let sent = 0;
      for (let n = 0; n < N; n++) {
        const body = await gzip(pixels(n));
        const p = fetch(`/api/render/${job.id}/${n}`, { method: 'PUT', body }).then((r) => { if (!r.ok) throw new Error('Upload failed'); sent++; progress(sent / N * 0.9, `Frame ${sent} of ${N}`); });
        inflight.add(p); p.finally(() => inflight.delete(p));
        if (inflight.size >= 6) await Promise.race(inflight);
      }
      await Promise.all(inflight);
      checkCancel();
      progress(0.93, fmt === 'prores' ? 'Encoding ProRes 4444…' : 'Encoding QuickTime Animation…');
      const r = await fetch(`/api/render/${job.id}/finish`, { method: 'POST' });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      checkCancel();
      download(blob, `${name}${fmt === 'prores' ? '_ProRes4444' : '_Animation'}.mov`);
    }
    log('info', 'export.done', { format: fmt, seconds: +((performance.now() - tStart) / 1000).toFixed(1) });
    progress(1, 'Done. Check your Downloads.');
    toast('Export finished. It’s in your Downloads folder.');
    setTimeout(() => { if (!exporting) progress(null); }, 3000);
  } catch (e) {
    if (e instanceof Cancelled || cancelRequested) {
      log('info', 'export.cancelled', { format: fmt });
      toast('Export cancelled.');
    } else {
      log('error', 'export.failed', { format: fmt, ...errInfo(e) });
      toast(`Export failed: ${e.message}`);
    }
    progress(null);
  } finally {
    setExporting(false);
  }
}
function cancelExport() {
  if (!exporting) return;
  cancelRequested = true;
  cancelEncode(); // stops an in-browser encode immediately
  progress(0, 'Cancelling…');
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

// ---------- dialog (replaces prompt/confirm, which installed apps can block) ----------
function ask({ eyebrow = 'Template', title, body = '', input = null, ok = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const d = $('dialog'), inp = $('dialogInput');
    $('dialogEyebrow').textContent = eyebrow;
    $('dialogTitle').textContent = title;
    $('dialogBody').textContent = body;
    $('dialogOk').textContent = ok;
    $('dialogOk').style.background = danger ? 'linear-gradient(135deg,#c0392b,#790000)' : '';
    inp.hidden = input == null;
    if (input != null) { inp.value = input.value || ''; inp.placeholder = input.placeholder || ''; }
    const done = (val) => { d.close(); $('dialogForm').onsubmit = null; $('dialogCancel').onclick = null; d.oncancel = null; resolve(val); };
    $('dialogForm').onsubmit = (e) => { e.preventDefault(); done(input != null ? inp.value.trim() || null : true); };
    $('dialogCancel').onclick = () => done(input != null ? null : false);
    d.oncancel = (e) => { e.preventDefault(); done(input != null ? null : false); };
    d.showModal();
    if (input != null) { inp.focus(); inp.select(); } else $('dialogOk').focus();
  });
}

// ---------- templates ----------
let teamLibrary = { presets: [], fonts: [] };
const localPresets = () => JSON.parse(localStorage.getItem('og-presets') || '[]');
function templateList() {
  return [
    ...BUILTIN_PRESETS.map((p, i) => ({ key: `b:${i}`, p, tag: p.name.startsWith('G&G') ? 'G&G' : '' })),
    ...sharedPresets.map((p, i) => ({ key: `s:${i}`, p, tag: 'Team' })),
    ...localPresets().map((p, i) => ({ key: `l:${i}`, p, tag: 'Mine' })),
  ];
}
function templateByKey(key) {
  const [kind, i] = (key || '').split(':');
  const src = kind === 'b' ? BUILTIN_PRESETS : kind === 's' ? sharedPresets : kind === 'l' ? localPresets() : [];
  return src[+i];
}
function holdTime(s) {
  const inD = s.anim.in ? s.anim.inDur : 0, outD = s.anim.out ? s.anim.outDur : 0;
  return inD + Math.max(0, s.duration - inD - outD) * 0.5;
}
async function renderTemplates() {
  const box = $('templates');
  const list = templateList();
  box.innerHTML = '';
  for (const { key, p, tag } of list) {
    const s = normalize(p);
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tpl'; b.setAttribute('role', 'option');
    b.setAttribute('aria-selected', String(key === currentTemplate));
    b.dataset.key = key;
    const c = document.createElement('canvas');
    c.width = 320; c.height = Math.round(320 * s.height / s.width);
    c.style.objectFit = 'contain';
    b.appendChild(c);
    b.insertAdjacentHTML('beforeend', `${tag ? `<span class="tpl-tag">${tag}</span>` : ''}<span class="tpl-name">${p.name.replace(/^G&G · /, '').replace(/\s*\(\d+\s*[×x]\s*\d+\)\s*$/, '')}</span>`);
    b.onclick = () => selectTemplate(key);
    box.appendChild(b);
    document.fonts.load(fontStr(s.text.weight, 40, s.text.font), s.text.content).catch(() => {}).then(() => drawFrame(c.getContext('2d'), s, holdTime(s), s.width, s.height));
  }
  // keep the hidden select in sync (used by delete + older code paths)
  $('presetSelect').innerHTML = list.map(({ key, p }) => `<option value="${key}">${p.name}</option>`).join('');
  $('presetSelect').value = currentTemplate;
  $('deletePreset').disabled = currentTemplate.startsWith('b:');
}
function selectTemplate(key) {
  const p = templateByKey(key);
  if (!p) return;
  currentTemplate = key;
  localStorage.setItem('og-template', key);
  document.querySelectorAll('.tpl').forEach((el) => el.setAttribute('aria-selected', String(el.dataset.key === key)));
  $('deletePreset').disabled = key.startsWith('b:');
  applyState(p);
}
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
  renderTemplates();
}
function setupTemplates() {
  $('savePreset').onclick = async () => {
    const suggestion = state.name && !BUILTIN_PRESETS.some((p) => p.name === state.name) ? state.name : '';
    const name = await ask({ title: 'Save as a template', body: server.ok ? 'Everyone using the office server will see it.' : 'It’s saved on this computer.', input: { value: suggestion, placeholder: 'e.g. Main stage schedule' }, ok: 'Save template' });
    if (!name) return;
    state.name = name.trim();
    if (server.ok) {
      const r = await fetch('/api/presets', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state) });
      if (r.ok) {
        await loadShared();
        const i = sharedPresets.findIndex((p) => p.name === state.name);
        if (i >= 0) { currentTemplate = `s:${i}`; localStorage.setItem('og-template', currentTemplate); renderTemplates(); }
        toast(`Saved “${state.name}”. Everyone in the office can use it now.`);
        return;
      }
    }
    const local = localPresets().filter((p) => p.name !== state.name);
    local.push(structuredClone(state));
    localStorage.setItem('og-presets', JSON.stringify(local));
    currentTemplate = `l:${local.length - 1}`;
    localStorage.setItem('og-template', currentTemplate);
    renderTemplates();
    toast(`Saved “${state.name}” on this computer.`);
  };
  $('deletePreset').onclick = async () => {
    const key = currentTemplate;
    if (key.startsWith('b:')) return toast('Built-in templates can’t be deleted.');
    const p = templateByKey(key);
    if (!p) return;
    if (key.startsWith('s:') && !server.ok) return toast('Team templates come with the app and can’t be deleted here.');
    if (!(await ask({ title: `Delete “${p.name}”?`, body: key.startsWith('s:') ? 'It disappears for everyone in the office.' : 'This can’t be undone.', ok: 'Delete', danger: true }))) return;
    if (key.startsWith('s:')) { await fetch(`/api/presets?name=${encodeURIComponent(p.name)}`, { method: 'DELETE' }); await loadShared(); }
    else { const list = localPresets(); list.splice(+key.split(':')[1], 1); localStorage.setItem('og-presets', JSON.stringify(list)); }
    currentTemplate = 'b:0';
    localStorage.setItem('og-template', currentTemplate);
    renderTemplates();
    toast('Template deleted.');
  };
  $('exportJson').onclick = () => download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `${slug(state.name || outName())}.json`);
  $('importJson').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { applyState(JSON.parse(await f.text())); toast('Design opened.'); } catch (err) { log('error', 'json.import.failed', { file: f.name, ...errInfo(err) }); toast('That file isn’t an overlay design.'); }
    e.target.value = '';
  };
  $('resetBtn').onclick = () => {
    const p = templateByKey(currentTemplate);
    if (!p) return;
    applyState(p);
    toast(`Back to “${p.name}”. Undo brings your changes back.`);
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
  document.querySelectorAll('.toast').forEach((el) => el.remove());
  const el = $('toast').content.firstElementChild.cloneNode(true);
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
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
    pill.textContent = st.local ? 'On this computer' : 'Office server';
    pill.className = 'status ok';
    if (initial) log('info', 'server.status', { ffmpeg: st.ffmpeg });
    else if (!was) { log('info', 'server.back'); toast('Reconnected to the office server.'); }
  } else {
    server = { ok: false, ffmpeg: false };
    setRemoteLogging(false);
    pill.textContent = 'On this computer';
    pill.className = 'status ok';
    if (was) { log('warn', 'server.lost'); toast('Lost the office server. Exports now run on this computer.'); }
  }
  updateFormatHint();
  return !!st?.ok;
}

function syncPlay() {
  const btn = $('playBtn');
  setIcon(btn, playing ? 'pause' : 'play');
  btn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
}
function setupTransport() {
  const btn = $('playBtn');
  btn.onclick = () => { playing = !playing; if (playing && t >= state.duration) t = 0; syncPlay(); };
  $('scrub').oninput = () => { playing = false; syncPlay(); t = ($('scrub').value / 1000) * state.duration; };
  $('undoBtn').onclick = undo;
  $('redoBtn').onclick = redo;
  window.addEventListener('keydown', (e) => {
    const typing = e.target.matches('input[type=text], input[type=number], textarea');
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if (mod && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); redo(); return; }
    if (e.target.matches('input, textarea, select')) return;
    if (e.code === 'Space') { e.preventDefault(); btn.click(); }
    if (e.code === 'ArrowRight') { playing = false; syncPlay(); t = Math.min(state.duration, t + 1 / fpsNum()); }
    if (e.code === 'ArrowLeft') { playing = false; syncPlay(); t = Math.max(0, t - 1 / fpsNum()); }
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
  window.addEventListener('appinstalled', () => { btn.hidden = true; toast('Installed. Open “Overlay Generator” from your apps.'); });
  // Download the encoder in the background so exports also work offline
  if (!server.ffmpeg) setTimeout(() => fetch('vendor/ffmpeg/ffmpeg-core.wasm').then((r) => r.blob()).catch(() => {}), 4000);
}

async function init() {
  log('info', 'session.start', { browser: navigator.userAgent, window: `${innerWidth}x${innerHeight}`, dpr: devicePixelRatio, design: state.name });
  hydrateIcons();
  buildControls();
  syncControls();
  setupOutput();
  syncOutputUI();
  setupTemplates();
  setupBackground();
  setupTransport();
  syncPlay();
  $('exportBtn').onclick = exportOverlay;
  $('cancelBtn').onclick = cancelExport;
  $('stillBtn').onclick = exportStill;
  new ResizeObserver(fitViewport).observe($('viewportWrap'));
  renderTemplates();
  // Only poll when there's a server to talk to (standalone/PWA mode has none)
  if (await checkServer(true)) setInterval(() => checkServer(false), 10000);
  if (!server.ok) await loadTeamLibrary();
  await loadFonts();
  await loadShared();
  setupPWA();
  await document.fonts.ready;
  await ensureFonts();
  pushHistory();
  fitViewport();
  requestAnimationFrame(loop);
}
init();
