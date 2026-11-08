import { drawFrame, normalize, FPS_OPTIONS, fontStr, computeLayout } from './renderer.js';
import { EVENTS, GENERAL, eventById, eventLabel, palette } from './events.js';
import { zonesFor, shapeGroup, safeRect, conflicts, zoneSVG } from './safezones.js';
import { makeZip, encodePNG, gzip } from './zip.js';
import { BUILTIN_PRESETS } from './presets.js';
import { log, errInfo, setRemoteLogging } from './log.js';
import { encodeMov, cancelEncode } from './encode-wasm.js';
import { saveFont, listFonts } from './fonts-store.js';

const $ = (id) => document.getElementById(id);

// ---------- brand / events ----------
// Palettes and gradients come from the chosen event library (events.js)
let currentEvent = localStorage.getItem('og-event') || 'all';
const paletteId = () => (currentEvent !== 'all' && currentEvent !== 'general' ? currentEvent : state?.event || 'gg');

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
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  move: '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[name] || ''}</svg>`;
const hydrateIcons = (root = document) => root.querySelectorAll('i[data-icon]').forEach((el) => { el.innerHTML = icon(el.dataset.icon); });
const setIcon = (btn, name) => { const i = btn.querySelector('i[data-icon]'); if (i) { i.dataset.icon = name; i.innerHTML = icon(name); } };

// Log control tweaks without flooding: one entry per control after it settles
const ctlTimers = {};
const logControl = (k, v) => { clearTimeout(ctlTimers[k]); ctlTimers[k] = setTimeout(() => log('info', 'edit', { control: k, value: Array.isArray(v) ? v.join(',') : v }), 800); };

const GOOGLE_FONTS = ['Bricolage Grotesque', 'Josefin Sans', 'Luckiest Guy', 'Krona One', 'Figtree', 'Montserrat', 'Inter', 'Poppins', 'DM Sans', 'Archivo', 'Lexend', 'Unbounded', 'Syne', 'Space Grotesk', 'Michroma', 'Oswald', 'Bebas Neue', 'Anton'];
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
  row.dataset.pal = 'colors';
  row._pick = onPick;
  fillPalette(row);
  return row;
}
// Swatch and gradient rows re-fill when the event changes
function fillPalette(row) {
  const pal = palette(paletteId());
  row.innerHTML = '';
  if (row.dataset.pal === 'colors') {
    for (const [name, hex] of pal.colors) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'swatch'; b.style.background = hex; b.title = name; b.setAttribute('aria-label', `Use ${name}`);
      b.onclick = () => row._pick(hex);
      row.appendChild(b);
    }
    return;
  }
  for (const [name, cols] of pal[row.dataset.pal] || []) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost small'; b.style.height = '28px'; b.style.padding = '0 10px';
    b.innerHTML = `<span class="swatch" style="width:14px;height:14px;background:linear-gradient(135deg,${cols.join(',')})"></span>${name}`;
    b.onclick = () => row._pick(cols);
    row.appendChild(b);
  }
}
const refreshPalettes = () => document.querySelectorAll('[data-pal]').forEach(fillPalette);

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
    grads.dataset.pal = it.gradients;
    grads._pick = (cols) => { setP(state, it.k, [...cols]); render(); changed(); };
    fillPalette(grads);
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
  drawSafeZones();
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
  fontTimer = setTimeout(() => ensureFonts().then(() => { render(); drawSafeZones(); }), 50);
  clearTimeout(histTimer);
  histTimer = setTimeout(pushHistory, 400);
  drawMarkers();
  render();
  drawSafeZones();
}
function loadCurrent() { try { const s = JSON.parse(localStorage.getItem('og-current')); return s ? normalize(s) : null; } catch { return null; } }

function applyState(s) {
  log('info', 'design.load', { name: s?.name, size: `${s?.width}x${s?.height}` });
  state = normalize(s);
  syncOutputUI();
  syncControls();
  refreshPalettes();
  ensureFonts().then(fitViewport);
  t = 0; playing = true; syncPlay();
  changed();
}

