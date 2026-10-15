import { KIND_ORDER } from './consts.js';
import { monthShort, int, num, dateShort } from './util.js';

const NS = 'http://www.w3.org/2000/svg';
const kindVar = (k) => `var(--c-${k})`;

export function niceMax(v) {
  if (v <= 0) return 100;
  const p = 10 ** Math.floor(Math.log10(v)), f = v / p;
  const n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return n * p;
}
const compact = (n) => (n >= 1000 ? (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1).replace('.', ',') + 'k' : String(Math.round(n)));

/** Top-rounded bar path (square at the baseline, 4px radius at the data end). */
const topRound = (x, y, w, h, r = 4) => {
  r = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

/**
 * Stacked monthly columns. rows: [{key,total,byKind}]. Calls onSelect(row, index).
 */
export function stackedColumns(el, rows, { onSelect, selected = rows.length - 1, height = 196 } = {}) {
  const W = Math.max(260, el.clientWidth || 320), H = height, ml = 38, mr = 2, mt = 10, mb = 24;
  const max = niceMax(Math.max(...rows.map((r) => r.total), 1));
  const ph = H - mt - mb, slot = (W - ml - mr) / rows.length, bw = Math.min(24, slot * 0.62);
  const Y = (v) => mt + ph - (v / max) * ph;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Расходы по месяцам">`;
  [0, 0.5, 1].forEach((t) => {
    const y = Y(max * t);
    s += `<line class="${t === 0 ? 'axis' : 'grid'}" x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}"/><text x="${ml - 8}" y="${y + 4}" text-anchor="end">${compact(max * t)}</text>`;
  });
  rows.forEach((r, i) => {
    const x0 = ml + i * slot, cx = x0 + slot / 2;
    s += `<g class="col${i === selected ? ' sel' : ''}" data-i="${i}"><rect class="sel-bg" x="${x0 + 1}" y="${mt - 4}" width="${slot - 2}" height="${ph + 4}" rx="8"/>`;
    let cum = 0;
    const segs = KIND_ORDER.filter((k) => r.byKind[k] > 0);
    segs.forEach((k, j) => {
      const h = (r.byKind[k] / max) * ph, top = Y(cum + r.byKind[k]);
      const hh = j === 0 ? h : Math.max(h - 2, 0.8);
      const last = j === segs.length - 1;
      s += last
        ? `<path d="${topRound(cx - bw / 2, top, bw, Math.max(hh, 1))}" style="fill:${kindVar(k)}"/>`
        : `<rect x="${cx - bw / 2}" y="${top}" width="${bw}" height="${Math.max(hh, 0.8)}" style="fill:${kindVar(k)}"/>`;
      cum += r.byKind[k];
    });
    if (rows.length <= 12 || (rows.length - 1 - i) % 2 === 0)
      s += `<text x="${cx}" y="${H - 6}" text-anchor="middle">${monthShort(r.key)}</text>`;
    s += `<rect x="${x0}" y="0" width="${slot}" height="${H}" fill="transparent" class="hit"/></g>`;
  });
  s += '</svg>';
  el.innerHTML = s;
  const pick = (i) => {
    el.querySelectorAll('.col').forEach((g, k) => g.classList.toggle('sel', k === i));
    onSelect?.(rows[i], i);
  };
  el.querySelectorAll('.col').forEach((g) => g.addEventListener('click', () => pick(+g.dataset.i)));
  pick(Math.min(selected, rows.length - 1));
}

/**
 * Single-series line over time. points: [{t (ms), v, label}]; onSelect(point) on touch/hover.
 */
export function lineChart(el, points, { color = 'var(--c-fuel)', fmt = (v) => num(v, 2), onSelect, height = 164, ref = null, zeroBase = false } = {}) {
  if (!points.length) { el.innerHTML = ''; return; }
  const W = Math.max(260, el.clientWidth || 320), H = height, ml = 38, mr = 10, mt = 12, mb = 24;
  let lo = Math.min(...points.map((p) => p.v)), hi = Math.max(...points.map((p) => p.v));
  if (ref != null) { lo = Math.min(lo, ref); hi = Math.max(hi, ref); }
  if (zeroBase) lo = 0;
  const span = hi - lo || Math.max(hi * 0.1, 1), pad = zeroBase ? span * 0.08 : span * 0.18;
  const y0 = zeroBase ? 0 : lo - pad, y1 = hi + pad;
  const t0 = points[0].t, t1 = points[points.length - 1].t, tspan = t1 - t0 || 1;
  const X = (t) => ml + (points.length === 1 ? (W - ml - mr) / 2 : ((t - t0) / tspan) * (W - ml - mr));
  const Y = (v) => mt + (H - mt - mb) * (1 - (v - y0) / (y1 - y0));
  const f = (v) => (y1 - y0 > 6 ? num(v, 1) : num(v, 2)).replace(/,0+$/, '');
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img">`;
  [0, 0.5, 1].forEach((t) => {
    const v = y0 + (y1 - y0) * t, y = Y(v);
    s += `<line class="${t === 0 ? 'axis' : 'grid'}" x1="${ml}" x2="${W - mr}" y1="${y}" y2="${y}"/><text x="${ml - 8}" y="${y + 4}" text-anchor="end">${f(v)}</text>`;
  });
  if (ref != null) s += `<line x1="${ml}" x2="${W - mr}" y1="${Y(ref)}" y2="${Y(ref)}" style="stroke:var(--ink-3)" stroke-width="1" opacity=".55"/><text x="${ml + 4}" y="${Y(ref) - 5}" text-anchor="start" style="fill:var(--ink-2)">среднее ${f(ref)}</text>`;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join('');
  if (points.length > 1) {
    s += `<path d="${d}L${X(t1)},${H - mb}L${X(t0)},${H - mb}Z" style="fill:${color}" opacity=".1"/>`;
    s += `<path d="${d}" fill="none" style="stroke:${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const mid = points[Math.floor(points.length / 2)];
  s += `<text x="${ml}" y="${H - 6}" text-anchor="start">${dateShort(points[0].label)}</text>`;
  if (points.length > 4) s += `<text x="${X(mid.t)}" y="${H - 6}" text-anchor="middle">${dateShort(mid.label)}</text>`;
  if (points.length > 1) s += `<text x="${W - mr}" y="${H - 6}" text-anchor="end">${dateShort(points[points.length - 1].label)}</text>`;
  s += `<g id="cur"></g><rect x="${ml}" y="0" width="${W - ml - mr + 6}" height="${H}" fill="transparent" id="hit"/></svg>`;
  el.innerHTML = s;
  const svg = el.querySelector('svg'), cur = el.querySelector('#cur');
  const show = (i) => {
    const p = points[i], x = X(p.t), y = Y(p.v);
    cur.innerHTML = `<line x1="${x}" x2="${x}" y1="${mt}" y2="${H - mb}" style="stroke:var(--axis)" stroke-width="1"/><circle cx="${x}" cy="${y}" r="6" style="fill:${color};stroke:var(--surface)" stroke-width="2"/>`;
    onSelect?.(p, i);
  };
  const at = (e) => {
    const r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(X(p.t) - x); if (d < bd) { bd = d; best = i; } });
    show(best);
  };
  let down = false;
  svg.addEventListener('pointerdown', (e) => { down = true; at(e); });
  svg.addEventListener('pointermove', (e) => { if (down || e.pointerType === 'mouse') at(e); });
  window.addEventListener('pointerup', () => (down = false), { once: false });
  show(points.length - 1);
}
