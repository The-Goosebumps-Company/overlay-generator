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

  return { u, lines: lineData, lh, capH, track, textW, textH, contentH, badge, card: { x, y, w: cw, h: ch } };
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
