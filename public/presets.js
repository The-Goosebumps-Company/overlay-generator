// Built-in templates: G&G brand looks first, then general-purpose styles.
// Shared presets saved by colleagues are loaded from the server on top of these.
export const BUILTIN_PRESETS = [
  {
    name: 'G&G · Pyro title', event: 'gg',
    width: 1920, height: 1080, fps: '25', duration: 5,
    anim: { in: true, out: true, inDur: 1.4, outDur: 0.9, inStyle: 'line', outStyle: 'line', textStyle: 'cascade' },
    layout: { anchor: 'center', offsetX: 0, offsetY: 0, scale: 1, safe: 5, autoFit: true },
    text: { content: 'Unforgettable\nGoosebumps.', uppercase: false, font: 'Bricolage Grotesque', weight: 800, size: 112, lineHeight: 0.96, tracking: -0.025, color: '#ffffff', align: 'center', revealTint: '#FB690C', shadow: 0 },
    card: { padX: 110, padY: 84, minWidth: 0, minHeight: 0, radius: 32, colors: ['#FB690C', '#790000'], angle: 135, opacity: 0.95, glow: 96, softness: 0.8, fill: '#071A26', fillOpacity: 0.2 },
    blobs: { enabled: true, colors: ['#FB690C', '#FFB36B'], count: 3, size: 0.38, speed: 0.9, intensity: 0.85 },
    badge: { enabled: false, text: '21:30', size: 64, weight: 800, padX: 40, padY: 16, radius: 14, gap: 30, colors: ['#FB690C', '#790000'], angle: 135, glow: 30, opacity: 1, scramble: true },
  },
  {
    name: 'G&G · Frequency lower third', event: 'gg',
    width: 1920, height: 1080, fps: '25', duration: 6,
    anim: { in: true, out: true, inDur: 1.2, outDur: 0.8, inStyle: 'line', outStyle: 'line', textStyle: 'words' },
    layout: { anchor: 'bottom-left', offsetX: 0, offsetY: -3, scale: 1, safe: 6, autoFit: true },
    text: { content: 'Speaker name\nRole, Company', uppercase: false, font: 'Bricolage Grotesque', weight: 700, size: 50, lineHeight: 1.12, tracking: -0.015, color: '#ffffff', align: 'left', revealTint: '#FB690C', shadow: 0 },
    card: { padX: 52, padY: 38, minWidth: 0, minHeight: 0, radius: 24, colors: ['#0B6F88', '#044E61', '#071A26'], angle: 135, opacity: 1, glow: 52, softness: 0.9, fill: '#071A26', fillOpacity: 0.45 },
    blobs: { enabled: true, colors: ['#FB690C'], count: 1, size: 0.55, speed: 0.8, intensity: 0.7 },
    badge: { enabled: false, text: '21:30', size: 60, weight: 800, padX: 36, padY: 14, radius: 12, gap: 28, colors: ['#FB690C', '#790000'], angle: 135, glow: 28, opacity: 1, scramble: true },
  },
  {
    name: 'G&G · Schedule with time', event: 'gg',
    width: 1920, height: 1080, fps: '25', duration: 5.5,
    anim: { in: true, out: true, inDur: 1.8, outDur: 0.9, inStyle: 'line', outStyle: 'line', textStyle: 'cascade' },
    layout: { anchor: 'center', offsetX: 0, offsetY: 0, scale: 1, safe: 5, autoFit: true },
    text: { content: 'Main stage\nSunset session\nft. Guest artist', uppercase: false, font: 'Bricolage Grotesque', weight: 800, size: 92, lineHeight: 1.0, tracking: -0.02, color: '#ffffff', align: 'center', revealTint: '#FB690C', shadow: 0 },
    card: { padX: 140, padY: 100, minWidth: 0, minHeight: 0, radius: 32, colors: ['#0B6F88', '#044E61', '#071A26'], angle: 135, opacity: 0.95, glow: 100, softness: 0.8, fill: '#071A26', fillOpacity: 0.25 },
    blobs: { enabled: true, colors: ['#0B6F88', '#FB690C'], count: 2, size: 0.3, speed: 0.8, intensity: 0.6 },
    badge: { enabled: true, text: '21:30', size: 100, weight: 800, padX: 80, padY: 26, radius: 18, gap: 44, colors: ['#FB690C', '#790000'], angle: 135, glow: 40, opacity: 1, scramble: true },
  },
  {
    name: 'Blue glass title (1080×1080)',
    width: 1080, height: 1080, fps: '29.97', duration: 3.5,
    anim: { in: true, out: true, inDur: 1.3, outDur: 0.8, inStyle: 'line', outStyle: 'line', textStyle: 'cascade' },
    layout: { anchor: 'center', offsetX: 0, offsetY: 0, scale: 1, safe: 5, autoFit: true },
    text: { content: 'Explore the\nPartner\nVillage', uppercase: true, font: 'Krona One', weight: 400, size: 48, lineHeight: 1.08, tracking: 0.04, color: '#f0f0f0', align: 'center', revealTint: '#d9cf9a', shadow: 0 },
    card: { padX: 44, padY: 92, minWidth: 0, minHeight: 0, radius: 22, colors: ['#2f95a6', '#3346a8', '#4d3f99'], angle: 25, opacity: 0.9, glow: 62, softness: 0.7, fill: '#0b0b22', fillOpacity: 0 },
    blobs: { enabled: true, colors: ['#3ab8ff', '#2a3cff', '#3f8cff'], count: 3, size: 0.42, speed: 1.2, intensity: 1 },
    badge: { enabled: false, text: '14:10', size: 60, weight: 700, padX: 36, padY: 14, radius: 12, gap: 28, colors: ['#5b45e6', '#c63fb6'], angle: 0, glow: 30, opacity: 1, scramble: true },
  },
  {
    name: 'Schedule – Purple with time (1920×1080)',
    width: 1920, height: 1080, fps: '25', duration: 5.5,
    anim: { in: true, out: true, inDur: 1.8, outDur: 0.9, inStyle: 'line', outStyle: 'line', textStyle: 'cascade' },
    layout: { anchor: 'center', offsetX: 0, offsetY: 0, scale: 1, safe: 5, autoFit: true },
    text: { content: 'Morning Plank\nChallenge\nft. Guest Coach', uppercase: true, font: 'Figtree', weight: 700, size: 96, lineHeight: 1.08, tracking: 0, color: '#ffffff', align: 'center', revealTint: '#d9cf9a', shadow: 0 },
    card: { padX: 150, padY: 105, minWidth: 0, minHeight: 0, radius: 30, colors: ['#4c3e94', '#6c408c', '#8c428e'], angle: 15, opacity: 0.85, glow: 84, softness: 0.7, fill: '#0b0b22', fillOpacity: 0 },
    blobs: { enabled: false, colors: ['#9a6bff', '#e05ad0'], count: 2, size: 0.3, speed: 1, intensity: 0.7 },
    badge: { enabled: true, text: '14:10', size: 104, weight: 700, padX: 84, padY: 30, radius: 14, gap: 44, colors: ['#5a3fe0', '#a03cc0', '#c63ab4'], angle: 0, glow: 36, opacity: 1, scramble: true },
  },
  {
    name: 'Lower third – left (1920×1080)',
    width: 1920, height: 1080, fps: '25', duration: 6,
    anim: { in: true, out: true, inDur: 1.2, outDur: 0.8, inStyle: 'line', outStyle: 'line', textStyle: 'cascade' },
    layout: { anchor: 'bottom-left', offsetX: 0, offsetY: -4, scale: 1, safe: 6, autoFit: true },
    text: { content: 'Speaker Name\nJob title, Company', uppercase: true, font: 'Figtree', weight: 700, size: 44, lineHeight: 1.25, tracking: 0.02, color: '#ffffff', align: 'left', revealTint: '#d9cf9a', shadow: 0 },
    card: { padX: 48, padY: 34, minWidth: 0, minHeight: 0, radius: 18, colors: ['#3fa8b5', '#3c52b8', '#5a4ba6'], angle: 20, opacity: 0.95, glow: 46, softness: 1, fill: '#0b0b22', fillOpacity: 0.25 },
    blobs: { enabled: true, colors: ['#3ab8ff', '#2a3cff'], count: 2, size: 0.45, speed: 1, intensity: 0.8 },
    badge: { enabled: false, text: '14:10', size: 60, weight: 700, padX: 36, padY: 14, radius: 12, gap: 28, colors: ['#5b45e6', '#c63fb6'], angle: 0, glow: 30, opacity: 1, scramble: true },
  },

  // ---------- event libraries (palettes in events.js) ----------
  ...eventTemplates(),
];

