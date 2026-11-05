// Built-in starting points, modelled on the design team's overlay style.
// Shared presets saved by colleagues are loaded from the server on top of these.
export const BUILTIN_PRESETS = [
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
];
