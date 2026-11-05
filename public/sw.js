// Service worker: makes the installed app work offline.
// VERSION is replaced by the build script so every release refreshes the cache.
const VERSION = 'dev';
const SHELL = `og-shell-${VERSION}`;
const RUNTIME = 'og-runtime'; // fonts + the 32 MB encoder; survives app updates

const SHELL_FILES = [
  './', 'index.html', 'style.css', 'app.js', 'renderer.js', 'zip.js', 'presets.js', 'log.js', 'encode-wasm.js', 'fonts-store.js',
  'manifest.webmanifest', 'brand/gg-icon-white.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png',
  'vendor/ffmpeg/index.js', 'vendor/ffmpeg/classes.js', 'vendor/ffmpeg/worker.js', 'vendor/ffmpeg/const.js',
  'vendor/ffmpeg/errors.js', 'vendor/ffmpeg/utils.js', 'vendor/ffmpeg/types.js', 'vendor/ffmpeg/ffmpeg-core.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL)
    .then((c) => c.addAll(SHELL_FILES.map((f) => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('og-shell-') && k !== SHELL) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Google Fonts: cache-first so fonts keep working offline
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(cacheFirst(req, RUNTIME));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes('/api/')) return; // live server calls are never cached

  // The big encoder: cache-first (downloaded once)
  if (url.pathname.endsWith('.wasm') || url.pathname.includes('/fonts/') || url.pathname.includes('/shared/')) {
    e.respondWith(cacheFirst(req, RUNTIME));
    return;
  }
  // App files: network-first so updates show up, cache when offline
  e.respondWith(networkFirst(req));
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    // 'no-cache' = always check with the server (ETag), so a new page never gets old scripts
    const res = await fetch(req, { cache: 'no-cache' });
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' && (await cache.match('index.html')));
    if (hit) return hit;
    throw new Error('offline');
  }
}
