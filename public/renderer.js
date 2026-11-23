// Overlay renderer — draws one frame of an overlay at time t (seconds).
// The same function drives the live preview and the frame-accurate export,
// so what you see is exactly what gets rendered.

export const FPS_OPTIONS = {
  '23.976': { num: 24000 / 1001, rate: '24000/1001' },
  '24': { num: 24, rate: '24' },
  '25': { num: 25, rate: '25' },
  '29.97': { num: 30000 / 1001, rate: '30000/1001' },
  '30': { num: 30, rate: '30' },
  '50': { num: 50, rate: '50' },
  '59.94': { num: 60000 / 1001, rate: '60000/1001' },
  '60': { num: 60, rate: '60' },
};

export const BASE = {
  name: 'Untitled',
  width: 1920, height: 1080, fps: '25', duration: 6,
  anim: { in: true, out: true, inDur: 1.4, outDur: 0.9, inStyle: 'line', outStyle: 'line', textStyle: 'cascade' },
  layout: { anchor: 'center', offsetX: 0, offsetY: 0, scale: 1, safe: 5, autoFit: true },
  text: {
    content: 'Your title\ngoes here', uppercase: false, font: 'Bricolage Grotesque', weight: 800,
    size: 56, lineHeight: 1.2, tracking: 0.02, color: '#f2f2f2', align: 'center',
    revealTint: '#FB690C', shadow: 0,
  },
  card: {
    padX: 56, padY: 56, minWidth: 0, minHeight: 0, radius: 22,
    colors: ['#3fa4b4', '#3a4fb4', '#5a4aa8'], angle: 20, opacity: 0.95,
    glow: 70, softness: 1, fill: '#0b0b22', fillOpacity: 0,
  },
  blobs: { enabled: true, colors: ['#3ab8ff', '#2a3cff'], count: 3, size: 0.32, speed: 1, intensity: 0.9 },
  badge: {
    enabled: false, text: '14:10', size: 60, weight: 700, padX: 36, padY: 14, radius: 12, gap: 28,
    colors: ['#5b45e6', '#c63fb6'], angle: 0, glow: 30, opacity: 1, scramble: true,
  },
  // 'glow' = text in a glowing box; 'gold' = glitter-gold lettering (LMC Evophoria look)
  style: 'glow',
  gold: {
    colors: ['#905921', '#B98434', '#D0A746', '#E2B94F', '#E7CB64', '#F4E287', '#F7EFCA'],
    script: true, scriptFont: 'Snell Roundhand', scriptScale: 1.05,
    tilt: -9, slant: 14, boost: 7,
    grain: 0.9, sparkle: 0.3, grit: 1.2,
    bevel: 0.35, bevelSize: 8, lightAngle: 42,
    shadowColor: '#49121F', shadowOpacity: 0.55, shadowAngle: 40, shadowDistance: 14, shadowBlur: 16,
  },
  // 'crest' = MMFF two-part badge: top text in a shield panel, bottom text below.
  // It grows taller (never wider) as lines are added.
  crest: {
    variant: 'solid', // solid | outline | overlay
    bottom: 'Also Add\nTEXT HERE',
    fill: '#83D6AC', panel: '#FF7BAC', line: '#EFFACF', topColor: '#EFFACF', bottomColor: '#00664F',
    tint: '#000000', tintOpacity: 0.15, stroke: 16,
    capsFont: 'Fraunces', capsWeight: 900, scriptFont: 'Snell Roundhand',
    topSize: 136, bottomSize: 125, tracking: 0,
  },
};

export function defaults() { return structuredClone(BASE); }

