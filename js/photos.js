import * as db from './db.js';
import { uid } from './util.js';

/** Downscale + recompress a camera photo so receipts stay ~200-400 KB. */
export async function shrink(file, max = 1600, q = 0.82) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); }); }
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/jpeg', q));
}
export async function savePhoto(blob) { const id = uid(); await db.put('photos', { id, blob }); return id; }
export async function deletePhotos(ids) { for (const id of ids || []) { urls.delete(id); await db.del('photos', id); } }
const urls = new Map();
export async function photoURL(id) {
  if (urls.has(id)) return urls.get(id);
  const r = await db.get('photos', id);
  if (!r) return null;
  const u = URL.createObjectURL(r.blob);
  urls.set(id, u); return u;
}
export const photoBlob = async (id) => (await db.get('photos', id))?.blob;
/** Fill <img data-photo="id"> elements lazily. */
export function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-photo]:not([src])').forEach(async (img) => {
    const u = await photoURL(img.dataset.photo);
    if (u) img.src = u; else img.closest('.thumb')?.classList.add('missing');
  });
}