// ---------- output settings ----------
// Plain-language sizes: pick a shape and a quality; pixels are derived.
const SHAPES = {
  landscape: { ratio: [16, 9], label: 'Landscape 16:9', hint: 'YouTube, TV, screens and presentations.' },
  portrait: { ratio: [9, 16], label: 'Portrait 9:16', hint: 'Reels, TikTok, Stories and Shorts.' },
  square: { ratio: [1, 1], label: 'Square 1:1', hint: 'Instagram and LinkedIn feed posts.' },
  feed: { ratio: [4, 5], label: 'Feed 4:5', hint: 'Instagram portrait posts.' },
};
const even = (n) => Math.round(n / 2) * 2;
function sizeFor(shape, quality) {
  const short = quality === '4k' ? 2160 : 1080;
  const [a, b] = SHAPES[shape].ratio;
  return a >= b ? [even(short * a / b), short] : [short, even(short * b / a)];
}
function detectSize(w, h) {
  for (const shape of Object.keys(SHAPES)) for (const q of ['hd', '4k']) {
    const [sw, sh] = sizeFor(shape, q);
    if (sw === w && sh === h) return { shape, q };
  }
  return null;
}
let customSize = false;
function syncOutputUI() {
  const found = detectSize(state.width, state.height);
  if (!found) customSize = true;
  const shape = !customSize && found ? found.shape : null;
  const q = found ? found.q : (Math.min(state.width, state.height) >= 2160 ? '4k' : 'hd');
  document.querySelectorAll('#shapeSeg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.shape === shape)));
  document.querySelectorAll('#qualitySeg button').forEach((b) => b.setAttribute('aria-checked', String(!customSize && b.dataset.quality === q)));
  $('qualityRow').style.opacity = customSize ? 0.45 : '';
  $('shapeHint').textContent = customSize ? 'Custom size. Pick a shape above to go back to the standard sizes.' : SHAPES[shape].hint;
  $('pxNote').textContent = `${state.width} × ${state.height} px`;
  $('customToggle').setAttribute('aria-pressed', String(customSize));
  $('customRes').hidden = !customSize;
  $('resW').value = state.width; $('resH').value = state.height;
  $('fpsSelect').value = state.fps;
  $('durInput').value = state.duration;
}
function setSize(w, h) {
  state.width = w; state.height = h;
  syncOutputUI(); fitViewport(); changed();
  log('info', 'edit', { control: 'output.size', value: `${w}x${h}` });
}
function setupOutput() {
  $('fpsSelect').innerHTML = Object.keys(FPS_OPTIONS).map((f) => `<option value="${f}">${f} fps</option>`).join('');
  const currentQ = () => document.querySelector('#qualitySeg button[aria-checked="true"]')?.dataset.quality
    || (Math.min(state.width, state.height) >= 2160 ? '4k' : 'hd');
  document.querySelectorAll('#shapeSeg button').forEach((b) => {
    b.onclick = () => { const q = currentQ(); customSize = false; setSize(...sizeFor(b.dataset.shape, q)); };
  });
  document.querySelectorAll('#qualitySeg button').forEach((b) => {
    b.onclick = () => {
      if (customSize) return;
      const shape = detectSize(state.width, state.height)?.shape || 'landscape';
      setSize(...sizeFor(shape, b.dataset.quality));
    };
  });
  $('customToggle').onclick = () => {
    customSize = !customSize;
    if (!customSize) { const f = detectSize(state.width, state.height); if (!f) { setSize(1920, 1080); return; } }
    syncOutputUI();
    if (customSize) $('resW').focus();
  };
  const custom = () => { setSize(Math.max(16, even(+$('resW').value || 1920)), Math.max(16, even(+$('resH').value || 1080))); };
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
const nameFor = (s) => slug(s.text.content.split('\n').join(' '));
const outName = () => nameFor(state);

let exporting = false, cancelRequested = false;
class Cancelled extends Error {}
const checkCancel = () => { if (cancelRequested) throw new Cancelled('cancelled'); };
function setExporting(on) {
  exporting = on;
  $('exportBtn').hidden = on;
  $('cancelBtn').hidden = !on;
  $('stillBtn').disabled = on;
  $('batchBtn').disabled = on;
}
const engineFor = (fmt) => (fmt === 'png' ? 'browser' : server.ffmpeg ? 'server' : 'browser-ffmpeg');

// Video exports use PREMULTIPLIED alpha (colour × alpha, matted with black) — the
// After Effects / ProRes 4444 convention the design team's files use. DaVinci Resolve,
// Premiere, After Effects and players that ignore alpha all show it correctly.
// PNG must stay straight (unpremultiplied) per the PNG spec.
function premultiply(d) {
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 255) continue;
    if (a === 0) { d[i] = d[i + 1] = d[i + 2] = 0; continue; }
    d[i] = (d[i] * a + 127) / 255 | 0;
    d[i + 1] = (d[i + 1] * a + 127) / 255 | 0;
    d[i + 2] = (d[i + 2] * a + 127) / 255 | 0;
  }
  return d;
}

