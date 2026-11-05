// Keeps uploaded brand fonts on this computer (IndexedDB) so they're still
// there next time the app opens — used when there's no office server.
const DB = 'overlay-generator';
const STORE = 'fonts';

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'family' });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
const tx = async (mode, fn) => {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(out?.result);
    t.onerror = () => reject(t.error);
  });
};

export const saveFont = (family, file, data) => tx('readwrite', (s) => s.put({ family, file, data }));
export const listFonts = () => tx('readonly', (s) => s.getAll()).then((r) => r || []);
