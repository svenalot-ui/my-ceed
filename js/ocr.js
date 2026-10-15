import { today, addDays } from './util.js';

const CDN = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
const LANG = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int';
let loader;
function loadLib() {
  if (window.Tesseract) return Promise.resolve();
  return (loader ||= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = CDN; s.onload = res; s.onerror = () => { loader = null; rej(new Error('offline')); };
    document.head.appendChild(s);
  }));
}

/** Grayscale + contrast stretch: receipts are thermal paper, this helps a lot. */
async function prep(blob) {
  const bmp = await createImageBitmap(blob);
  const k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(bmp, 0, 0, c.width, c.height);
  const img = x.getImageData(0, 0, c.width, c.height), d = img.data, hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) { const g = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) | 0; d[i] = g; hist[g]++; }
  const total = c.width * c.height; let lo = 0, hi = 255, acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > total * 0.02) { lo = i; break; } }
  acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > total * 0.02) { hi = i; break; } }
  const sc = 255 / Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) { const g = Math.max(0, Math.min(255, (d[i] - lo) * sc)); d[i] = d[i + 1] = d[i + 2] = g; d[i + 3] = 255; }
  x.putImageData(img, 0, 0);
  return c;
}

export async function recognize(blob, onProgress) {
  await loadLib();
  const canvas = await prep(blob);
  const worker = await window.Tesseract.createWorker('eng', 1, {
    langPath: LANG,
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress?.('Читаю цифры…', 0.35 + 0.65 * m.progress);
      else if (/loading/.test(m.status)) onProgress?.(/language/.test(m.status) ? 'Загружаю словарь…' : 'Загружаю распознавалку…', 0.05 + 0.3 * (m.progress || 0));
    },
  });
  try {
    let text = (await worker.recognize(canvas)).data.text, r = parseReceipt(text);
    if (!r.total) {
      await worker.setParameters({ tessedit_pageseg_mode: '6' });
      text = text + '\n' + (await worker.recognize(canvas)).data.text; r = parseReceipt(text);
    }
    return { ...r, text };
  } finally { worker.terminate(); }
}

/**
 * Language-independent receipt reading: find numbers (L, P, T) with L × P ≈ T.
 * A fuel receipt always has liters, price per liter and total, so the triple is self-verifying.
 */
export function parseReceipt(text) {
  const t = text.replace(/(\d)[,٫](\d)/g, '$1.$2').replace(/(\d)\s+\.(\d)/g, '$1.$2');
  const nums = [...new Set([...t.matchAll(/(?<![\d.])(\d{1,4}\.\d{1,3})(?![\d])/g)].map((m) => parseFloat(m[1])))].slice(0, 70);
  let best = null;
  for (const L of nums) {
    if (L < 4 || L > 130) continue;
    for (const P of nums) {
      if (P < 3 || P > 15 || P === L) continue;
      for (const T of nums) {
        if (T < 15 || T > 1800 || T === L || T === P) continue;
        const err = Math.abs(L * P - T);
        if (err > Math.max(0.65, T * 0.004)) continue;
        const score = err + (P >= 5 && P <= 10 ? 0 : 0.8) + (String(L).split('.')[1]?.length === 2 ? 0 : 0.05);
        if (!best || score < best.score) best = { L, P, T, score };
      }
    }
  }
  const out = { liters: best?.L ?? null, ppl: best?.P ?? null, total: best?.T ?? null };
  for (const m of t.matchAll(/(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/g)) {
    let [, d, mo, y] = m; d = +d; mo = +mo; y = +y; if (y < 100) y += 2000;
    if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2015) continue;
    const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (iso > addDays(today(), 1)) continue;
    out.date = iso; break;
  }
  const low = t.toLowerCase();
  if (/\b98\b/.test(low) && !/\b95\b/.test(low)) out.fuel = '98'; else if (/\b95\b/.test(low)) out.fuel = '95';
  const brands = [['sonol', 'Sonol'], ['paz', 'Paz'], ['delek', 'Delek'], ['dor alon', 'Dor Alon'], ['ten ', 'Ten']];
  for (const [k, v] of brands) if (low.includes(k)) { out.station = v; break; }
  return out;
}