/**
 * Render one overlay design to a file. Shared by single and batch export.
 * @returns {Promise<{blob: Blob, filename: string}>}
 */
async function renderToFile(s, fmt, onProgress, base = nameFor(s)) {
  await ensureFonts(s);
  const W = s.width, H = s.height, fr = FPS_OPTIONS[s.fps];
  const N = Math.max(1, Math.round(s.duration * fr.num));
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const octx = off.getContext('2d', { willReadFrequently: true });
  const straight = (n) => { checkCancel(); drawFrame(octx, s, n / fr.num, W, H); return octx.getImageData(0, 0, W, H).data; };
  const pixels = fmt === 'png' ? straight : (n) => premultiply(straight(n));
  const name = `${base}_${W}x${H}_${s.fps}fps`;
  const movName = `${name}${fmt === 'prores' ? '_ProRes4444' : '_Animation'}.mov`;

  if (fmt === 'png') {
    const files = [];
    for (let n = 0; n < N; n++) {
      files.push({ name: `${name}/${name}_${String(n).padStart(5, '0')}.png`, data: await encodePNG(pixels(n), W, H) });
      onProgress((n + 1) / N * 0.97, `Frame ${n + 1} of ${N}`);
    }
    onProgress(0.98, 'Zipping…');
    return { blob: makeZip(files), filename: `${name}_PNG.zip` };
  }
  if (!server.ffmpeg) {
    // No server: encode on this computer with ffmpeg.wasm
    const blob = await encodeMov({ count: N, rate: fr.rate, format: fmt, frame: (n) => encodePNG(pixels(n), W, H), onProgress: (p, msg) => { checkCancel(); onProgress(p, msg); } });
    checkCancel();
    return { blob, filename: movName };
  }
  const job = await (await fetch('/api/render', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fps: s.fps, width: W, height: H, format: fmt, name, frames: N }) })).json();
  if (!job.id) throw new Error(job.error || 'Server refused the job');
  const inflight = new Set();
  let sent = 0;
  for (let n = 0; n < N; n++) {
    const body = await gzip(pixels(n));
    const p = fetch(`/api/render/${job.id}/${n}`, { method: 'PUT', body }).then((r) => { if (!r.ok) throw new Error('Upload failed'); sent++; onProgress(sent / N * 0.9, `Frame ${sent} of ${N}`); });
    inflight.add(p); p.finally(() => inflight.delete(p));
    if (inflight.size >= 6) await Promise.race(inflight);
  }
  await Promise.all(inflight);
  checkCancel();
  onProgress(0.93, fmt === 'prores' ? 'Encoding ProRes 4444…' : 'Encoding QuickTime Animation…');
  const r = await fetch(`/api/render/${job.id}/finish`, { method: 'POST' });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  checkCancel();
  return { blob, filename: movName };
}

