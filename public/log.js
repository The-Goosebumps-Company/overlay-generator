// Client-side logging: records what the user does and any errors, prints them to
// the browser console, and ships them to the server's log file (logs/app.log).
const SID = Math.random().toString(36).slice(2, 8);
const queue = [];
let timer = null;
let serverDown = false;
let remote = null; // null = unknown yet; queue until we know whether a server exists
export const setRemoteLogging = (on) => { remote = on; if (on) flush(); else queue.length = 0; };
const realFetch = window.fetch.bind(window);

function flush(useBeacon = false) {
  clearTimeout(timer); timer = null;
  if (!queue.length || !remote) return;
  const body = JSON.stringify(queue.splice(0, queue.length));
  if (useBeacon && navigator.sendBeacon) { navigator.sendBeacon('/api/log', new Blob([body], { type: 'application/json' })); return; }
  realFetch('/api/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: body.length < 60000 })
    .then(() => { serverDown = false; })
    .catch(() => { serverDown = true; });
}

const short = (v) => {
  if (typeof v === 'string' && v.length > 300) return `${v.slice(0, 300)}…`;
  return v;
};

export function log(level, event, data = {}) {
  const clean = {};
  for (const [k, v] of Object.entries(data || {})) clean[k] = short(v);
  const entry = { t: new Date().toISOString(), level, event, sid: SID, data: clean };
  (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(`[overlay] ${event}`, clean);
  queue.push(entry);
  if (queue.length > 200) queue.splice(0, queue.length - 200);
  if (remote === false) { queue.length = 0; return; }
  if (level === 'error') flush();
  else if (!timer) timer = setTimeout(flush, 1500);
}
export const isServerDown = () => serverDown;

const errInfo = (e) => (e instanceof Error ? { message: e.message, stack: e.stack } : { message: String(e) });

// Uncaught errors + failed resource loads (fonts, scripts, images)
window.addEventListener('error', (e) => {
  if (e.target && e.target !== window && (e.target.src || e.target.href)) {
    log('error', 'resource.failed', { tag: e.target.tagName, url: e.target.src || e.target.href });
  } else {
    log('error', 'uncaught', { message: e.message, file: e.filename, line: e.lineno, col: e.colno, stack: e.error?.stack });
  }
}, true);
window.addEventListener('unhandledrejection', (e) => log('error', 'unhandled.promise', errInfo(e.reason)));
window.addEventListener('pagehide', () => flush(true));
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });

// Log every failed API call (network down, 4xx, 5xx) automatically
window.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = init?.method || 'GET';
  const isLog = url.includes('/api/log') || url.includes('/api/status') || url.includes('shared/library.json');
  const t0 = performance.now();
  try {
    const res = await realFetch(input, init);
    if (!res.ok && !isLog) {
      let detail = '';
      try { detail = (await res.clone().text()).slice(0, 300); } catch {}
      log('error', 'api.failed', { method, url, status: res.status, ms: Math.round(performance.now() - t0), detail });
    }
    return res;
  } catch (e) {
    if (!isLog) log('error', 'api.unreachable', { method, url, message: e.message, hint: 'Is the Overlay Generator server running?' });
    throw e;
  }
};

export { errInfo };
