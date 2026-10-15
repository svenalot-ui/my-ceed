import * as db from './db.js';
import { today, addMonths, daysBetween } from './util.js';
import { seedDemo } from './demo.js';

export const S = { entries: [], issues: [], settings: null, demo: false };
const subs = new Set();
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const emit = () => subs.forEach((f) => f());

export const defaultSettings = () => ({
  car: { name: 'Kia Ceed SW', year: 2018, plate: '', tank: 50, fuel: '95', purchaseKm: null },
  odoLog: [],
  reminders: [
    { id: 'test', key: 'test', title: 'Тест и лицензия (טסט)', dueDate: null, dueKm: null },
    { id: 'ins_m', key: 'ins_m', title: 'Страховка обязательная (חובה)', dueDate: null, dueKm: null },
    { id: 'ins_c', key: 'ins_c', title: 'Страховка комплексная (מקיף)', dueDate: null, dueKm: null },
    { id: 'service', key: 'service', title: 'Плановое ТО', dueDate: null, dueKm: null, everyKm: 15000, everyMonths: 12, lastKm: null, lastDate: null },
  ],
  theme: 'auto', ocr: true, onboarded: false, stations: [],
});

export async function init({ demo }) {
  await db.open(demo ? 'myceed-demo' : 'myceed');
  S.demo = demo;
  const [entries, issues, kv] = await Promise.all([db.all('entries'), db.all('issues'), db.get('kv', 'settings')]);
  S.entries = entries; S.issues = issues;
  const d = defaultSettings(), s = kv?.value || {};
  S.settings = { ...d, ...s, car: { ...d.car, ...(s.car || {}) }, reminders: s.reminders || d.reminders };
  if (demo && !entries.length && !issues.length) await seedDemo({ S, db, saveSettings });
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

export async function saveSettings(patch, silent) {
  const next = { ...S.settings, ...patch };
  if (patch.car) next.car = { ...S.settings.car, ...patch.car };
  S.settings = next;
  await db.put('kv', { key: 'settings', value: S.settings });
  if (!silent) emit();
}

/* ---------- odometer ---------- */
export function odoPoints() {
  const p = [];
  S.entries.forEach((e) => e.odo != null && p.push({ date: e.date, km: e.odo }));
  S.issues.forEach((i) => i.odo != null && p.push({ date: i.date, km: i.odo }));
  S.settings.odoLog.forEach((o) => p.push(o));
  return p.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.km - b.km));
}
export const currentOdo = () => odoPoints().reduce((m, p) => Math.max(m, p.km), 0) || null;
export async function logOdo(kmVal, date = today()) {
  const log = [...S.settings.odoLog.filter((o) => o.date !== date), { date, km: kmVal }].slice(-400);
  await saveSettings({ odoLog: log });
}

/* ---------- entries ---------- */
export async function saveEntry(e) {
  e.updatedAt = Date.now(); e.createdAt ||= e.updatedAt;
  await db.put('entries', e);
  const i = S.entries.findIndex((x) => x.id === e.id);
  if (i >= 0) S.entries[i] = e; else S.entries.push(e);
  await rollReminders(e);
  if (e.kind === 'fuel' && e.station && !['Paz', 'Sonol', 'Delek', 'Dor Alon', 'Ten'].includes(e.station)) {
    const st = [e.station, ...S.settings.stations.filter((s) => s !== e.station)].slice(0, 6);
    await saveSettings({ stations: st }, true);
  }
  emit();
}
export async function removeEntry(id) {
  const e = S.entries.find((x) => x.id === id);
  await db.del('entries', id);
  S.entries = S.entries.filter((x) => x.id !== id);
  emit();
  return e;
}
export async function restoreEntry(e) { await db.put('entries', e); S.entries.push(e); emit(); }

/* ---------- issues ---------- */
export async function saveIssue(i) {
  i.updatedAt = Date.now(); i.createdAt ||= i.updatedAt;
  await db.put('issues', i);
  const k = S.issues.findIndex((x) => x.id === i.id);
  if (k >= 0) S.issues[k] = i; else S.issues.push(i);
  emit();
}
export async function removeIssue(id) {
  const i = S.issues.find((x) => x.id === id);
  await db.del('issues', id);
  S.issues = S.issues.filter((x) => x.id !== id);
  emit();
  return i;
}
export async function restoreIssue(i) { await db.put('issues', i); S.issues.push(i); emit(); }

/* ---------- reminders ---------- */
async function rollReminders(e) {
  const rs = S.settings.reminders.map((r) => ({ ...r }));
  let changed = false;
  if (e.kind === 'docs' && e.validUntil && e.docType && e.docType !== 'other') {
    const r = rs.find((x) => x.key === e.docType);
    if (r && (!r.dueDate || e.validUntil > r.dueDate)) { r.dueDate = e.validUntil; changed = true; }
  }
  if (e.kind === 'service') {
    const r = rs.find((x) => x.key === 'service');
    if (r && (!r.lastDate || e.date >= r.lastDate)) {
      r.lastDate = e.date; r.lastKm = e.odo ?? r.lastKm;
      if (e.odo != null && r.everyKm) r.dueKm = e.odo + r.everyKm;
      if (r.everyMonths) r.dueDate = addMonths(e.date, r.everyMonths);
      changed = true;
    }
  }
  if (changed) await saveSettings({ reminders: rs }, true);
}

/** state: ok | soon | over. `left` is in days or km. */
export function reminderStatus(r, odo = currentOdo(), now = today()) {
  const parts = [];
  if (r.dueDate) {
    const days = daysBetween(now, r.dueDate);
    parts.push({ unit: 'd', left: days, state: days < 0 ? 'over' : days <= 30 ? 'soon' : 'ok' });
  }
  if (r.dueKm != null && odo != null) {
    const left = r.dueKm - odo;
    parts.push({ unit: 'km', left, state: left < 0 ? 'over' : left <= 1000 ? 'soon' : 'ok' });
  }
  if (!parts.length) return null;
  const rank = { over: 2, soon: 1, ok: 0 };
  parts.sort((a, b) => rank[b.state] - rank[a.state] || (a.unit === 'd' ? -1 : 1));
  return { state: parts[0].state, main: parts[0], parts };
}
export function sortedReminders() {
  const rank = { over: 0, soon: 1, ok: 2 };
  return S.settings.reminders
    .map((r) => ({ r, st: reminderStatus(r) }))
    .filter((x) => x.st)
    .sort((a, b) => rank[a.st.state] - rank[b.st.state] || (a.st.main.unit === b.st.main.unit ? a.st.main.left - b.st.main.left : a.st.main.unit === 'd' ? -1 : 1));
}

export async function wipeAll() {
  await Promise.all(['entries', 'issues', 'photos', 'kv'].map(db.clear));
  S.entries = []; S.issues = []; S.settings = defaultSettings(); emit();
}
export const openIssues = () => S.issues.filter((i) => i.status !== 'fixed');
export const lastEntry = (kind) => S.entries.filter((e) => e.kind === kind).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
