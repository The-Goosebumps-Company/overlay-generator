// Social-platform safe zones, drawn as a skeleton of each app's UI over the
// preview. Preview only: nothing here is ever rendered into an export.
//
// Numbers are on a 1080-wide reference (1080×1920 for vertical video) and scale
// with the frame's short side. They follow Meta's published Reels/Stories guide
// (14% top, 35% bottom, 6% sides for Reels; 14% / 20% for Stories) and the
// commonly measured app layouts for TikTok, YouTube Shorts and LinkedIn
// (late 2025 / 2026). Apps change their UI; treat these as a guide, not a law.

export const SAFE_ZONES = [
  { id: 'ig-reels', group: 'portrait', label: 'Instagram Reels', name: 'Instagram',
    safe: { t: 269, b: 672, l: 65, r: 120 }, ui: igReels },
  { id: 'tiktok', group: 'portrait', label: 'TikTok', name: 'TikTok',
    safe: { t: 160, b: 480, l: 60, r: 150 }, ui: tiktok },
  { id: 'yt-shorts', group: 'portrait', label: 'YouTube Shorts', name: 'YouTube',
    safe: { t: 150, b: 480, l: 48, r: 192 }, ui: ytShorts },
  { id: 'ig-stories', group: 'portrait', label: 'Instagram & Facebook Stories', name: 'Stories',
    safe: { t: 269, b: 384, l: 65, r: 65 }, ui: igStories },
  { id: 'fb-reels', group: 'portrait', label: 'Facebook Reels', name: 'Facebook',
    safe: { t: 269, b: 672, l: 65, r: 120 }, ui: fbReels },
  { id: 'li-video', group: 'portrait', label: 'LinkedIn video', name: 'LinkedIn',
    safe: { t: 150, b: 420, l: 60, r: 160 }, ui: liVertical },
  { id: 'yt', group: 'landscape', label: 'YouTube player', name: 'YouTube',
    safe: { t: 130, b: 170, l: 60, r: 60 }, ui: ytPlayer },
  { id: 'li-feed', group: 'landscape square', label: 'LinkedIn feed', name: 'LinkedIn',
    safe: { t: 40, b: 110, l: 40, r: 40 }, ui: liFeed },
  { id: 'ig-feed', group: 'square', label: 'Instagram feed', name: 'Instagram',
    safe: igFeedSafe, ui: igFeed },
  { id: 'title', group: 'portrait landscape square', label: 'TV title safe (90%)', name: 'title safe',
    safe: (W, H) => ({ t: H * 0.05, b: H * 0.05, l: W * 0.05, r: W * 0.05 }), ui: titleSafe, px: true },
];

// Which list of platforms fits this frame shape
export function shapeGroup(W, H) {
  const ar = W / H;
  return ar < 0.7 ? 'portrait' : ar > 1.25 ? 'landscape' : 'square';
}
export const zonesFor = (W, H) => SAFE_ZONES.filter((z) => z.group.split(' ').includes(shapeGroup(W, H)));

// Safe rectangle in output pixels
export function safeRect(zone, W, H) {
  const k = Math.min(W, H) / 1080;
  const s = typeof zone.safe === 'function' ? zone.safe(W, H, k) : zone.safe;
  const m = zone.px || typeof zone.safe === 'function' ? 1 : k;
  const t = s.t * m, b = s.b * m, l = s.l * m, r = s.r * m;
  return { x: l, y: t, w: W - l - r, h: H - t - b, t, b, l, r };
}

// What part of the app UI a box runs into (empty array = all clear)
const SIDE_WORDS = {
  default: { t: 'the top bar', b: 'the caption area', l: 'the left edge', r: 'the like and share buttons' },
  'ig-stories': { t: 'the profile and progress bar', b: 'the reply bar', l: 'the left edge', r: 'the right edge' },
  yt: { t: 'the title bar', b: 'the player controls', l: 'the left edge', r: 'the right edge' },
  'li-feed': { t: 'the top edge', b: 'the player controls', l: 'the left edge', r: 'the right edge' },
  'ig-feed': { t: 'the top edge', b: 'the tag and sound buttons', l: 'the profile grid crop', r: 'the profile grid crop' },
  title: { t: 'the top of the screen', b: 'the bottom of the screen', l: 'the left edge', r: 'the right edge' },
};
export function conflicts(zone, box, W, H) {
  const s = safeRect(zone, W, H);
  const words = SIDE_WORDS[zone.id] || SIDE_WORDS.default;
  const out = [];
  if (box.y < s.y - 0.5) out.push(words.t);
  if (box.y + box.h > s.y + s.h + 0.5) out.push(words.b);
  if (box.x < s.x - 0.5) out.push(words.l);
  if (box.x + box.w > s.x + s.w + 0.5) out.push(words.r);
  return [...new Set(out)];
}

