// Overlay Generator: office server (no npm dependencies).
// Serves the web app, stores shared presets and brand fonts, and turns rendered
// PNG frames into ProRes 4444 / QuickTime Animation .mov files with alpha using ffmpeg.
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PRESETS = path.join(ROOT, 'presets');
const FONTS = path.join(ROOT, 'fonts');
const TMP = path.join(os.tmpdir(), 'overlay-generator');
const PORT = +process.env.PORT || 4321;
// OG_LOCAL=1: personal install (only this computer can connect). OG_IDLE_MINUTES: quit when unused.
const LOCAL = process.env.OG_LOCAL === '1';
const HOST = process.env.HOST || (LOCAL ? '127.0.0.1' : '0.0.0.0');
const IDLE_MIN = +process.env.OG_IDLE_MINUTES || 0;
let lastRequest = Date.now();
const FFMPEG = [process.env.FFMPEG, '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', 'ffmpeg'].filter(Boolean).find((p) => spawnSync(p, ['-version']).status === 0);
const RATES = { '23.976': '24000/1001', '24': '24', '25': '25', '29.97': '30000/1001', '30': '30', '50': '50', '59.94': '60000/1001', '60': '60' };

for (const d of [PRESETS, FONTS, TMP]) fs.mkdirSync(d, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.mjs': 'text/javascript', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
const jobs = new Map();

// ---- logging: console + logs/app.log (one line per event) ----
const LOGS = process.env.OG_LOG_DIR || path.join(ROOT, 'logs');
fs.mkdirSync(LOGS, { recursive: true });
const logFile = fs.createWriteStream(path.join(LOGS, 'app.log'), { flags: 'a' });
const ts = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().replace('T', ' ').slice(0, 19); }; // local time
function log(level, who, event, data) {
  const extra = data && Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
  const line = `${ts()} ${level.toUpperCase().padEnd(5)} [${who}] ${event}${extra}`;
  (level === 'error' ? console.error : console.log)(line);
  logFile.write(line + '\n');
}
const clientIp = (req) => (req.socket.remoteAddress || '').replace('::ffff:', '').replace('::1', 'localhost');

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
};
const readBody = (req, limit = 200 * 1024 * 1024) => new Promise((resolve, reject) => {
  const chunks = []; let size = 0;
  req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});
const safeName = (s) => String(s || '').replace(/[^\w\-. ]+/g, '').trim().slice(0, 80);

async function serveFile(res, base, rel) {
  const p = path.normalize(path.join(base, rel));
  if (!p.startsWith(base)) return send(res, 403, 'forbidden', 'text/plain');
  try {
    const data = await fsp.readFile(p);
    send(res, 200, data, MIME[path.extname(p).toLowerCase()] || 'application/octet-stream');
  } catch { send(res, 404, 'not found', 'text/plain'); }
}

function cleanupOldJobs() {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, j] of jobs) if (j.created < cutoff) { fs.rmSync(j.dir, { recursive: true, force: true }); jobs.delete(id); }
}

