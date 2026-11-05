// Builds the shareable versions of Overlay Generator into ./dist
//
//   dist/web/                         static website / PWA: upload to any free static host
//   dist/Overlay Generator (Mac).zip  send to colleagues; installs a local app, no signing needed
//
// Team presets (presets/*.json) and brand fonts (fonts/*) are bundled into both.
// Run:  npm run build
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
const VERSION = `${pkg.version}-${stamp}`;
const FONT_RE = /\.(ttf|otf|woff2?)$/i;

const copy = (src, dst) => fsp.cp(src, dst, { recursive: true, filter: (s) => !path.basename(s).startsWith('.') });

await fsp.rm(DIST, { recursive: true, force: true });

// ---------- 1. static web app (PWA) ----------
const WEB = path.join(DIST, 'web');
await copy(path.join(ROOT, 'public'), WEB);
const swPath = path.join(WEB, 'sw.js');
fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8').replace("const VERSION = 'dev';", `const VERSION = '${VERSION}';`));

const presets = fs.existsSync(path.join(ROOT, 'presets'))
  ? fs.readdirSync(path.join(ROOT, 'presets')).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'presets', f), 'utf8')))
  : [];
const fonts = fs.existsSync(path.join(ROOT, 'fonts')) ? fs.readdirSync(path.join(ROOT, 'fonts')).filter((f) => FONT_RE.test(f)) : [];
await fsp.mkdir(path.join(WEB, 'shared', 'fonts'), { recursive: true });
for (const f of fonts) await fsp.copyFile(path.join(ROOT, 'fonts', f), path.join(WEB, 'shared', 'fonts', f));
fs.writeFileSync(path.join(WEB, 'shared', 'library.json'), JSON.stringify({
  version: VERSION,
  presets,
  fonts: fonts.map((file) => ({ file, family: file.replace(FONT_RE, '').replace(/[-_]+/g, ' ').trim() })),
}, null, 2));
// Netlify / Cloudflare Pages: correct type for the encoder + no stale service worker
fs.writeFileSync(path.join(WEB, '_headers'), `/sw.js\n  Cache-Control: no-cache\n/*.wasm\n  Content-Type: application/wasm\n`);

if (process.argv.includes('--web-only')) {
  console.log(`\nBuilt web app ${VERSION} (presets: ${presets.length}, fonts: ${fonts.length}) -> dist/web`);
  process.exit(0);
}

// ---------- 2. Mac package (uses macOS 'ditto' for the zip) ----------
const PKG = path.join(DIST, 'Overlay Generator');
const APP = path.join(PKG, 'app');
await fsp.mkdir(APP, { recursive: true });
await copy(WEB, path.join(APP, 'public'));
await fsp.copyFile(path.join(ROOT, 'server.js'), path.join(APP, 'server.js'));
await fsp.copyFile(path.join(ROOT, 'package.json'), path.join(APP, 'package.json'));
await fsp.mkdir(path.join(APP, 'presets'), { recursive: true });
await fsp.mkdir(path.join(APP, 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(ROOT, 'presets')).filter((x) => x.endsWith('.json'))) await fsp.copyFile(path.join(ROOT, 'presets', f), path.join(APP, 'presets', f));
for (const f of fonts) await fsp.copyFile(path.join(ROOT, 'fonts', f), path.join(APP, 'fonts', f));
for (const f of ['install.sh', 'uninstall.sh', 'HOW TO INSTALL.txt', 'AppIcon.icns']) await fsp.copyFile(path.join(ROOT, 'launcher', f), path.join(PKG, f));
fs.chmodSync(path.join(PKG, 'install.sh'), 0o755);
fs.chmodSync(path.join(PKG, 'uninstall.sh'), 0o755);
fs.writeFileSync(path.join(PKG, 'VERSION.txt'), `${VERSION}\n`);

const zip = path.join(DIST, 'Overlay Generator (Mac).zip');
execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', PKG, zip]);

const mb = (p) => (fs.statSync(p).size / 1e6).toFixed(1);
console.log(`\nBuilt Overlay Generator ${VERSION}`);
console.log(`  Team presets: ${presets.length}, brand fonts: ${fonts.length}`);
console.log(`  dist/web/                          upload to a static host (PWA)`);
console.log(`  dist/Overlay Generator (Mac).zip   ${mb(zip)} MB, send to colleagues\n`);