// ---------- SVG ----------
export function zoneSVG(zone, W, H, box, ok) {
  const k = Math.min(W, H) / 1080;
  const s = safeRect(zone, W, H);
  const g = new Draw(W, H, k);
  zone.ui(g, W, H, k);
  const dash = `${8 * k} ${6 * k}`;
  const sw = 2 * k;
  // Shade everything outside the safe area, then outline it
  const shade = `<path class="sz-shade" fill-rule="evenodd" d="M0 0H${W}V${H}H0Z M${s.x} ${s.y}v${s.h}h${s.w}v${-s.h}Z"/>`;
  const outline = `<rect class="sz-safe" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${10 * k}" stroke-width="${sw}" stroke-dasharray="${dash}"/>`;
  const card = box ? `<rect class="sz-card ${ok ? 'ok' : 'bad'}" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="${8 * k}" stroke-width="${sw * 1.25}" stroke-dasharray="${dash}"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    ${shade}<g class="sz-ui">${g.out}</g>${outline}${card}</svg>`;
}

// Tiny drawing helper; coordinates are reference px (× k), y/x can be measured
// from the bottom/right with B()/R().
class Draw {
  constructor(W, H, k) { this.W = W; this.H = H; this.k = k; this.out = ''; }
  B(y) { return this.H - y * this.k; }
  R(x) { return this.W - x * this.k; }
  pill(x, y, w, h, r = h / 2) { const k = this.k; this.out += `<rect x="${x}" y="${y}" width="${w * k}" height="${h * k}" rx="${r * k}"/>`; }
  dot(cx, cy, r) { this.out += `<circle cx="${cx}" cy="${cy}" r="${r * this.k}"/>`; }
  ring(cx, cy, r) { this.out += `<circle class="line" cx="${cx}" cy="${cy}" r="${r * this.k}" stroke-width="${3 * this.k}"/>`; }
  bar(y, h) { this.out += `<rect class="bar" x="0" y="${y}" width="${this.W}" height="${h * this.k}"/>`; }
  // a column of action icons with a small count under each
  column(cx, ys, r = 32, counts = true) {
    for (const y of ys) { this.dot(cx, y, r); if (counts) this.pill(cx - 24 * this.k, y + (r + 12) * this.k, 48, 16); }
  }
  nav(h = 150, n = 5) {
    const { k, W } = this;
    this.bar(this.B(h), h);
    for (let i = 0; i < n; i++) this.pill((W / n) * (i + 0.5) - 26 * k, this.B(h / 2 + 26), 52, 52, 14);
  }
  lines(x, yBottom, widths, h = 28, gap = 46) {
    widths.forEach((w, i) => this.pill(x, this.B(yBottom - i * gap), w, h, 10));
  }
}

