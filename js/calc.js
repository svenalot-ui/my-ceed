import { KIND_ORDER } from './consts.js';
import { parse, ym, addMonths, iso, daysBetween } from './util.js';
import { odoPoints } from './store.js';

const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.odo ?? 0) - (b.odo ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
export const sortAsc = (list) => [...list].sort(byDate);
export const sortDesc = (list) => [...list].sort((a, b) => byDate(b, a));

/**
 * Full-to-full consumption. For every "full tank" fill with an odometer reading, find the previous
 * full fill; consumption = liters poured since then (incl. this one) / distance.
 * Returns Map(entryId -> {l100, km, liters}).
 */
export function consumption(entries) {
  const out = new Map();
  let base = null, acc = 0;
  for (const e of sortAsc(entries.filter((x) => x.kind === 'fuel' && x.liters > 0))) {
    if (e.missed) { base = null; acc = 0; }
    if (base != null) acc += e.liters;
    if (e.full && e.odo != null) {
      if (base != null && e.odo > base) {
        const dist = e.odo - base, l100 = (acc / dist) * 100;
        if (dist >= 30 && l100 > 2 && l100 < 30) out.set(e.id, { l100, km: dist, liters: acc });
      }
      base = e.odo; acc = 0;
    } else if (e.full) { base = null; acc = 0; }
  }
  return out;
}

export function odoAt(points, date) {
  if (!points.length) return null;
  if (date <= points[0].date) return points[0].km;
  const last = points[points.length - 1];
  if (date >= last.date) return last.km;
  for (let i = 1; i < points.length; i++) {
    if (points[i].date >= date) {
      const a = points[i - 1], b = points[i];
      const span = daysBetween(a.date, b.date);
      return span <= 0 ? b.km : a.km + ((b.km - a.km) * daysBetween(a.date, date)) / span;
    }
  }
  return last.km;
}
/** Distance driven between two dates (interpolated from known odometer readings). */
export function kmBetween(from, to) {
  const pts = odoPoints(); if (pts.length < 2) return null;
  if (to < pts[0].date || from > pts[pts.length - 1].date) return null;
  return Math.max(0, odoAt(pts, to) - odoAt(pts, from));
}

export const inRange = (e, from, to) => e.date >= from && e.date <= to;
export const sum = (list, f = (x) => x) => list.reduce((s, x) => s + (f(x) || 0), 0);

export function totalsByKind(list) {
  const t = {}; KIND_ORDER.forEach((k) => (t[k] = 0));
  list.forEach((e) => (t[e.kind] = (t[e.kind] || 0) + (e.total || 0)));
  return t;
}

export function fuelStats(entries, from = '0000-00-00', to = '9999-99-99') {
  const fills = entries.filter((e) => e.kind === 'fuel' && e.liters > 0 && inRange(e, from, to));
  const liters = sum(fills, (e) => e.liters), spent = sum(fills, (e) => e.total);
  const cons = consumption(entries);
  const segs = fills.map((e) => cons.get(e.id)).filter(Boolean);
  const segKm = sum(segs, (s) => s.km), segL = sum(segs, (s) => s.liters);
  const l100 = segKm > 0 ? (segL / segKm) * 100 : null;
  const avgPpl = liters > 0 ? spent / liters : null;
  return { fills: fills.length, liters, spent, avgPpl, l100, per100: l100 != null && avgPpl != null ? l100 * avgPpl : null, cons };
}

/** Month buckets with per-kind totals, oldest first. */
export function monthly(entries, fromMonth, toMonth) {
  const rows = [];
  for (let m = fromMonth; m <= toMonth; m = ym(addMonths(m + '-01', 1))) {
    const byKind = {}; KIND_ORDER.forEach((k) => (byKind[k] = 0));
    rows.push({ key: m, total: 0, byKind });
  }
  const idx = new Map(rows.map((r, i) => [r.key, i]));
  entries.forEach((e) => {
    const i = idx.get(ym(e.date)); if (i == null) return;
    rows[i].byKind[e.kind] += e.total || 0; rows[i].total += e.total || 0;
  });
  return rows;
}

export function byStation(entries, from, to) {
  const m = new Map();
  entries.filter((e) => e.kind === 'fuel' && e.liters > 0 && e.station && inRange(e, from, to)).forEach((e) => {
    const r = m.get(e.station) || { name: e.station, n: 0, liters: 0, spent: 0 };
    r.n++; r.liters += e.liters; r.spent += e.total; m.set(e.station, r);
  });
  return [...m.values()].map((r) => ({ ...r, ppl: r.spent / r.liters })).sort((a, b) => a.ppl - b.ppl);
}

export const lastKmPoint = () => { const p = odoPoints(); return p.length ? p[p.length - 1] : null; };