// Runs an export job with shared progress / cancel / error handling.
async function runExport(kind, details, job) {
  if (exporting) return false;
  const tStart = performance.now();
  log('info', `${kind}.start`, details);
  cancelRequested = false;
  setExporting(true);
  progress(0, 'Starting…');
  try {
    const msg = await job();
    log('info', `${kind}.done`, { ...details, seconds: +((performance.now() - tStart) / 1000).toFixed(1) });
    progress(1, 'Done.');
    toast(msg);
    setTimeout(() => { if (!exporting) progress(null); }, 3000);
    return true;
  } catch (e) {
    if (e instanceof Cancelled || cancelRequested) {
      log('info', `${kind}.cancelled`, details);
      toast('Export cancelled.');
    } else {
      log('error', `${kind}.failed`, { ...details, ...errInfo(e) });
      toast(`Export failed: ${e.message}`);
    }
    progress(null);
    return false;
  } finally {
    setExporting(false);
  }
}

async function exportOverlay() {
  const fmt = $('formatSelect').value;
  const s = structuredClone(state);
  await runExport('export', { engine: engineFor(fmt), format: fmt, name: s.name, size: `${s.width}x${s.height}`, fps: s.fps, duration: s.duration, text: s.text.content.replace(/\n/g, ' / ') }, async () => {
    const { blob, filename } = await renderToFile(s, fmt, (p, m) => progress(p, m));
    download(blob, filename);
    return 'Export finished. It’s in your Downloads folder.';
  });
}

// ---------- batch export ----------
// Each row = one overlay. Columns (tabs from a spreadsheet, or "|") become lines on screen.
function parseBatch(text, badgeFirst) {
  return text.split(/\r?\n/).map((r) => r.trim()).filter(Boolean).map((row) => {
    const cols = row.split(/\t|\s*\|\s*/).map((c) => c.trim()).filter(Boolean);
    const badge = badgeFirst && cols.length > 1 ? cols.shift() : null;
    return { badge, content: cols.join('\n') };
  }).filter((r) => r.content);
}
function designForRow(row, base = state) {
  const s = structuredClone(base);
  s.text.content = row.content;
  if (row.badge != null) { s.badge.enabled = true; s.badge.text = row.badge; }
  return s;
}

