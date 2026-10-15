import { S, currentOdo, openIssues } from './store.js';
import { AREAS, CONDITIONS, SYMPTOMS, LIGHTS, SEVERITY, byKey, HE, RU } from './consts.js';
import { dateFull, int, esc } from './util.js';
import { sortDesc } from './calc.js';

const SEV_ORDER = { urgent: 0, fix: 1, low: 2 };
const labels = (list, keys, lang) => (keys || []).map((k) => byKey(list, k)?.[lang]).filter(Boolean);

export function problems(includeIds) {
  return openIssues()
    .filter((i) => !includeIds || includeIds.has(i.id))
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || (a.date < b.date ? 1 : -1));
}

export function recentWork(n = 5) {
  return sortDesc(S.entries.filter((e) => ['service', 'repair', 'tires'].includes(e.kind))).slice(0, n);
}

/** Structured doc for both on-screen display and plain-text share. lang: 'ru' | 'he' */
export function build(lang, includeIds, withRecent = true) {
  const T = lang === 'he' ? HE : RU, car = S.settings.car, odo = currentOdo();
  const sep = lang === 'he' ? ' · ' : ', ';
  const items = problems(includeIds).map((i) => ({
    id: i.id,
    title: i.title,
    area: byKey(AREAS, i.area)?.[lang],
    severity: SEVERITY[i.severity]?.[lang],
    sevKey: i.severity,
    when: labels(CONDITIONS, i.conditions, lang).join(sep),
    symptoms: labels(SYMPTOMS, i.symptoms, lang).join(sep),
    lights: labels(LIGHTS, i.lights, lang).join(sep),
    seen: `${dateFull(i.date)}${i.odo != null ? ` · ${int(i.odo)} ${lang === 'he' ? 'ק״מ' : 'км'}` : ''}`,
    desc: i.desc || '',
    mechanic: i.mechanic || '',
    photos: i.photos || [],
  }));
  const recent = withRecent ? recentWork().map((e) => ({ date: dateFull(e.date), title: e.title || '', odo: e.odo, place: e.place })) : [];
  return { T, lang, car: { name: car.name, year: car.year, plate: car.plate, odo, fuel: car.fuel === 'diesel' ? (lang === 'he' ? 'סולר' : 'солярка') : car.fuel }, items, recent };
}

export function toText(doc) {
  const { T, car, items, recent } = doc;
  const L = [];
  L.push(`${T.title}`, '');
  L.push(`${car.name}${car.year ? ' ' + car.year : ''}${car.plate ? ` · ${T.plate} ${car.plate}` : ''}`);
  if (car.odo) L.push(`${T.mileage}: ${int(car.odo)}`);
  L.push('');
  if (!items.length) L.push(T.noProblems);
  items.forEach((p, n) => {
    L.push(`${n + 1}. ${p.title}${p.severity ? `  [${p.severity}]` : ''}`);
    if (p.area) L.push(`   ${T.area}: ${p.area}`);
    if (p.symptoms) L.push(`   ${T.symptoms}: ${p.symptoms}`);
    if (p.when) L.push(`   ${T.when}: ${p.when}`);
    if (p.lights) L.push(`   ${T.lights}: ${p.lights}`);
    if (p.desc) L.push(`   ${T.details}: ${p.desc}`);
    L.push(`   ${T.seen}: ${p.seen}`);
    L.push('');
  });
  if (recent.length) {
    L.push(`${T.recent}:`);
    recent.forEach((r) => L.push(`• ${r.date}${r.odo ? ' · ' + int(r.odo) : ''} — ${r.title}`));
  }
  return L.join('\n').trim();
}

export function toHTML(doc) {
  const { T, car, items, recent, lang } = doc;
  const row = (k, v) => (v ? `<b>${esc(k)}</b>${esc(v)}` : '');
  return `<h1>${esc(T.title)}</h1>
  <div class="carline"><strong>${esc(car.name)}${car.year ? ' ' + car.year : ''}</strong>${car.plate ? ` · ${esc(T.plate)} <span dir="ltr">${esc(car.plate)}</span>` : ''}<br>
  ${car.odo ? `${esc(T.mileage)}: <span dir="ltr">${int(car.odo)}</span> · ` : ''}${esc(T.fuel)}: ${esc(car.fuel)}</div>
  <h2>${esc(T.problems)}${items.length ? ` · ${items.length}` : ''}</h2>
  ${items.length ? items.map((p, n) => `<div class="prob" data-id="${p.id}">
      <h3><span class="n">${n + 1}</span><span>${esc(p.title)}</span></h3>
      <div style="margin-top:8px"><span class="sev ${p.sevKey}">${esc(p.severity || '')}</span></div>
      <div class="kv">${row(T.area, p.area)}${row(T.symptoms, p.symptoms)}${row(T.when, p.when)}${row(T.lights, p.lights)}${row(T.details, p.desc)}${row(T.seen, p.seen)}</div>
      ${p.photos.length ? `<div class="thumbs">${p.photos.map((id) => `<div class="thumb" data-viewer="${id}"><img data-photo="${id}" alt=""></div>`).join('')}</div>` : ''}
    </div>`).join('') : `<p class="muted">${esc(T.noProblems)}</p>`}
  ${recent.length ? `<h2>${esc(T.recent)}</h2>${recent.map((r) => `<div class="recent"><span>${esc(r.title)}</span><span>${esc(r.date)}${r.odo ? ' · ' + int(r.odo) : ''}</span></div>`).join('')}` : ''}`;
}