function igReels(g, W, H, k) {
  g.pill(45 * k, 78 * k, 150, 46, 14); g.dot(g.R(70), 101 * k, 24);
  g.column(g.R(70), [g.B(880), g.B(730), g.B(580)]);
  g.dot(g.R(70), g.B(440), 10); g.pill(g.R(105), g.B(330), 70, 70, 14);
  g.dot(80 * k, g.B(420), 32); g.pill(128 * k, g.B(436), 220, 32, 10); g.pill(368 * k, g.B(442), 120, 44, 12);
  g.lines(45 * k, 350, [680, 480]);
  g.pill(45 * k, g.B(232), 340, 28, 10);
  g.nav(150);
}
function fbReels(g, W, H, k) {
  g.pill(45 * k, 78 * k, 140, 46, 14); g.dot(g.R(150), 101 * k, 24); g.dot(g.R(70), 101 * k, 24);
  g.column(g.R(70), [g.B(840), g.B(690), g.B(540)]); g.dot(g.R(70), g.B(400), 10);
  g.dot(80 * k, g.B(480), 32); g.pill(128 * k, g.B(496), 220, 32, 10); g.pill(368 * k, g.B(502), 120, 44, 12);
  g.lines(45 * k, 410, [700, 520]);
  g.pill(45 * k, g.B(296), 320, 28, 10);
  g.pill(30 * k, g.B(170), (W / k) - 60, 96, 48);
}
function igStories(g, W, H, k) {
  const n = 4, gap = 8, x0 = 20, w = ((W / k) - x0 * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) g.pill((x0 + i * (w + gap)) * k, 28 * k, w, 6, 3);
  g.dot(72 * k, 98 * k, 34); g.pill(120 * k, 84 * k, 200, 30, 10); g.pill(332 * k, 88 * k, 60, 22, 8);
  g.dot(g.R(130), 98 * k, 10); g.dot(g.R(60), 98 * k, 22);
  g.pill(30 * k, g.B(150), (W / k) - 260, 100, 50);
  g.dot(g.R(165), g.B(100), 30); g.dot(g.R(70), g.B(100), 30);
}
function tiktok(g, W, H, k) {
  g.pill(36 * k, 74 * k, 90, 40, 12);
  g.pill(W / 2 - 230 * k, 74 * k, 200, 40, 12); g.pill(W / 2 + 30 * k, 74 * k, 200, 40, 12);
  g.dot(g.R(70), 94 * k, 26);
  g.dot(g.R(72), g.B(940), 46); g.dot(g.R(72), g.B(885), 14);
  g.column(g.R(72), [g.B(790), g.B(650), g.B(510), g.B(370)], 34);
  g.dot(g.R(72), g.B(220), 38);
  g.pill(40 * k, g.B(410), 260, 36, 10);
  g.lines(40 * k, 350, [720, 560]);
  g.pill(40 * k, g.B(246), 400, 28, 10);
  g.nav(150);
}
function ytShorts(g, W, H, k) {
  g.dot(g.R(220), 94 * k, 26); g.dot(g.R(140), 94 * k, 26); g.dot(g.R(64), 94 * k, 10);
  g.column(g.R(90), [g.B(940), g.B(800), g.B(660), g.B(520)], 38);
  g.dot(g.R(90), g.B(390), 38); g.pill(g.R(126), g.B(270), 72, 72, 16);
  g.dot(72 * k, g.B(400), 30); g.pill(118 * k, g.B(414), 220, 30, 10); g.pill(356 * k, g.B(424), 170, 50, 25);
  g.lines(40 * k, 330, [700, 470]);
  g.pill(40 * k, g.B(225), 360, 26, 10);
  g.nav(140);
}
function liVertical(g, W, H, k) {
  g.dot(60 * k, 96 * k, 26); g.dot(g.R(140), 96 * k, 26); g.dot(g.R(60), 96 * k, 26);
  g.column(g.R(72), [g.B(800), g.B(660), g.B(520), g.B(380)], 34);
  g.dot(78 * k, g.B(350), 34); g.pill(126 * k, g.B(368), 240, 32, 10); g.pill(386 * k, g.B(372), 120, 42, 21);
  g.lines(40 * k, 280, [680, 460]);
  g.pill(40 * k, g.B(150), (W / k) - 80, 8, 4);
}
function ytPlayer(g, W, H, k) {
  g.bar(0, 120); g.dot(72 * k, 60 * k, 32); g.pill(122 * k, 42 * k, 760, 36, 10); g.dot(g.R(70), 60 * k, 22);
  g.bar(g.B(160), 160);
  g.pill(40 * k, g.B(132), (W / k) - 80, 8, 4); g.dot(40 * k + 60 * k, g.B(128), 12);
  g.dot(76 * k, g.B(62), 24); g.dot(146 * k, g.B(62), 20); g.dot(214 * k, g.B(62), 20); g.pill(250 * k, g.B(74), 200, 24, 10);
  for (const x of [330, 260, 190, 120, 50]) g.pill(g.R(x + 40), g.B(82), 40, 40, 10);
}
function liFeed(g, W, H, k) {
  g.bar(g.B(90), 90);
  g.pill(40 * k, g.B(56), 28, 28, 6); g.pill(90 * k, g.B(50), (W / k) - 300, 8, 4);
  g.pill(g.R(160), g.B(60), 36, 36, 10); g.pill(g.R(90), g.B(60), 36, 36, 10);
}
function igFeedSafe(W, H) {
  // Profile grid shows posts at 3:4, cropping the sides; tag and sound buttons sit bottom corners
  const crop = Math.max(0, (W - H * 3 / 4) / 2);
  const k = Math.min(W, H) / 1080;
  return { t: 30 * k, b: 110 * k, l: crop + 30 * k, r: crop + 30 * k };
}
function igFeed(g, W, H, k) {
  const crop = Math.max(0, (W - H * 3 / 4) / 2);
  if (crop > 1) g.out += `<rect class="bar" x="0" y="0" width="${crop}" height="${H}"/><rect class="bar" x="${W - crop}" y="0" width="${crop}" height="${H}"/>`;
  g.dot(crop + 60 * k, g.B(60), 26); g.dot(W - crop - 60 * k, g.B(60), 26);
}
function titleSafe(g, W, H, k) {
  const ax = W * 0.035, ay = H * 0.035;
  g.out += `<rect class="line" x="${ax}" y="${ay}" width="${W - ax * 2}" height="${H - ay * 2}" stroke-width="${1.5 * k}" stroke-dasharray="${3 * k} ${5 * k}"/>`;
  g.out += `<path class="line" stroke-width="${1.5 * k}" d="M${W / 2 - 30 * k} ${H / 2}h${60 * k}M${W / 2} ${H / 2 - 30 * k}v${60 * k}"/>`;
}