// Event templates are partial designs; the app fills in the rest from defaults.
function ev(event, name, o) {
  return {
    name, event, width: 1920, height: 1080, fps: '25', duration: 5.5,
    ...o,
    anim: { in: true, out: true, inDur: 1.4, outDur: 0.9, inStyle: 'line', outStyle: 'line', textStyle: 'cascade', ...o.anim },
    layout: { anchor: 'center', offsetX: 0, offsetY: 0, scale: 1, safe: 5, autoFit: true, ...o.layout },
    text: { uppercase: false, lineHeight: 1.05, tracking: 0, color: '#ffffff', align: 'center', shadow: 0, ...o.text },
    card: { minWidth: 0, minHeight: 0, angle: 135, opacity: 0.95, softness: 0.8, fillOpacity: 0.3, ...o.card },
    blobs: { enabled: true, count: 2, size: 0.38, speed: 0.9, intensity: 0.75, ...o.blobs },
    badge: { enabled: false, text: '21:30', size: 96, weight: 800, padX: 76, padY: 24, radius: 16, gap: 40, angle: 135, glow: 36, opacity: 1, scramble: true, ...o.badge },
  };
}

function eventTemplates() {
  const lowerThird = { layout: { anchor: 'bottom-left', offsetY: -3, safe: 6 }, anim: { inDur: 1.2, outDur: 0.8, textStyle: 'words' }, duration: 6 };
  // Big Week: chrome gold on a dusk sky, tall condensed type
  const bw = { font: 'Bebas Neue', weight: 400, color: '#FFF6E6', revealTint: '#E9B44C' };
  const bwCard = { colors: ['#F5D58A', '#E9B44C', '#B5651D'], fill: '#1A1020', fillOpacity: 0.4 };
  // Rage: loud, bubbly, pink and purple
  const rg = { font: 'Luckiest Guy', weight: 400, uppercase: true, color: '#ffffff', revealTint: '#FF2E88', tracking: 0.03 };
  const rgCard = { colors: ['#FF2E88', '#C2187A', '#6A3CB5'], fill: '#2A0E3A', fillOpacity: 0.35 };
  // LMC: Josefin capitals, big-top gold, orange and red
  const lmc = { font: 'Josefin Sans', weight: 700, uppercase: true, color: '#F1EAB5', revealTint: '#EB7602', tracking: 0.06 };
  const lmcCard = { colors: ['#EBCC2A', '#EB7602', '#E00700'], fill: '#2A0605', fillOpacity: 0.35 };
  // Shimza & Friends: heavy geometric capitals, navy with amber and flame
  const sf = { font: 'Montserrat', weight: 800, uppercase: true, color: '#ffffff', revealTint: '#FDB75B', tracking: 0.02 };
  const sfCard = { colors: ['#FDB75B', '#F07C2F', '#D9432B'], fill: '#071C2C', fillOpacity: 0.5 };

  return [
    ev('big-week', 'Big Week · Title', {
      text: { ...bw, content: 'Big Week\nHomecoming', uppercase: true, size: 168, lineHeight: 0.9, tracking: 0.04 },
      card: { ...bwCard, padX: 130, padY: 80, radius: 30, glow: 100 },
      blobs: { colors: ['#F5D58A', '#E9B44C'] },
    }),
    ev('big-week', 'Big Week · Artist lower third', {
      ...lowerThird,
      text: { ...bw, content: 'Artist name\nMain stage · 27 Dec', size: 76, lineHeight: 1, tracking: 0.03, align: 'left' },
      card: { colors: ['#E9B44C', '#B5651D', '#3A2340'], fill: '#1A1020', fillOpacity: 0.5, padX: 56, padY: 36, radius: 22, glow: 54 },
      blobs: { colors: ['#F5D58A'], count: 1, size: 0.55 },
    }),
    ev('big-week', 'Big Week · Set time', {
      text: { ...bw, content: 'Artist name\nMain stage', uppercase: true, size: 120, lineHeight: 0.95, tracking: 0.04 },
      card: { ...bwCard, colors: ['#E9B44C', '#B5651D', '#3A2340'], padX: 140, padY: 96, radius: 30, glow: 96 },
      blobs: { colors: ['#F5D58A', '#D9764A'] },
      badge: { enabled: true, text: '21:30', colors: ['#F5D58A', '#E9B44C', '#B5651D'], weight: 400 },
    }),

    ev('rage', 'Rage · Countdown', {
      text: { ...rg, content: 'Days to go', size: 96 },
      card: { ...rgCard, padX: 130, padY: 90, radius: 40, glow: 100 },
      blobs: { colors: ['#FF2E88', '#7FD3FF', '#FFD60A'], count: 3 },
      badge: { enabled: true, text: '30', size: 170, padX: 70, padY: 16, radius: 28, colors: ['#FFE45C', '#FFB000'], weight: 400 },
      anim: { inStyle: 'pop', outStyle: 'pop' },
    }),
    ev('rage', 'Rage · Hype title', {
      text: { ...rg, content: 'Passports are\nmoving fast', size: 124, lineHeight: 1 },
      card: { ...rgCard, padX: 120, padY: 90, radius: 40, glow: 100 },
      blobs: { colors: ['#FF2E88', '#FF8AC4'] },
      anim: { inStyle: 'pop', outStyle: 'pop', textStyle: 'words' },
    }),
    ev('rage', 'Rage · Lower third', {
      ...lowerThird,
      text: { ...rg, content: 'Artist name\nMain stage', size: 64, lineHeight: 1.05, align: 'left' },
      card: { ...rgCard, colors: ['#9B6BE0', '#6A3CB5'], padX: 54, padY: 38, radius: 30, glow: 56 },
      blobs: { colors: ['#7ED957', '#FFD60A'], count: 1, size: 0.5 },
    }),

    ev('lmc', 'LMC · Countdown', {
      text: { ...lmc, content: '3 months\nto go', size: 132, lineHeight: 1 },
      card: { ...lmcCard, padX: 130, padY: 92, radius: 26, glow: 100 },
      blobs: { colors: ['#EBCC2A', '#EB7602'] },
    }),
    ev('lmc', 'LMC · Act lower third', {
      ...lowerThird,
      text: { ...lmc, content: 'Act name\nThe Big Top · 20:00', size: 58, lineHeight: 1.12, align: 'left' },
      card: { colors: ['#204CA5', '#970201'], fill: '#0B1530', fillOpacity: 0.5, padX: 56, padY: 38, radius: 20, glow: 54 },
      blobs: { colors: ['#FF7ABC'], count: 1, size: 0.5 },
    }),
    ev('lmc', 'LMC · Show time', {
      text: { ...lmc, content: 'Main show\nThe Big Top', size: 104, lineHeight: 1.02 },
      card: { ...lmcCard, colors: ['#204CA5', '#970201'], fill: '#0B1530', padX: 140, padY: 96, radius: 26, glow: 96 },
      blobs: { colors: ['#EBCC2A', '#FF7ABC'] },
      badge: { enabled: true, text: '20:00', colors: ['#EBCC2A', '#EB7602', '#E00700'], weight: 700 },
    }),

    ev('shimza-friends', 'S&F · Title', {
      text: { ...sf, content: 'Shimza\n& Friends', size: 150, lineHeight: 0.95, tracking: 0 },
      card: { ...sfCard, padX: 130, padY: 88, radius: 30, glow: 100 },
      blobs: { colors: ['#FDB75B', '#F07C2F'] },
    }),
    ev('shimza-friends', 'S&F · Artist lower third', {
      ...lowerThird,
      text: { ...sf, content: 'Artist name\nMain room', size: 58, lineHeight: 1.1, align: 'left' },
      card: { colors: ['#1D4E70', '#0B2A40', '#071C2C'], fill: '#071C2C', fillOpacity: 0.55, padX: 54, padY: 38, radius: 22, glow: 54 },
      blobs: { colors: ['#FDB75B'], count: 1, size: 0.55 },
    }),
    ev('shimza-friends', 'S&F · Set time', {
      text: { ...sf, content: 'Artist name\nMain room', size: 108, lineHeight: 1 },
      card: { ...sfCard, colors: ['#1D4E70', '#0B2A40', '#071C2C'], padX: 140, padY: 96, radius: 30, glow: 96 },
      blobs: { colors: ['#D9432B', '#FDB75B'] },
      badge: { enabled: true, text: '23:00', colors: ['#FDB75B', '#F07C2F', '#D9432B'] },
    }),
  ];
}
