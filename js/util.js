export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const NB = ' ';
const f0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const fmts = {};
export const int = (n) => f0.format(Math.round(n)).replace(/\s/g, NB);
export const num = (n, d = 1) => {
  fmts[d] ||= new Intl.NumberFormat('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d });
  return fmts[d].format(n).replace(/\s/g, NB);
};
/** ₪ amount: whole shekels if integer, otherwise agorot. */
export const money = (n, force) => {
  if (n == null || isNaN(n)) return '—';
  const whole = Math.abs(n - Math.round(n)) < 0.005;
  return (force === 0 || (force == null && whole) ? int(n) : num(n, 2)) + NB + '₪';
};
export const moneyR = (n) => (n == null || isNaN(n) ? '—' : int(n) + NB + '₪');
export const km = (n) => (n == null ? '—' : int(n) + NB + 'км');

/* ---------- dates: ISO yyyy-mm-dd in local time ---------- */
const p2 = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const today = () => iso(new Date());
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const addMonths = (s, n) => {
  const d = parse(s); const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last)); return iso(d);
};
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const dm = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const dmy = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
const mFull = new Intl.DateTimeFormat('ru-RU', { month: 'long' });
const mShort = new Intl.DateTimeFormat('ru-RU', { month: 'short' });
const clean = (s) => s.replace(/\.$/, '').replace(/\s?г\.$/, '');
export const dateShort = (s) => { const d = parse(s); return clean((d.getFullYear() === new Date().getFullYear() ? dm : dmy).format(d)); };
export const dateFull = (s) => clean(dmy.format(parse(s)));
export const monthName = (s) => mFull.format(parse(s.length === 7 ? s + '-01' : s));
export const monthShort = (s) => clean(mShort.format(parse(s.length === 7 ? s + '-01' : s)));
export const monthTitle = (s) => { const d = parse(s + '-01'); const n = mFull.format(d); const y = d.getFullYear(); return n[0].toUpperCase() + n.slice(1) + (y !== new Date().getFullYear() ? ' ' + y : ''); };
export const ym = (s) => s.slice(0, 7);

export function plural(n, one, few, many) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}
export const parseNum = (v) => {
  if (v == null) return null;
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  if (s === '' || s === '.') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
};
export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
/** Show a number in an input: trim trailing zeros but keep up to d decimals. */
export const inputVal = (n, d = 2) => (n == null || isNaN(n) ? '' : String(round(n, d)).replace('.', ','));
export const debounce = (fn, ms = 200) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
