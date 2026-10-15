let db;
export function open(name) {
  return new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('entries', { keyPath: 'id' });
      d.createObjectStore('issues', { keyPath: 'id' });
      d.createObjectStore('photos', { keyPath: 'id' });
      d.createObjectStore('kv', { keyPath: 'key' });
    };
    r.onsuccess = () => { db = r.result; res(); };
    r.onerror = () => rej(r.error);
    r.onblocked = () => rej(new Error('blocked'));
  });
}
function tx(store, mode, fn) {
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    let out;
    const req = fn(t.objectStore(store));
    if (req) req.onsuccess = () => (out = req.result);
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error || new Error('abort'));
  });
}
export const all = (s) => tx(s, 'readonly', (o) => o.getAll());
export const get = (s, id) => tx(s, 'readonly', (o) => o.get(id));
export const put = (s, v) => tx(s, 'readwrite', (o) => o.put(v));
export const del = (s, id) => tx(s, 'readwrite', (o) => o.delete(id));
export const clear = (s) => tx(s, 'readwrite', (o) => o.clear());
export const keys = (s) => tx(s, 'readonly', (o) => o.getAllKeys());