let batchPreviewIndex = 0;
function setupBatch() {
  const dlg = $('batchDialog'), ta = $('batchInput'), badgeBox = $('batchBadgeFirst'), list = $('batchList'), pv = $('batchPreview');
  ta.value = localStorage.getItem('og-batch') || '';
  const rows = () => parseBatch(ta.value, badgeBox.checked);
  const drawPreview = () => {
    const r = rows();
    if (!r.length) { pv.getContext('2d').clearRect(0, 0, pv.width, pv.height); return; }
    batchPreviewIndex = Math.min(batchPreviewIndex, r.length - 1);
    const s = designForRow(r[batchPreviewIndex]);
    pv.width = 480; pv.height = Math.round(480 * s.height / s.width);
    ensureFonts(s).then(() => drawFrame(pv.getContext('2d'), s, holdTime(s), s.width, s.height));
  };
  const refresh = () => {
    localStorage.setItem('og-batch', ta.value);
    const r = rows();
    $('batchCount').textContent = r.length ? `${r.length} overlay${r.length === 1 ? '' : 's'}` : 'Nothing yet';
    $('batchGo').disabled = !r.length;
    $('batchGo').querySelector('span').textContent = r.length ? `Export ${r.length} overlay${r.length === 1 ? '' : 's'}` : 'Export';
    list.innerHTML = '';
    r.slice(0, 200).forEach((row, i) => {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'batch-row';
      b.setAttribute('aria-current', String(i === batchPreviewIndex));
      b.innerHTML = `<span class="n">${String(i + 1).padStart(2, '0')}</span>${row.badge ? `<span class="badge-chip"></span>` : ''}<span class="txt"></span>`;
      if (row.badge) b.querySelector('.badge-chip').textContent = row.badge;
      b.querySelector('.txt').textContent = row.content.replace(/\n/g, ' · ');
      b.onclick = () => { batchPreviewIndex = i; refresh(); };
      li.appendChild(b);
      list.appendChild(li);
    });
    drawPreview();
  };
  ta.oninput = () => { batchPreviewIndex = 0; refresh(); };
  badgeBox.onchange = refresh;
  $('batchBtn').onclick = () => {
    $('batchBadgeRow').hidden = !state.badge.enabled;
    if (!state.badge.enabled) badgeBox.checked = false;
    $('batchFormat').textContent = $('formatSelect').selectedOptions[0].textContent;
    $('batchFolderHint').textContent = typeof window.showDirectoryPicker === 'function'
      ? 'You’ll pick a folder and every file is saved straight into it.'
      : 'Files download one after another. Allow multiple downloads if your browser asks.';
    refresh();
    dlg.showModal();
    ta.focus();
  };
  $('batchClose').onclick = () => dlg.close();
  $('batchSample').onclick = () => {
    ta.value = state.badge.enabled
      ? '18:00\tOpening set\tDJ One\n19:30\tMain act\tThe Headliners\n21:00\tClosing set\tDJ Two'
      : 'Speaker One\tHead of Marketing, Company\nSpeaker Two\tFounder, Studio\nSpeaker Three\tCreative Director, Agency';
    badgeBox.checked = state.badge.enabled;
    batchPreviewIndex = 0;
    refresh();
  };
  $('batchGo').onclick = async () => {
    const r = rows();
    if (!r.length) return;
    let dir = null;
    if (typeof window.showDirectoryPicker === 'function') {
      try { dir = await window.showDirectoryPicker({ id: 'overlay-batch', mode: 'readwrite', startIn: 'downloads' }); }
      catch (e) { if (e.name === 'AbortError') return; log('warn', 'batch.folder.failed', errInfo(e)); }
    }
    dlg.close();
    await exportBatch(r, dir);
  };
}

