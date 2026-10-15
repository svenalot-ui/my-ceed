import { S } from '../store.js';
import { KINDS, KIND_ORDER, kindLabelShort } from '../consts.js';
import { icon } from '../icons.js';
import { esc, moneyR, monthTitle, ym } from '../util.js';
import { consumption, sortDesc, sum } from '../calc.js';
import { entryRow } from './common.js';
import { chip, empty } from '../ui.js';

export const J = { kind: 'all', q: '', search: false };

export function journalList() {
  const q = J.q.trim().toLowerCase();
  let list = S.entries.filter((e) => J.kind === 'all' || e.kind === J.kind);
  if (q) list = list.filter((e) => [e.title, e.place, e.station, e.note, KINDS[e.kind].label, String(e.total), e.date].join(' ').toLowerCase().includes(q));
  list = sortDesc(list);
  if (!list.length) return S.entries.length
    ? empty('search', 'Ничего не найдено', 'Попробуйте другой фильтр или запрос.')
    : empty('receipt-text', 'Журнал пуст', 'Здесь появятся заправки, ремонты и все расходы по машине.', `<button class="btn primary" data-act="add">${icon('plus', 20)} Добавить запись</button>`);
  const cons = consumption(S.entries);
  const groups = new Map();
  list.forEach((e) => { const k = ym(e.date); (groups.get(k) || groups.set(k, []).get(k)).push(e); });
  return [...groups].map(([k, es]) => `<div class="month-head"><h3>${esc(monthTitle(k))}</h3><span>${moneyR(sum(es, (e) => e.total))}</span></div>
    <div class="list">${es.map((e) => entryRow(e, cons)).join('')}</div>`).join('');
}

export function renderJournal() {
  const used = KIND_ORDER.filter((k) => S.entries.some((e) => e.kind === k));
  return `<div class="title-row"><div><div class="h1">Журнал</div><div class="sub">${S.entries.length} записей</div></div>
    <button class="icon-btn" data-act="journal-search" aria-label="Поиск">${icon('search', 22)}</button></div>
    ${J.search ? `<div class="searchbox">${icon('search', 18)}<input class="input" id="jq" type="search" placeholder="Поиск: станция, мастерская, заметка…" value="${esc(J.q)}" data-input="journal-q" autocomplete="off"></div>` : ''}
    ${used.length > 1 ? `<div class="chips scroll" style="margin-bottom:4px">${chip('Все', J.kind === 'all', 'data-act="journal-kind" data-kind="all"')}${used.map((k) => chip(kindLabelShort[k], J.kind === k, `data-act="journal-kind" data-kind="${k}" style="--c:var(--c-${k})"`, `<span class="dot" style="--c:var(--c-${k})"></span>`).replace('class="chip', 'class="chip k')).join('')}</div>` : ''}
    <div id="journal-list">${journalList()}</div>`;
}
