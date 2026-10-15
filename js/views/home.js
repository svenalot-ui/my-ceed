import { S, currentOdo, sortedReminders, openIssues } from '../store.js';
import { KINDS, KIND_ORDER, kindLabelShort } from '../consts.js';
import { icon } from '../icons.js';
import { esc, num, int, today, ym, addMonths, monthName, parse, plural } from '../util.js';
import { totalsByKind, sum, consumption, sortDesc, sortAsc } from '../calc.js';
import { entryRow, reminderRow } from './common.js';
import { odoPoints } from '../store.js';

export function avgConsumption(entries, last = 5) {
  const cons = consumption(entries);
  const ids = sortAsc(entries.filter((e) => cons.has(e.id))).slice(-last);
  const d = sum(ids, (e) => cons.get(e.id).km), l = sum(ids, (e) => cons.get(e.id).liters);
  return d > 0 ? (l / d) * 100 : null;
}
export function costPerKm(entries) {
  const pts = odoPoints(); if (pts.length < 2) return null;
  const a = pts[0], b = pts[pts.length - 1], dist = b.km - a.km;
  if (dist < 300) return null;
  return sum(entries.filter((e) => e.date >= a.date), (e) => e.total) / dist;
}

export function renderHome() {
  const car = S.settings.car, es = S.entries, now = today(), mk = ym(now);
  const sub = [car.name, car.year, car.plate].filter(Boolean).join(' · ');
  const head = `<div class="title-row"><div><div class="h1">Мой Сид</div><div class="sub">${esc(sub)}</div></div>
    <button class="icon-btn" data-act="settings" aria-label="Настройки">${icon('settings', 22)}</button></div>`;

  if (!es.length && !S.issues.length) {
    return head + `<div class="card" style="padding:26px 22px;text-align:center">
      <div class="empty-ic" style="margin-bottom:16px;background:var(--accent);color:var(--on-accent)">${icon('fuel', 30)}</div>
      <h2 style="font-size:23px;letter-spacing:-.03em">Запишем первую заправку?</h2>
      <p class="muted" style="margin:8px 0 20px">Сфотографируйте чек — литры, цена и сумма посчитаются сами.</p>
      <button class="btn primary block" data-act="add" data-kind="fuel">${icon('camera', 20)} Добавить заправку</button>
      <button class="btn ghost block" style="margin-top:6px" data-act="demo">Посмотреть на примере</button></div>`
      + (sortedReminders().length ? `<div class="section"><div class="section-head"><h2>Скоро</h2></div><div class="list">${sortedReminders().map(({ r, st }) => reminderRow(r, st)).join('')}</div></div>` : '');
  }

  // ----- this month vs same point last month
  const month = es.filter((e) => ym(e.date) === mk), total = sum(month, (e) => e.total);
  const dayN = parse(now).getDate(), pk = ym(addMonths(now, -1));
  const prevToDate = sum(es.filter((e) => ym(e.date) === pk && parse(e.date).getDate() <= dayN), (e) => e.total);
  let delta = '';
  if (prevToDate > 0) {
    const pct = Math.round(((total - prevToDate) / prevToDate) * 100);
    const up = pct > 0;
    delta = `<span class="pill ${up ? 'up' : 'down'}">${icon(up ? 'arrow-up-right' : 'arrow-down-right', 14)}${Math.abs(pct)}%</span><span>к тому же числу прошлого месяца</span>`;
  } else delta = `<span>${month.length} ${plural(month.length, 'запись', 'записи', 'записей')} в этом месяце</span>`;
  const byK = totalsByKind(month);
  const segs = KIND_ORDER.filter((k) => byK[k] > 0);
  const hero = `<div class="hero">
    <div class="eyebrow">${esc(monthName(now))} · потрачено</div>
    <div class="hero-num">${int(total)}<small>₪</small></div>
    <div class="hero-delta">${delta}</div>
    ${segs.length ? `<div class="hero-bar">${segs.map((k) => `<i style="--c:var(--c-${k});flex:${byK[k]}" title="${esc(KINDS[k].label)}"></i>`).join('')}</div>
    <div class="hero-legend">${segs.map((k) => `<span style="--c:var(--c-${k})"><i></i>${kindLabelShort[k]} ${int(byK[k])}</span>`).join('')}</div>` : ''}
  </div>`;

  const odo = currentOdo(), l100 = avgConsumption(es), pk2 = costPerKm(es);
  const tiles = `<div class="tiles">
    <button class="tile" data-act="odo"><div class="t-l">${icon('gauge', 14)}Пробег</div><div class="t-v">${odo ? int(odo) : '—'}<small>км</small></div><div class="t-s">обновить</div></button>
    <div class="tile"><div class="t-l">${icon('fuel', 14)}Расход</div><div class="t-v">${l100 ? num(l100, 1) : '—'}<small>л/100</small></div><div class="t-s">${l100 ? 'за 5 баков' : 'нужны 2 полных бака'}</div></div>
    <div class="tile"><div class="t-l">${icon('route', 14)}Стоимость</div><div class="t-v">${pk2 ? num(pk2, 2) : '—'}<small>₪/км</small></div><div class="t-s">${pk2 ? 'всё вместе' : 'нужен пробег'}</div></div>
  </div>`;

  const open = openIssues();
  const worst = open.some((i) => i.severity === 'urgent');
  const issues = open.length ? `<div class="section" style="margin-top:16px"><button class="callout" data-act="tab" data-tab="issues"><div class="row-ic" style="${worst ? '' : '--c:var(--serious)'}">${icon(worst ? 'siren' : 'triangle-alert', 22)}</div><div class="row-main"><b>${open.length} ${plural(open.length, 'открытая поломка', 'открытые поломки', 'открытых поломок')}</b><span>${worst ? 'есть срочные · ' : ''}показать мастеру</span></div>${icon('chevron-right', 20)}</button></div>` : '';

  const rem = sortedReminders();
  const reminders = rem.length ? `<div class="section"><div class="section-head"><h2>Скоро</h2><button class="link" data-act="settings" data-anchor="rem">Настроить</button></div>
    <div class="list">${rem.slice(0, 4).map(({ r, st }) => reminderRow(r, st)).join('')}</div></div>`
    : `<div class="section"><button class="callout" data-act="settings" data-anchor="rem"><div class="row-ic" style="--c:var(--c-docs)">${icon('bell', 22)}</div><div class="row-main"><b>Напоминания</b><span>тест, страховка, ТО — укажите даты, чтобы не забыть</span></div>${icon('chevron-right', 20)}</button></div>`;

  const cons = consumption(es);
  const recent = sortDesc(es).slice(0, 5);
  const list = `<div class="section"><div class="section-head"><h2>Последнее</h2><button class="link" data-act="tab" data-tab="log">Весь журнал</button></div>
    <div class="list">${recent.map((e) => entryRow(e, cons)).join('')}</div></div>`;

  return head + hero + tiles + issues + reminders + list;
}