async function exportBatch(rows, dir) {
  const fmt = $('formatSelect').value;
  const base = structuredClone(state);
  const total = rows.length;
  const pad = String(total).length < 2 ? 2 : String(total).length;
  await runExport('batch', { engine: engineFor(fmt), format: fmt, count: total, target: dir ? 'folder' : 'downloads', size: `${base.width}x${base.height}` }, async () => {
    for (let i = 0; i < total; i++) {
      checkCancel();
      const s = designForRow(rows[i], base);
      const prefix = `${String(i + 1).padStart(pad, '0')}_${nameFor(s)}`;
      const { blob, filename } = await renderToFile(s, fmt, (p, m) => progress((i + p) / total, `${i + 1} of ${total} · ${m}`), prefix);
      if (dir) {
        const fh = await dir.getFileHandle(filename, { create: true });
        const w = await fh.createWritable();
        await w.write(blob);
        await w.close();
      } else {
        download(blob, filename);
        await new Promise((res) => setTimeout(res, 400)); // let the browser start each download
      }
      log('info', 'batch.item', { n: i + 1, of: total, file: filename, mb: +(blob.size / 1e6).toFixed(1) });
    }
    return dir ? `${total} overlays saved to “${dir.name}”.` : `${total} overlays exported. They’re in your Downloads folder.`;
  });
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
const eventOf = (p) => (eventById(p.event) ? p.event : 'general');
function allTemplates() {
  return [
    ...BUILTIN_PRESETS.map((p, i) => ({ key: `b:${i}`, p, tag: eventById(p.event)?.short || (p.event === 'gg' ? 'G&G' : '') })),
    ...sharedPresets.map((p, i) => ({ key: `s:${i}`, p, tag: 'Team' })),
    ...localPresets().map((p, i) => ({ key: `l:${i}`, p, tag: 'Mine' })),
  ];
}
// Templates for the chosen event library ("all" shows everything)
function templateList() {
  const all = allTemplates();
  return currentEvent === 'all' ? all : all.filter(({ p }) => eventOf(p) === currentEvent);
}
function renderEventChips() {
  const all = allTemplates();
  const count = (id) => all.filter(({ p }) => eventOf(p) === id).length;
  const items = [{ id: 'all', name: 'All', accent: '#ffffff', n: all.length }, ...EVENTS.map((e) => ({ ...e, n: count(e.id) })), { ...GENERAL, n: count('general') }]
    .filter((e) => e.id === 'all' || e.n);
  if (!items.some((e) => e.id === currentEvent)) currentEvent = 'all';
  const box = $('eventChips');
  box.innerHTML = items.map((e) => `<button type="button" role="tab" class="chip" data-event="${e.id}" aria-selected="${e.id === currentEvent}" title="${e.name}"><i style="background:${e.accent}"></i>${e.short || e.name}<span>${e.n}</span></button>`).join('');
  box.querySelectorAll('.chip').forEach((b) => { b.onclick = () => setEvent(b.dataset.event); });
}
function setEvent(id) {
  currentEvent = id;
  localStorage.setItem('og-event', id);
  log('info', 'event', { event: id });
  renderTemplates();
  refreshPalettes();
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
  renderEventChips();
  const box = $('templates');
  const list = templateList();
  box.innerHTML = list.length ? '' : '<p class="hint">No templates here yet. Design one and click <b>Save template</b>.</p>';
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
    b.insertAdjacentHTML('beforeend', `${tag ? `<span class="tpl-tag">${tag}</span>` : ''}<span class="tpl-name">${p.name.replace(/^[^·]{1,30} · /, '').replace(/\s*\(\d+\s*[×x]\s*\d+\)\s*$/, '')}</span>`);
    b.onclick = () => selectTemplate(key);
    box.appendChild(b);
    document.fonts.load(fontStr(s.text.weight, 40, s.text.font), s.text.content).catch(() => {}).then(() => drawFrame(c.getContext('2d'), s, holdTime(s), s.width, s.height));
  }
  // keep the hidden select in sync (used by delete + older code paths)
  $('presetSelect').innerHTML = allTemplates().map(({ key, p }) => `<option value="${key}">${p.name}</option>`).join('');
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
    if (eventById(currentEvent)) state.event = currentEvent; // file it under the open event library
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

// ---------- social safe zones (preview only, never exported) ----------
let safeChoice = {};
try { safeChoice = JSON.parse(localStorage.getItem('og-safe') || '{}') || {}; } catch {}
let safeGroupShown = null;
const measureCtx = document.createElement('canvas').getContext('2d');
function cardBox(s = state) {
  const L = computeLayout(measureCtx, s, s.width, s.height);
  return { x: L.card.x * L.u, y: L.card.y * L.u, w: L.card.w * L.u, h: L.card.h * L.u };
}
function currentZone() {
  const id = safeChoice[shapeGroup(state.width, state.height)];
  return zonesFor(state.width, state.height).find((z) => z.id === id) || null;
}
function syncSafeSelect() {
  const group = shapeGroup(state.width, state.height);
  safeGroupShown = group;
  const opts = zonesFor(state.width, state.height).map((z) => `<option value="${z.id}">${z.label}</option>`).join('');
  $('safeSelect').innerHTML = `<option value="">Safe zones: off</option>${opts}`;
  $('safeSelect').value = currentZone()?.id || '';
}
function drawSafeZones() {
  if (shapeGroup(state.width, state.height) !== safeGroupShown) syncSafeSelect();
  const z = currentZone();
  const layer = $('safeLayer'), note = $('safeNote');
  $('safeSelect').closest('.bg-pick').classList.toggle('on', !!z);
  if (!z) { layer.hidden = true; layer.innerHTML = ''; note.hidden = true; return; }
  const W = state.width, H = state.height;
  let box = null, hits = [];
  try { box = cardBox(); hits = conflicts(z, box, W, H); } catch (e) { log('warn', 'safezone.layout', errInfo(e)); }
  layer.innerHTML = zoneSVG(z, W, H, box, !hits.length);
  layer.hidden = false;
  note.hidden = false;
  note.className = `safe-note ${hits.length ? 'bad' : 'ok'}`;
  const list = hits.length > 1 ? `${hits.slice(0, -1).join(', ')} and ${hits.at(-1)}` : hits[0];
  $('safeNoteText').textContent = hits.length
    ? `Part of your overlay sits under ${list} on ${z.label}.`
    : z.id === 'title' ? 'Inside the title-safe area.' : `Clear of ${z.name}’s buttons and captions.`;
  $('safeFix').hidden = !hits.length;
}
function moveInside() {
  const z = currentZone(); if (!z) return;
  const W = state.width, H = state.height, k = Math.min(W, H) / 1080;
  const s = safeRect(z, W, H);
  const pad = 6 * k;
  const L = state.layout;
  for (let i = 0; i < 6; i++) {
    const b = cardBox();
    const f = Math.min(1, (s.w - pad * 2) / b.w, (s.h - pad * 2) / b.h);
    if (f < 0.999) { L.scale = Math.max(0.2, +(L.scale * f).toFixed(3)); continue; }
    const dx = b.x < s.x + pad ? s.x + pad - b.x : b.x + b.w > s.x + s.w - pad ? s.x + s.w - pad - (b.x + b.w) : 0;
    const dy = b.y < s.y + pad ? s.y + pad - b.y : b.y + b.h > s.y + s.h - pad ? s.y + s.h - pad - (b.y + b.h) : 0;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) break;
    L.offsetX = Math.max(-50, Math.min(50, +(L.offsetX + (dx / W) * 100).toFixed(2)));
    L.offsetY = Math.max(-50, Math.min(50, +(L.offsetY + (dy / H) * 100).toFixed(2)));
  }
  log('info', 'safezone.fit', { zone: z.id, scale: L.scale, x: L.offsetX, y: L.offsetY });
  syncControls();
  changed();
  toast(`Moved inside the ${z.label} safe zone. Undo (⌘Z) puts it back.`);
}
function setupSafeZones() {
  syncSafeSelect();
  $('safeSelect').onchange = () => {
    safeChoice[shapeGroup(state.width, state.height)] = $('safeSelect').value;
    try { localStorage.setItem('og-safe', JSON.stringify(safeChoice)); } catch {}
    log('info', 'safezone', { zone: $('safeSelect').value || 'off' });
    drawSafeZones();
  };
  $('safeFix').onclick = moveInside;
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
function toast(msg, ms = 4000) {
  document.querySelectorAll('.toast').forEach((el) => el.remove());
  const el = $('toast').content.firstElementChild.cloneNode(true);
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), ms);
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
  document.querySelectorAll('[role=radiogroup]').forEach((g) => g.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); e.stopPropagation();
    const btns = [...g.querySelectorAll('button')];
    const i = btns.indexOf(document.activeElement);
    const next = btns[(i + (e.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length];
    next.focus(); next.click();
  }));
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
  setupSafeZones();
  setupTransport();
  syncPlay();
  $('exportBtn').onclick = exportOverlay;
  $('cancelBtn').onclick = cancelExport;
  $('stillBtn').onclick = exportStill;
  setupBatch();
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
// If startup fails (e.g. a half-updated install), clear the app cache and reload once
// instead of hanging on "Checking…". A second failure shows a clear message.
async function recover(e) {
  log('error', 'init.failed', errInfo(e));
  const KEY = 'og-recovered';
  if (!sessionStorage.getItem(KEY)) {
    sessionStorage.setItem(KEY, String(Date.now()));
    try { for (const k of await caches.keys()) if (k.startsWith('og-shell-')) await caches.delete(k); } catch {}
    try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch {}
    location.reload();
    return;
  }
  const pill = $('serverStatus');
  if (pill) { pill.textContent = 'Couldn’t start'; pill.className = 'status bad'; }
  toast('The app couldn’t start. Close it and open it again. If that doesn’t help, press ⌘⇧R.', 60000);
}
init().then(() => setTimeout(() => sessionStorage.removeItem('og-recovered'), 5000), recover);
