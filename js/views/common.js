import { KINDS, SEVERITY, AREAS, SYMPTOMS, CONDITIONS, byKey } from '../consts.js';
import { icon } from '../icons.js';
import { esc, num, int, money, dateShort, plural, km } from '../util.js';

export function entryRow(e, cons) {
  const k = KINDS[e.kind];
  let title, sub, extra = '';
  if (e.kind === 'fuel') {
    title = e.station ? `${e.station} · заправка` : 'Заправка';
    const c = cons?.get(e.id);
    sub = `${num(e.liters, 1)} л × ${num(e.ppl, 2)} ₪`; extra = c ? `${num(c.l100, 1)} л/100` : '';
  } else {
    title = e.title || k.label;
    sub = [e.place, e.odo != null ? km(e.odo) : ''].filter(Boolean).join(' · ') || k.label;
  }
  const clip = e.photos?.length ? `<span class="clip">${icon('image', 14)}</span>` : '';
  return `<button class="row k-${e.kind}" data-act="entry" data-id="${e.id}">
    <div class="row-ic">${icon(k.icon, 22)}</div>
    <div class="row-main"><div class="row-title">${esc(title)}${clip}</div><div class="row-sub">${esc(dateShort(e.date))} · ${esc(sub)}</div></div>
    <div class="row-amt">${money(e.total)}${extra ? `<small>${extra}</small>` : ''}</div></button>`;
}

const remIcon = { test: 'file-text', ins_m: 'shield-check', ins_c: 'shield-check', service: 'wrench' };
const stIcon = { ok: 'circle-check', soon: 'clock', over: 'triangle-alert' };
function partText(p, r) {
  if (p.unit === 'd') {
    const d = p.left;
    return d < 0 ? `просрочено на ${-d} ${plural(-d, 'день', 'дня', 'дней')}` : d === 0 ? 'сегодня' : d < 60 ? `через ${d} ${plural(d, 'день', 'дня', 'дней')}` : `через ${Math.round(d / 30.4)} мес.`;
  }
  return p.left < 0 ? `перепробег ${int(-p.left)} км` : `через ${int(p.left)} км`;
}
export function reminderRow(r, st) {
  const [a, b] = st.parts.length > 1 ? st.parts : [st.main];
  const other = st.parts.find((p) => p !== st.main);
  const detail = other ? partText(other, r) : st.main.unit === 'd' ? dateShort(r.dueDate) : `на ${int(r.dueKm)} км`;
  return `<button class="rem ${st.state}" data-act="reminder" data-id="${r.id}" style="width:100%;text-align:left">
    <div class="rem-ring">${icon(stIcon[st.state], 22)}</div>
    <div class="row-main"><div class="row-title">${esc(r.title)}</div><div class="row-sub">${esc(detail)}</div></div>
    <div class="rem-when">${esc(partText(st.main, r))}</div></button>`;
}
export const remIconFor = (k) => remIcon[k] || 'bell';

export const sevPill = (s) => `<span class="sev ${s}">${icon(SEVERITY[s].icon, 14)}${SEVERITY[s].short}</span>`;

export function issueCard(i) {
  const tags = [...(i.symptoms || []).map((k) => byKey(SYMPTOMS, k)?.ru), ...(i.conditions || []).map((k) => byKey(CONDITIONS, k)?.ru), ...(i.lights || []).length ? ['Индикатор на панели'] : []].filter(Boolean).slice(0, 4);
  const area = byKey(AREAS, i.area)?.ru;
  return `<button class="issue-card" data-act="issue" data-id="${i.id}">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">${i.status === 'fixed' ? `<span class="sev low" style="--s:var(--good);--s-ink:var(--good-ink)">${icon('circle-check', 14)}Исправлено</span>` : sevPill(i.severity)}${i.photos?.length ? `<span class="muted" style="display:flex;gap:4px;align-items:center;font-size:13px">${icon('image', 15)}${i.photos.length}</span>` : ''}</div>
    <h3>${esc(i.title)}</h3>
    <div class="issue-meta">${[area, `замечено ${dateShort(i.date)}`, i.odo != null ? km(i.odo) : ''].filter(Boolean).map(esc).join(' · ')}</div>
    ${tags.length ? `<div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
  </button>`;
}

export const thumbsHTML = (ids, big = false) => (ids || []).map((id) => `<div class="thumb${big ? ' big' : ''}" data-viewer="${id}"><img data-photo="${id}" alt="Фото"></div>`).join('');