// Fill in any keys a saved preset is missing (keeps old presets working).
export function normalize(s) {
  const out = defaults();
  const merge = (dst, src) => {
    for (const k of Object.keys(src || {})) {
      if (dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) merge(dst[k], src[k]);
      else dst[k] = src[k];
    }
  };
  merge(out, s);
  return out;
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = {
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inCubic: (x) => x * x * x,
  outBack: (x) => { const c1 = 1.1, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
};
const rand = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

function hexToRgb(h) {
  h = (h || '#ffffff').replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const rgba = (hex, a = 1) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; };
function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`;
}

function roundRect(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

export const fontStr = (weight, size, family) => `${weight} ${size}px "${family}"`;

const layers = {};
function getLayer(key, w, h) {
  let L = layers[key];
  if (!L) L = layers[key] = document.createElement('canvas');
  if (L.width < w || L.height < h) { L.width = Math.max(L.width, w); L.height = Math.max(L.height, h); }
  return L;
}

function perimeterPoint(u, w, h) {
  let d = (((u % 1) + 1) % 1) * 2 * (w + h);
  if (d < w) return [d, 0];
  d -= w; if (d < h) return [w, d];
  d -= h; if (d < w) return [w - d, h];
  d -= w; return [0, h - d];
}

// A rounded box whose edges glow with a gradient that fades to fully
// transparent toward the centre (the look of the original overlays).
function drawGlowBox(ctx, k, box, opt, t, key, blobs, blobAlpha) {
  const { x, y, w, h } = box;
  const dw = Math.ceil(w * k) + 2, dh = Math.ceil(h * k) + 2;
  if (w * k < 0.5 || h * k < 0.5) return;
  const L = getLayer(key, dw, dh);
  const c = L.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.globalCompositeOperation = 'source-over';
  c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0;
  c.clearRect(0, 0, dw + 2, dh + 2);
  c.setTransform(k, 0, 0, k, 0, 0);
  const r = Math.min(opt.radius, w / 2, h / 2);

  // 1. gradient fill
  const ang = (opt.angle * Math.PI) / 180;
  const cx = w / 2, cy = h / 2;
  const len = (Math.abs(w * Math.cos(ang)) + Math.abs(h * Math.sin(ang))) / 2;
  const g = c.createLinearGradient(cx - Math.cos(ang) * len, cy - Math.sin(ang) * len, cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
  const cols = opt.colors.length ? opt.colors : ['#ffffff'];
  cols.forEach((col, i) => g.addColorStop(cols.length === 1 ? 0 : i / (cols.length - 1), col));
  roundRect(c, 0, 0, w, h, r);
  c.fillStyle = g;
  c.fill();

  // 2. cut a soft hole so the centre is transparent
  const band = Math.min(opt.glow, Math.min(w, h) / 2);
  const inset = band * 0.5;
  const hw = w - inset * 2, hh = h - inset * 2;
  if (hw > 0 && hh > 0) {
    const OFF = 20000;
    c.globalCompositeOperation = 'destination-out';
    c.shadowColor = '#000';
    c.shadowBlur = band * 0.75 * opt.softness * k; // shadow units are device px
    c.shadowOffsetX = OFF * k;
    roundRect(c, inset - OFF, inset, hw, hh, Math.max(2, r - inset * 0.4));
    c.fillStyle = '#000';
    c.fill();
    c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0;
  }

  // 3. animated light blobs drifting along the edge
  if (blobs && blobs.enabled && blobAlpha > 0 && blobs.count > 0) {
    c.globalCompositeOperation = 'source-over';
    c.save();
    roundRect(c, 0, 0, w, h, r);
    c.clip();
    const sp = blobs.speed;
    for (let i = 0; i < blobs.count; i++) {
      const dir = i % 2 ? 1 : -1;
      const u = rand(i + 3) + t * 0.05 * sp * dir * (0.7 + rand(i + 9) * 0.6);
      const [px, py] = perimeterPoint(u, w, h);
      const R = blobs.size * Math.min(w, h) * (0.7 + 0.3 * Math.sin(t * 1.3 * sp + i * 2.1));
      const a = blobs.intensity * blobAlpha * (0.55 + 0.45 * Math.sin(t * 0.9 * sp + i * 1.7));
      const col = blobs.colors[i % blobs.colors.length] || '#ffffff';
      const rg = c.createRadialGradient(px, py, 0, px, py, Math.max(1, R));
      rg.addColorStop(0, rgba(col, a));
      rg.addColorStop(0.45, rgba(col, a * 0.55));
      rg.addColorStop(1, rgba(col, 0));
      c.fillStyle = rg;
      c.fillRect(0, 0, w, h);
    }
    c.restore();
  }

  ctx.drawImage(L, 0, 0, dw, dh, x, y, dw / k, dh / k);
}

// Measure text + badge and work out where the card sits in the frame.
export function computeLayout(ctx, s, W, H) {
  if (s.style === 'gold') return goldLayout(ctx, s, W, H);
  if (s.style === 'crest') return crestLayout(ctx, s, W, H);
  const T = s.text, C = s.card, B = s.badge;
  const raw = T.uppercase ? T.content.toUpperCase() : T.content;
  const lines = raw.split('\n');
  ctx.font = fontStr(T.weight, T.size, T.font);
  const track = T.tracking * T.size;
  const lineData = lines.map((str) => {
    const chars = [...str];
    const xs = [];
    let acc = '';
    for (let i = 0; i < chars.length; i++) { xs.push(ctx.measureText(acc).width + i * track); acc += chars[i]; }
    const cw = chars.map((ch) => ctx.measureText(ch).width);
    const w = chars.length ? ctx.measureText(str).width + (chars.length - 1) * track : 0;
    return { str, chars, xs, cw, w };
  });
  const capH = ctx.measureText('H').actualBoundingBoxAscent || T.size * 0.7;
  const lh = T.size * T.lineHeight;
  const textW = Math.max(0, ...lineData.map((l) => l.w));
  const textH = lines.length * lh;

  let badge = null;
  if (B.enabled) {
    ctx.font = fontStr(B.weight, B.size, T.font);
    const chars = [...B.text];
    const btrack = T.tracking * B.size;
    const xs = []; let acc = '';
    for (let i = 0; i < chars.length; i++) { xs.push(ctx.measureText(acc).width + i * btrack); acc += chars[i]; }
    // reserve width for the widest digit so scrambling doesn't jitter
    const tw = ctx.measureText(B.text).width + Math.max(0, chars.length - 1) * btrack;
    const bcap = ctx.measureText('8').actualBoundingBoxAscent || B.size * 0.7;
    badge = { chars, xs, tw, cap: bcap, w: tw + B.padX * 2, h: bcap + B.padY * 2 + B.size * 0.35 };
  }

  const contentW = Math.max(textW, badge ? badge.w : 0);
  const contentH = textH + (badge ? badge.h + B.gap : 0);
  const cw = Math.max(C.minWidth, contentW + C.padX * 2);
  const ch = Math.max(C.minHeight, contentH + C.padY * 2);
  const { u, x, y } = place(s, W, H, cw, ch);
  return { u, lines: lineData, lh, capH, track, textW, textH, contentH, badge, card: { x, y, w: cw, h: ch } };
}

// Scale and position a cw × ch block (design units) in the frame.
function place(s, W, H, cw, ch) {
  const base = Math.min(W, H) / 1080;
  let u = base * s.layout.scale;
  const safePx = (s.layout.safe / 100) * Math.min(W, H);
  if (s.layout.autoFit) {
    const fit = Math.min(1, (W - safePx * 2) / (cw * u), (H - safePx * 2) / (ch * u));
    u *= fit;
  }
  const fw = W / u, fh = H / u, m = safePx / u;
  const [vy, hx] = s.layout.anchor === 'center' ? ['middle', 'center'] : s.layout.anchor.split('-');
  let x = hx === 'left' ? m : hx === 'right' ? fw - m - cw : (fw - cw) / 2;
  let y = vy === 'top' ? m : vy === 'bottom' ? fh - m - ch : (fh - ch) / 2;
  x += (s.layout.offsetX / 100) * fw;
  y += (s.layout.offsetY / 100) * fh;
  return { u, x, y };
}

function timeline(s, t) {
  const A = s.anim, D = s.duration;
  const inP = A.in ? clamp(t / A.inDur) : 1;
  const outP = A.out ? clamp((t - (D - A.outDur)) / A.outDur) : 0;
  const r = { gw: 1, gh: 1, alpha: 1, scale: 1, dy: 0, textIn: 1, textOut: 0, badgeIn: 1, badgeOut: 0 };

  if (A.in) {
    if (A.inStyle === 'line') {
      r.gw *= ease.outCubic(seg(inP, 0, 0.2));
      r.gh *= ease.outBack(seg(inP, 0.14, 0.48));
      r.badgeIn = seg(inP, 0.36, 0.62);
      r.textIn = seg(inP, 0.42, 1);
    } else {
      const e = ease.outCubic(seg(inP, 0, 0.45));
      r.alpha *= e;
      if (A.inStyle === 'pop') r.scale *= lerp(0.82, 1, ease.outBack(seg(inP, 0, 0.45)));
      if (A.inStyle === 'slide') r.dy += (1 - e) * 70;
      r.badgeIn = seg(inP, 0.2, 0.55);
      r.textIn = seg(inP, 0.3, 1);
    }
  }
  if (A.out) {
    if (A.outStyle === 'line') {
      r.textOut = seg(outP, 0, 0.4);
      r.badgeOut = seg(outP, 0.2, 0.45);
      r.gh *= 1 - ease.inCubic(seg(outP, 0.4, 0.72));
      r.gw *= 1 - ease.inCubic(seg(outP, 0.68, 1));
      r.alpha *= 1 - seg(outP, 0.9, 1);
    } else {
      r.textOut = seg(outP, 0, 0.5);
      r.badgeOut = seg(outP, 0.1, 0.5);
      const e = ease.inCubic(seg(outP, 0.3, 1));
      r.alpha *= 1 - e;
      if (A.outStyle === 'pop') r.scale *= 1 - 0.15 * e;
      if (A.outStyle === 'slide') r.dy -= e * 70;
    }
  }
  r.blob = (A.in ? seg(inP, 0.75, 1) : 1) * (A.out ? 1 - seg(outP, 0, 0.3) : 1);
  if (A.out && t >= D) r.alpha = 0;
  return r;
}

// Per-character progress for the chosen text reveal style.
function charProgress(style, p, idx, total, wordIdx, words, lineIdx, lines) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  const win = 0.4;
  switch (style) {
    case 'fade': return ease.outCubic(p);
    case 'typewriter': return p * total > idx ? 1 : 0;
    case 'words': { const st = (wordIdx / Math.max(1, words - 1)) * (1 - 0.5); return ease.outCubic(seg(p, st, st + 0.5)); }
    case 'lines': { const st = (lineIdx / Math.max(1, lines - 1)) * (1 - 0.55); return ease.outCubic(seg(p, st, st + 0.55)); }
    default: { const st = (idx / Math.max(1, total - 1)) * (1 - win); return ease.outCubic(seg(p, st, st + win)); }
  }
}

export function drawFrame(ctx, s, t, W, H) {
  const ds = ctx.canvas.width / W; // device scale (preview canvas is smaller than output)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (s.style === 'gold') return drawGold(ctx, s, t, W, H, ds);
  if (s.style === 'crest') return drawCrest(ctx, s, t, W, H, ds);
  const Lay = computeLayout(ctx, s, W, H);
  const tl = timeline(s, t);
  if (tl.alpha <= 0.001 || tl.gw <= 0.001) return Lay;
  const k = Lay.u * ds;
  const C = s.card, T = s.text, B = s.badge;
  const { card } = Lay;
  const cx = card.x + card.w / 2, cy = card.y + card.h / 2;

  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.translate(cx, cy + tl.dy);
  ctx.scale(tl.scale, tl.scale);
  ctx.translate(-cx, -cy);
  const kk = k * tl.scale;
  ctx.globalAlpha = tl.alpha;

  // card geometry (line -> box)
  const thin = 5;
  const w = card.w * tl.gw;
  const h = lerp(Math.min(thin, card.h), card.h, clamp(tl.gh, 0, 2));
  const box = { x: cx - w / 2, y: cy - h / 2, w, h };

  if (C.fillOpacity > 0) {
    ctx.save();
    ctx.globalAlpha = tl.alpha * C.fillOpacity;
    roundRect(ctx, box.x, box.y, box.w, box.h, C.radius);
    ctx.fillStyle = C.fill;
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.globalAlpha = tl.alpha * C.opacity;
  drawGlowBox(ctx, kk, box, C, t, 'card', s.blobs, tl.blob);
  ctx.restore();

  // content block placement inside the card
  const innerTop = card.y + C.padY + (card.h - C.padY * 2 - Lay.contentH) / 2;
  const alignX = (cw) => (T.align === 'left' ? card.x + C.padX : T.align === 'right' ? card.x + card.w - C.padX - cw : card.x + (card.w - cw) / 2);
  let textTop = innerTop;

  // badge (e.g. a timestamp)
  if (Lay.badge) {
    const bd = Lay.badge;
    const bIn = tl.badgeIn, bOut = tl.badgeOut;
    textTop += bd.h + B.gap;
    if (bIn > 0 && bOut < 1) {
      const bw = bd.w * lerp(0.3, 1, ease.outCubic(seg(bIn, 0, 0.5))) * lerp(1, 0.3, ease.inCubic(bOut));
      const bx = alignX(bd.w) + (bd.w - bw) / 2;
      const ba = seg(bIn, 0, 0.25) * (1 - seg(bOut, 0.6, 1));
      ctx.save();
      ctx.globalAlpha = tl.alpha * ba * B.opacity;
      drawGlowBox(ctx, kk, { x: bx, y: innerTop, w: bw, h: bd.h }, { ...B, softness: 1 }, t, 'badge', null, 0);
      ctx.restore();

      ctx.save();
      ctx.font = fontStr(B.weight, B.size, T.font);
      ctx.textBaseline = 'alphabetic';
      const base = innerTop + bd.h / 2 + bd.cap / 2;
      const startX = alignX(bd.w) + B.padX;
      const n = bd.chars.length;
      bd.chars.forEach((chr, i) => {
        const st = (i / Math.max(1, n)) * 0.55;
        const pIn = seg(bIn, 0.15 + st, 0.15 + st + 0.3);
        const pOut = seg(bOut, (i / Math.max(1, n)) * 0.4, (i / Math.max(1, n)) * 0.4 + 0.5);
        const vis = pIn * (1 - pOut);
        if (vis <= 0) return;
        let glyph = chr;
        if (B.scramble && /\d/.test(chr) && pIn < 1) glyph = String(Math.floor(rand(Math.floor(t * 18) + i * 7) * 10));
        ctx.globalAlpha = tl.alpha * vis;
        ctx.fillStyle = mixHex(T.revealTint, T.color, pIn);
        ctx.fillText(glyph, startX + bd.xs[i], base);
      });
      ctx.restore();
    }
  }

  // main text
  if (tl.textIn > 0 && tl.textOut < 1) {
    ctx.save();
    ctx.font = fontStr(T.weight, T.size, T.font);
    ctx.textBaseline = 'alphabetic';
    if (T.shadow > 0) { ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = T.shadow * kk; }
    const total = Lay.lines.reduce((a, l) => a + l.chars.length, 0);
    const words = Lay.lines.reduce((a, l) => a + l.str.split(/\s+/).filter(Boolean).length, 0);
    let idx = 0, wordIdx = 0;
    Lay.lines.forEach((ln, li) => {
      const x0 = alignX(ln.w);
      const base = textTop + li * Lay.lh + Lay.lh / 2 + Lay.capH / 2;
      ln.chars.forEach((chr, ci) => {
        if (chr === ' ') { if (ci > 0 && ln.chars[ci - 1] !== ' ') wordIdx++; idx++; return; }
        const pIn = charProgress(s.anim.textStyle, tl.textIn, idx, total, wordIdx, words, li, Lay.lines.length);
        const pOut = charProgress(s.anim.textStyle === 'typewriter' ? 'cascade' : s.anim.textStyle, tl.textOut, idx, total, wordIdx, words, li, Lay.lines.length);
        idx++;
        const vis = pIn * (1 - pOut);
        if (vis <= 0.001) return;
        const px = x0 + ln.xs[ci], cwid = ln.cw[ci];
        const rot = (rand(idx * 3.1) - 0.5) * 0.45;
        const dyIn = (1 - pIn) * T.size * 0.35;
        const dyOut = -pOut * T.size * 0.3;
        const ang = rot * (1 - pIn) + rot * 0.6 * pOut;
        ctx.save();
        ctx.globalAlpha = tl.alpha * vis;
        ctx.translate(px + cwid / 2, base - Lay.capH / 2 + dyIn + dyOut);
        ctx.rotate(ang);
        ctx.fillStyle = mixHex(T.revealTint, T.color, Math.min(pIn, 1 - pOut * 0.5));
        ctx.fillText(chr, -cwid / 2, Lay.capH / 2);
        ctx.restore();
      });
      wordIdx++;
    });
    ctx.restore();
  }
  return Lay;
}

// ---------- gold glitter text ----------
// Recreates the LMC "Evophoria" Photoshop look in code: a glitter fill
// (random grains from a gold ramp), Dissolve-style rough edges, an inner
// bevel and a plum drop shadow, set on a tilt with an italic slant.
// Lowercase words can be set in a script face ("step OUT of the").
// The expensive pixel work is cached; each frame only blits the result.

let fontEpoch = 0;
if (typeof document !== 'undefined' && document.fonts) document.fonts.addEventListener('loadingdone', () => { fontEpoch++; });

const SCRIPT_FALLBACK = '"Great Vibes", cursive';
const scriptFontStr = (G, size) => `700 ${size}px "${G.scriptFont}", ${SCRIPT_FALLBACK}`;
const DEG = Math.PI / 180;

// Split lines into runs of caps or script words, measured in design units.
function goldRuns(ctx, s) {
  const T = s.text, G = s.gold;
  const raw = T.uppercase ? T.content.toUpperCase() : T.content;
  const capsFont = fontStr(T.weight, T.size, T.font);
  const scriptFont = scriptFontStr(G, T.size * G.scriptScale);
  ctx.font = capsFont;
  const space = ctx.measureText(' ').width * 1.1;
  const capH = ctx.measureText('H').actualBoundingBoxAscent || T.size * 0.7;
  const track = T.tracking * T.size;
  const isScript = (w) => G.script && /[a-z]/.test(w) && w === w.toLowerCase();
  const lines = raw.split('\n').map((str) => {
    const words = str.split(/\s+/).filter(Boolean);
    let x = 0;
    const runs = words.map((w, i) => {
      const script = isScript(w);
      ctx.font = script ? scriptFont : capsFont;
      const chars = [...w];
      const width = ctx.measureText(w).width + (script ? 0 : Math.max(0, chars.length - 1) * track);
      const r = { text: w, script, x, w: width };
      x += width + (i < words.length - 1 ? space : 0);
      return r;
    });
    return { runs, w: x };
  });
  const lh = T.size * T.lineHeight;
  const bw = Math.max(1, ...lines.map((l) => l.w));
  const bh = lines.length * lh;
  return { lines, lh, bw, bh, capH, track, capsFont, scriptFont };
}

// Tilt + slant as one matrix (design units, origin at the block centre)
function goldMatrix(G) {
  const a = G.tilt * DEG, k = -Math.tan(G.slant * DEG);
  const c = Math.cos(a), s = Math.sin(a);
  // R · Skew, where Skew = [1 k; 0 1]
  return [c, s, c * k - s, s * k + c];
}

function goldGeometry(ctx, s) {
  const G = s.gold, T = s.text;
  const R = goldRuns(ctx, s);
  const [a, b, c, d] = goldMatrix(G);
  const hw = R.bw / 2, hh = R.bh / 2;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]]) {
    const X = a * x + c * y, Y = b * x + d * y;
    minX = Math.min(minX, X); maxX = Math.max(maxX, X); minY = Math.min(minY, Y); maxY = Math.max(maxY, Y);
  }
  const pad = T.size * 0.25 + G.grit * 2 + G.boost;
  const sh = G.shadowDistance + G.shadowBlur;
  return { R, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2, sh };
}

function goldLayout(ctx, s, W, H) {
  const g = goldGeometry(ctx, s);
  const cw = g.w + g.sh, ch = g.h + g.sh;
  const { u, x, y } = place(s, W, H, cw, ch);
  return { u, geo: g, card: { x, y, w: cw, h: ch } };
}

// Deterministic per-cell noise
const hash2 = (x, y, seed) => {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// Separable box blur, repeated (≈ gaussian). Works on Float32 arrays in place.
function boxBlur(src, w, h, r, passes = 2) {
  r = Math.max(0, Math.round(r));
  if (!r) return src;
  const tmp = new Float32Array(src.length);
  const inv = 1 / (r * 2 + 1);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += src[o + Math.min(w - 1, Math.max(0, i))];
      for (let x = 0; x < w; x++) {
        tmp[o + x] = acc * inv;
        acc += src[o + Math.min(w - 1, x + r + 1)] - src[o + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let i = -r; i <= r; i++) acc += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
      for (let y = 0; y < h; y++) {
        src[y * w + x] = acc * inv;
        acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
      }
    }
  }
  return src;
}

const goldCache = new Map();
function buildGold(s, geo, k) {
  const G = s.gold, T = s.text;
  const key = JSON.stringify([T.content, T.uppercase, T.font, T.weight, T.size, T.lineHeight, T.tracking, T.align, G, Math.round(k * 1000), fontEpoch]);
  const hit = goldCache.get(key);
  if (hit) return hit;

  const dw = Math.max(2, Math.ceil(geo.w * k)), dh = Math.max(2, Math.ceil(geo.h * k));
  const cv = document.createElement('canvas');
  cv.width = dw; cv.height = dh;
  const c = cv.getContext('2d', { willReadFrequently: true });

  // 1. white mask of the lettering, tilted and slanted
  const [a, b, cc, d] = goldMatrix(G);
  c.setTransform(a * k, b * k, cc * k, d * k, dw / 2, dh / 2);
  c.fillStyle = '#fff'; c.strokeStyle = '#fff';
  c.lineJoin = 'round'; c.lineWidth = G.boost;
  c.textBaseline = 'alphabetic';
  const R = geo.R;
  R.lines.forEach((ln, li) => {
    const x0 = T.align === 'left' ? -R.bw / 2 : T.align === 'right' ? R.bw / 2 - ln.w : -ln.w / 2;
    const base = -R.bh / 2 + li * R.lh + R.lh / 2 + R.capH / 2;
    for (const run of ln.runs) {
      c.font = run.script ? R.scriptFont : R.capsFont;
      const draw = (str, x) => { c.fillText(str, x, base); if (G.boost > 0) c.strokeText(str, x, base); };
      if (run.script || !R.track) draw(run.text, x0 + run.x);
      else {
        let x = x0 + run.x;
        for (const ch of run.text) { draw(ch, x); x += c.measureText(ch).width + R.track; }
      }
    }
  });

  // 2. per-pixel glitter, bevel and rough edges
  const img = c.getImageData(0, 0, dw, dh);
  const px = img.data, n = dw * dh;
  const A = new Float32Array(n);
  for (let i = 0; i < n; i++) A[i] = px[i * 4 + 3] / 255;
  const height = boxBlur(Float32Array.from(A), dw, dh, Math.max(1, G.bevelSize * k * 0.5), 3);
  const soft = G.grit > 0 ? boxBlur(Float32Array.from(A), dw, dh, G.grit * k * 0.6, 2) : A;

  const ramp = G.colors.map(hexToRgb);
  const last = ramp.length - 1;
  const cell = Math.max(1, G.grain * k);
  // light comes from lightAngle (Photoshop convention: 0° = from the right, 90° = from the top)
  const la = G.lightAngle * DEG, alt = 26 * DEG;
  const Lx = Math.cos(la) * Math.cos(alt), Ly = -Math.sin(la) * Math.cos(alt), Lz = Math.sin(alt);
  const depth = 3.4 * Math.max(1, G.bevelSize * k * 0.5);
  const sparkle = G.sparkle * 0.05;

  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const i = y * dw + x, o = i * 4;
      const sa = soft[i];
      if (sa < 0.004) { px[o + 3] = 0; continue; }
      // Dissolve: each pixel is fully on or off, chance = its soft coverage
      const on = G.grit > 0 ? hash2(x, y, 7) < Math.min(1, sa * 1.15) : true;
      if (!on) { px[o + 3] = 0; continue; }
      const cx = Math.floor(x / cell), cy = Math.floor(y / cell);
      const v = hash2(cx, cy, 1) * last;
      const j = Math.min(last - 1, Math.floor(v)), f = v - j;
      const c0 = ramp[j], c1 = ramp[Math.min(last, j + 1)];
      let r = c0[0] + (c1[0] - c0[0]) * f, g = c0[1] + (c1[1] - c0[1]) * f, bl = c0[2] + (c1[2] - c0[2]) * f;
      if (hash2(cx, cy, 3) < sparkle) { r += (255 - r) * 0.85; g += (250 - g) * 0.85; bl += (235 - bl) * 0.85; }
      // bevel: shade from the slope of the blurred mask
      if (G.bevel > 0) {
        const gx = (height[y * dw + Math.min(dw - 1, x + 1)] - height[y * dw + Math.max(0, x - 1)]) * depth;
        const gy = (height[Math.min(dh - 1, y + 1) * dw + x] - height[Math.max(0, y - 1) * dw + x]) * depth;
        const inv = 1 / Math.hypot(gx, gy, 1);
        const shade = (-gx * Lx - gy * Ly + Lz) * inv - Lz;
        if (shade > 0) { const h = Math.min(1, shade / (1 - Lz)) * G.bevel; r += (255 - r) * h; g += (254 - g) * h; bl += (250 - bl) * h; }
        else { const m = 1 - Math.min(1, -shade / Lz) * G.bevel * 0.5; r *= m; g *= m; bl *= m; }
      }
      px[o] = r; px[o + 1] = g; px[o + 2] = bl;
      px[o + 3] = G.grit > 0 ? 255 : px[o + 3];
    }
  }
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.putImageData(img, 0, 0);

  goldCache.set(key, cv);
  if (goldCache.size > 8) goldCache.delete(goldCache.keys().next().value);
  return cv;
}

// Timeline for still-built looks (gold, crest): the box "line" animation plays as a fade
const stillTimeline = (s, t) => timeline({ ...s, anim: { ...s.anim, inStyle: s.anim.inStyle === 'line' ? 'fade' : s.anim.inStyle, outStyle: s.anim.outStyle === 'line' ? 'fade' : s.anim.outStyle } }, t);

// Draw a pre-built image centred on the layout's card, with the timeline's fade/pop/slide
function blitStill(ctx, Lay, tl, ds, img) {
  const { card } = Lay;
  const cx = (card.x + card.w / 2) * Lay.u * ds, cy = (card.y + card.h / 2 + tl.dy) * Lay.u * ds;
  const iw = img.width * tl.scale, ih = img.height * tl.scale;
  if (tl.scale === 1) ctx.drawImage(img, Math.round(cx - iw / 2), Math.round(cy - ih / 2));
  else ctx.drawImage(img, cx - iw / 2, cy - ih / 2, iw, ih);
}

function drawGold(ctx, s, t, W, H, ds) {
  const Lay = goldLayout(ctx, s, W, H);
  const tl = stillTimeline(s, t);
  if (tl.alpha <= 0.001) return Lay;
  const G = s.gold;
  const k0 = Lay.u * ds, k = k0 * tl.scale;
  const img = buildGold(s, Lay.geo, k0); // built once; pop/shrink only scales the blit
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = tl.alpha;
  if (G.shadowOpacity > 0) {
    const sd = G.shadowDistance * k, sa = G.shadowAngle * DEG;
    ctx.shadowColor = rgba(G.shadowColor, G.shadowOpacity);
    ctx.shadowBlur = G.shadowBlur * k;
    ctx.shadowOffsetX = -Math.cos(sa) * sd;
    ctx.shadowOffsetY = Math.sin(sa) * sd;
  }
  blitStill(ctx, Lay, tl, ds, img);
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.globalAlpha = 1;
  return Lay;
}

// ---------- MMFF crest ----------
// Shapes traced from MMFF_2027_Overlays.ai (artboard 1080 × 1920 pt, y up).
// Every side is a straight vertical line, so the crest stretches vertically by
// moving points below a split line down: below CREST_TOP_SPLIT for extra top
// lines, below CREST_BOTTOM_SPLIT for extra bottom lines. The width never changes.
const CREST_PATHS = {
  outer: 'M 540 350.25 C 519.94 350.25 499.88 357.9 484.58 373.2 C 404.46 453.32 281.27 461.96 232.02 461.96 C 217.34 461.96 208.05 461.21 206.81 461.1 C 204.05 460.81 201.29 460.66 198.55 460.66 C 179.37 460.66 160.92 467.76 146.46 480.74 C 129.89 495.6 120.73 516.85 120.73 539.11 L 120.73 1380.9 C 120.73 1403.16 129.89 1424.41 146.47 1439.27 C 160.92 1452.24 179.38 1459.34 198.55 1459.34 C 201.3 1459.34 204.06 1459.2 206.84 1458.9 C 208.13 1458.79 217.39 1458.04 232.02 1458.04 C 281.27 1458.04 404.47 1466.69 484.58 1546.8 C 499.88 1562.1 519.94 1569.76 540 1569.76 C 560.06 1569.76 580.12 1562.1 595.43 1546.8 C 678.97 1463.26 836.04 1459.03 866.68 1459.03 C 873.36 1459.03 877.16 1459.19 877.19 1459.2 C 878.49 1459.26 879.79 1459.29 881.09 1459.29 C 901.14 1459.29 920.41 1451.59 935.02 1437.69 C 950.57 1422.89 959.27 1402.36 959.27 1380.9 L 959.27 539.11 C 959.27 517.64 950.47 497.11 934.92 482.32 C 920.31 468.42 900.95 460.72 880.89 460.72 C 879.59 460.72 878.3 460.75 876.99 460.82 C 876.98 460.82 873.21 460.98 866.69 460.98 C 836.05 460.98 678.97 456.74 595.43 373.2 C 580.12 357.9 560.06 350.25 540 350.25 Z',
  shield: 'M 540 1491.37 C 408.43 1359.8 199.11 1380.9 199.11 1380.9 L 199.11 842.02 C 199.11 842.02 408.43 863.11 540 731.54 C 661.4 852.95 880.89 842.02 880.89 842.02 L 880.89 1380.9 C 880.89 1380.9 661.4 1369.97 540 1491.37 Z',
  panel: 'M 540.19 758.82 C 434.91 852.74 290.87 863.23 232.02 863.23 C 227.28 863.23 222.95 863.17 219.08 863.07 L 219.08 1359.85 C 222.95 1359.75 227.28 1359.68 232.02 1359.68 C 290.87 1359.68 434.91 1370.18 540.19 1464.09 C 581.32 1428.99 682.95 1362.11 860.92 1360.69 L 860.92 862.22 C 682.95 860.8 581.32 793.93 540.19 758.82 Z',
};
const CREST = {
  left: 120.73, right: 959.27, top: 1569.76, bottom: 350.25,
  topSplit: 1110, bottomSplit: 600,
  topMid: 1070.2, topLines: 3, topWidth: 560, // middle baseline of the 3-line top block
  bottomMid: 593.77, bottomLines: 2, bottomWidth: 740,
  lead: 0.889, // line advance, × font size
};
const parsedCrest = {};
const crestPath = (name) => parsedCrest[name] || (parsedCrest[name] = CREST_PATHS[name].split(' ').reduce((acc, tok) => {
  if (/^[MLCZ]$/.test(tok)) acc.push([tok]); else acc[acc.length - 1].push(+tok);
  return acc;
}, []));

// Words with a lowercase letter are set in script ("Add", "Here"), all-caps words in the serif
const isScriptWord = (w) => /[a-z]/.test(w);
function crestBlock(ctx, C, raw, size, maxW) {
  const capsF = (px) => `${C.capsWeight} ${px}px "${C.capsFont}", Georgia, serif`;
  const scriptF = (px) => `900 ${px}px "${C.scriptFont}", ${SCRIPT_FALLBACK}`;
  const lines = String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean);
  return lines.map((str) => {
    const words = str.split(/\s+/);
    const measure = (px) => {
      const space = px * 0.27; // word gap as in the artwork (Fraunces' own space is much narrower)
      let x = 0;
      const runs = words.map((w, i) => {
        const script = isScriptWord(w);
        ctx.font = script ? scriptF(px) : capsF(px);
        const width = ctx.measureText(w).width + (script ? 0 : Math.max(0, [...w].length - 1) * C.tracking * px);
        const r = { text: w, script, x, w: width, font: script ? scriptF(px) : capsF(px), track: script ? 0 : C.tracking * px };
        x += width + (i < words.length - 1 ? space : 0);
        return r;
      });
      return { runs, w: x };
    };
    let m = measure(size);
    if (m.w > maxW) m = measure(size * maxW / m.w); // only ever shrinks to fit the width
    return m;
  });
}

function crestGeometry(ctx, s) {
  const C = s.crest;
  const top = crestBlock(ctx, C, s.text.uppercase ? s.text.content.toUpperCase() : s.text.content, C.topSize, CREST.topWidth);
  const bottom = crestBlock(ctx, C, C.bottom, C.bottomSize, CREST.bottomWidth);
  const tAdv = C.topSize * CREST.lead, bAdv = C.bottomSize * CREST.lead;
  const topExtra = Math.max(0, top.length - CREST.topLines) * tAdv;
  const bottomExtra = Math.max(0, bottom.length - CREST.bottomLines) * bAdv;
  const pad = C.stroke / 2 + 2;
  return {
    top, bottom, tAdv, bAdv, topExtra, bottomExtra, pad,
    w: CREST.right - CREST.left + pad * 2,
    h: CREST.top - CREST.bottom + topExtra + bottomExtra + pad * 2,
  };
}

function crestLayout(ctx, s, W, H) {
  const geo = crestGeometry(ctx, s);
  const { u, x, y } = place(s, W, H, geo.w, geo.h);
  return { u, geo, card: { x, y, w: geo.w, h: geo.h } };
}

const crestCache = new Map();
function buildCrest(s, geo, k) {
  const C = s.crest;
  const key = JSON.stringify([s.text.content, s.text.uppercase, C, Math.round(k * 1000), fontEpoch]);
  const hit = crestCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = Math.max(2, Math.ceil(geo.w * k)); cv.height = Math.max(2, Math.ceil(geo.h * k));
  const c = cv.getContext('2d');
  // artwork (pt, y up) → canvas (px, y down), with the vertical stretch
  const X = (x) => (x - CREST.left + geo.pad) * k;
  const Y = (y) => (CREST.top + geo.pad - y + (y < CREST.topSplit ? geo.topExtra : 0) + (y < CREST.bottomSplit ? geo.bottomExtra : 0)) * k;
  const path = (name, p = new Path2D()) => {
    for (const [op, ...v] of crestPath(name)) {
      if (op === 'M') p.moveTo(X(v[0]), Y(v[1]));
      else if (op === 'L') p.lineTo(X(v[0]), Y(v[1]));
      else if (op === 'C') p.bezierCurveTo(X(v[0]), Y(v[1]), X(v[2]), Y(v[3]), X(v[4]), Y(v[5]));
      else p.closePath();
    }
    return p;
  };
  const outer = path('outer');
  if (C.variant === 'solid') {
    c.fillStyle = C.fill; c.fill(outer);
    c.fillStyle = C.line; c.fill(path('shield'));
    c.fillStyle = C.panel; c.fill(path('panel'));
  } else {
    if (C.variant === 'overlay' && C.tintOpacity > 0) { c.fillStyle = rgba(C.tint, C.tintOpacity); c.fill(outer); }
    c.strokeStyle = C.line; c.lineWidth = C.stroke * k; c.lineJoin = 'round';
    c.stroke(outer);
    c.fillStyle = C.line; c.fill(path('panel', path('shield')), 'evenodd'); // the shield's frame as a ring
  }

  // text: top block centred in the panel, bottom block centred in the base
  const solid = C.variant === 'solid';
  const drawBlock = (lines, adv, midY, color) => {
    c.fillStyle = solid ? color : C.line;
    c.textBaseline = 'alphabetic';
    lines.forEach((ln, i) => {
      const base = midY + (i - (lines.length - 1) / 2) * adv; // y down, in pt
      const x0 = 540 - ln.w / 2;
      for (const r of ln.runs) {
        c.font = r.font.replace(/(\d+(\.\d+)?)px/, (_, px) => `${px * k}px`);
        if (!r.track) { c.fillText(r.text, X(x0 + r.x), base * k); continue; }
        let x = x0 + r.x;
        for (const ch of r.text) { c.fillText(ch, X(x), base * k); x += c.measureText(ch).width / k + r.track; }
      }
    });
  };
  const topMid = CREST.top + geo.pad - CREST.topMid + geo.topExtra / 2;
  const bottomMid = CREST.top + geo.pad - CREST.bottomMid + geo.topExtra + geo.bottomExtra / 2;
  drawBlock(geo.top, geo.tAdv, topMid, C.topColor);
  drawBlock(geo.bottom, geo.bAdv, bottomMid, C.bottomColor);

  crestCache.set(key, cv);
  if (crestCache.size > 8) crestCache.delete(crestCache.keys().next().value);
  return cv;
}

function drawCrest(ctx, s, t, W, H, ds) {
  const Lay = crestLayout(ctx, s, W, H);
  const tl = stillTimeline(s, t);
  if (tl.alpha <= 0.001) return Lay;
  const img = buildCrest(s, Lay.geo, Lay.u * ds);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = tl.alpha;
  blitStill(ctx, Lay, tl, ds, img);
  ctx.globalAlpha = 1;
  return Lay;
}