const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  lastRequest = t0;
  const ip = clientIp(req);
  res.on('finish', () => {
    const u = req.url.split('?')[0];
    const noisy = u === '/api/log' || u === '/api/status' || /^\/api\/render\/[\w-]+\/\d+$/.test(u);
    if (res.statusCode >= 400) log(res.statusCode >= 500 ? 'error' : 'warn', ip, `http ${req.method} ${req.url} -> ${res.statusCode}`, { ms: Date.now() - t0 });
    else if (!noisy && (u.startsWith('/api/') || u === '/')) log('info', ip, `http ${req.method} ${u} -> ${res.statusCode}`, { ms: Date.now() - t0 });
  });
  try {
    const url = new URL(req.url, 'http://x');
    const p = decodeURIComponent(url.pathname);

    if (p === '/api/status') return send(res, 200, { ok: true, ffmpeg: !!FFMPEG, local: LOCAL });

    // ---- browser logs ----
    if (p === '/api/log' && req.method === 'POST') {
      let entries = [];
      try { entries = JSON.parse((await readBody(req, 1e6)).toString()); } catch {}
      for (const e of Array.isArray(entries) ? entries.slice(0, 300) : []) {
        log(['info', 'warn', 'error'].includes(e.level) ? e.level : 'info', `${ip} ${String(e.sid || '').slice(0, 8)}`, `browser:${String(e.event).slice(0, 60)}`, e.data);
      }
      return send(res, 200, { ok: true });
    }

    // ---- shared presets ----
    if (p === '/api/presets' && req.method === 'GET') {
      const files = (await fsp.readdir(PRESETS)).filter((f) => f.endsWith('.json')).sort();
      const list = [];
      for (const f of files) { try { list.push(JSON.parse(await fsp.readFile(path.join(PRESETS, f), 'utf8'))); } catch {} }
      return send(res, 200, list);
    }
    if (p === '/api/presets' && req.method === 'POST') {
      const data = JSON.parse((await readBody(req, 2e6)).toString());
      const name = safeName(data.name);
      if (!name) return send(res, 400, { error: 'name required' });
      await fsp.writeFile(path.join(PRESETS, `${name}.json`), JSON.stringify(data, null, 2));
      return send(res, 200, { ok: true });
    }
    if (p === '/api/presets' && req.method === 'DELETE') {
      const name = safeName(url.searchParams.get('name'));
      await fsp.rm(path.join(PRESETS, `${name}.json`), { force: true });
      return send(res, 200, { ok: true });
    }

    // ---- shared brand fonts ----
    if (p === '/api/fonts' && req.method === 'GET') {
      const files = (await fsp.readdir(FONTS)).filter((f) => /\.(ttf|otf|woff2?)$/i.test(f));
      return send(res, 200, files.map((file) => ({ file, family: file.replace(/\.(ttf|otf|woff2?)$/i, '').replace(/[-_]+/g, ' ').trim() })));
    }
    if (p === '/api/fonts' && req.method === 'POST') {
      const file = safeName(url.searchParams.get('file'));
      if (!/\.(ttf|otf|woff2?)$/i.test(file)) return send(res, 400, { error: 'font file expected' });
      await fsp.writeFile(path.join(FONTS, file), await readBody(req, 30e6));
      return send(res, 200, { ok: true });
    }
    if (p.startsWith('/fonts/')) return serveFile(res, FONTS, p.slice(7));

    // ---- rendering ----
    if (p === '/api/render' && req.method === 'POST') {
      if (!FFMPEG) return send(res, 503, { error: 'ffmpeg is not installed on the server' });
      cleanupOldJobs();
      const o = JSON.parse((await readBody(req, 1e5)).toString());
      const okSize = (v) => Number.isInteger(v) && v >= 16 && v <= 8192;
      if (!RATES[o.fps] || !['prores', 'qtrle'].includes(o.format) || !okSize(o.width) || !okSize(o.height)) return send(res, 400, { error: 'bad options' });
      const id = crypto.randomUUID();
      const dir = path.join(TMP, id);
      await fsp.mkdir(dir, { recursive: true });
      jobs.set(id, { dir, ...o, created: Date.now() });
      log('info', ip, 'render.job', { id: id.slice(0, 8), name: o.name, format: o.format, size: `${o.width}x${o.height}`, fps: o.fps, frames: o.frames });
      return send(res, 200, { id });
    }
    let m = p.match(/^\/api\/render\/([\w-]+)\/(\d+)$/);
    if (m && req.method === 'PUT') {
      const job = jobs.get(m[1]);
      if (!job) return send(res, 404, { error: 'unknown job (the server may have restarted during the export, please export again)' });
      // body = gzip-compressed raw RGBA (straight alpha), width*height*4 bytes once inflated
      await fsp.writeFile(path.join(job.dir, `f_${String(+m[2]).padStart(6, '0')}.gz`), await readBody(req, 150e6));
      return send(res, 200, { ok: true });
    }
    m = p.match(/^\/api\/render\/([\w-]+)\/finish$/);
    if (m && req.method === 'POST') {
      const job = jobs.get(m[1]);
      if (!job) return send(res, 404, { error: 'unknown job (the server may have restarted during the export, please export again)' });
      const out = path.join(job.dir, 'out.mov');
      const codec = job.format === 'prores'
        ? ['-c:v', 'prores_ks', '-profile:v', '4444', '-pix_fmt', 'yuva444p10le', '-alpha_bits', '16', '-vendor', 'apl0']
        : ['-c:v', 'qtrle', '-pix_fmt', 'argb'];
      const frames = (await fsp.readdir(job.dir)).filter((f) => f.endsWith('.gz')).sort();
      const W = +job.width, H = +job.height, frameBytes = W * H * 4;
      const args = ['-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-framerate', RATES[job.fps], '-i', 'pipe:0',
        ...codec, '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out];
      const t0 = Date.now();
      const err = await new Promise((resolve) => {
        const ff = spawn(FFMPEG, args);
        let e = '';
        ff.stderr.on('data', (d) => { e += d; });
        ff.on('close', (code) => resolve(code === 0 ? null : e || `ffmpeg exited ${code}`));
        ff.stdin.on('error', () => {});
        (async () => {
          for (const f of frames) {
            const raw = zlib.gunzipSync(await fsp.readFile(path.join(job.dir, f)));
            if (raw.length !== frameBytes) { e += `frame ${f} has wrong size\n`; ff.kill(); return; }
            if (!ff.stdin.write(raw)) await new Promise((r) => ff.stdin.once('drain', r));
          }
          ff.stdin.end();
        })().catch((x) => { e += x.message; ff.kill(); });
      });
      if (err) { log('error', ip, 'ffmpeg.failed', { id: m[1].slice(0, 8), error: String(err).slice(0, 800) }); fs.rmSync(job.dir, { recursive: true, force: true }); jobs.delete(m[1]); return send(res, 500, err, 'text/plain'); }
      const stat = await fsp.stat(out);
      // Optional: keep a copy of every export on the server (set EXPORT_COPY_DIR=/path)
      if (process.env.EXPORT_COPY_DIR) {
        await fsp.mkdir(process.env.EXPORT_COPY_DIR, { recursive: true });
        await fsp.copyFile(out, path.join(process.env.EXPORT_COPY_DIR, `${safeName(job.name)}_${job.format}_${Date.now()}.mov`));
      }
      log('info', ip, 'render.done', { id: m[1].slice(0, 8), name: job.name, format: job.format, frames: frames.length, mb: +(stat.size / 1e6).toFixed(1), encodeSec: +((Date.now() - t0) / 1000).toFixed(1) });
      res.writeHead(200, { 'content-type': 'video/quicktime', 'content-length': stat.size, 'content-disposition': `attachment; filename="${safeName(job.name)}.mov"` });
      const stream = fs.createReadStream(out);
      stream.pipe(res);
      stream.on('close', () => { fs.rmSync(job.dir, { recursive: true, force: true }); jobs.delete(m[1]); });
      return;
    }

    // ---- static app ----
    if (p === '/favicon.ico') { res.writeHead(204); return res.end(); }
    if (req.method === 'GET' || req.method === 'HEAD') return serveFile(res, PUBLIC, p === '/' ? 'index.html' : p);
    send(res, 404, 'not found', 'text/plain');
  } catch (e) {
    log('error', ip, `server.exception ${req.method} ${req.url}`, { message: e.message, stack: e.stack });
    if (!res.headersSent) send(res, 500, { error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter((i) => i && i.family === 'IPv4' && !i.internal).map((i) => i.address);
  console.log('\n  Overlay Generator is running\n');
  console.log(`  On this Mac:      http://localhost:${PORT}`);
  if (!LOCAL) for (const ip of ips) console.log(`  Office network:   http://${ip}:${PORT}`);
  log('info', 'server', 'started', { port: PORT, ffmpeg: FFMPEG || null, ips });
  console.log(`\n  ffmpeg: ${FFMPEG ? FFMPEG : 'NOT FOUND (only PNG-sequence export will work; install with: brew install ffmpeg)'}\n`);
});

process.on('uncaughtException', (e) => log('error', 'server', 'uncaughtException', { message: e.message, stack: e.stack }));
process.on('unhandledRejection', (e) => log('error', 'server', 'unhandledRejection', { message: e?.message || String(e), stack: e?.stack }));
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { log('info', 'server', `stopping (${sig})`); logFile.end(() => process.exit(0)); });
server.on('error', (e) => { log('error', 'server', 'listen.failed', { message: e.message, hint: e.code === 'EADDRINUSE' ? `Port ${PORT} is already in use. Is the server already running?` : undefined }); process.exit(1); });

if (IDLE_MIN > 0) {
  setInterval(() => {
    const busy = [...jobs.values()].some((j) => Date.now() - j.created < 10 * 60 * 1000);
    if (!busy && Date.now() - lastRequest > IDLE_MIN * 60 * 1000) {
      log('info', 'server', `idle for ${IDLE_MIN} min, shutting down`);
      logFile.end(() => process.exit(0));
    }
  }, 60 * 1000).unref();
}
