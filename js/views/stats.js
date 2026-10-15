import { S } from '../store.js';
import { KINDS, KIND_ORDER, kindLabelShort } from '../consts.js';
import { icon } from '../icons.js';
import { esc, num, int, moneyR, today, ym, addMonths, addDays, monthName, monthTitle, parse, dateShort, plural } from '../util.js';
import { totalsByKind, sum, fuelStats, monthly, byStation, kmBetween, inRange, sortAsc } from '../calc.js';
import { stackedColumns, lineChart } from '../charts.js';
import { empty } from '../ui.js';

export const ST = { period: '6m' };
const PERIODS = [['3m', '3 мес'], ['6m', '6 мес'], ['12m', 'Год'], ['all', 'Всё']];

function range() {
  const now = today(), es = S.entries;
  let n = { '3m': 3, '6m': 6, '12m': 12 }[ST.period];
  if (!n) {
    const first = es.length ? ym(sortAsc(es)[0].date) : ym(now);
    n = 1; while (n < 36 && ym(addMonths(now, -n)) >= first) n++;
  }
  const from = ym(addMonths(now, -(n - 1))) + '-01';
  return { n, from, to: now, prevFrom: ym(addMonths(from, -n)) + '-01', prevTo: addDays(from, -1) };
}

export function renderStats() {
  const es = S.entries;
  const head = `<div class="title-row"><div><div class="h1">Статистика</div><div class="sub">Куда уходят деньги</div></div></div>`;
  if (es.length < 1) return head + empty('chart-column', 'Пока нечего считать', 'Добавьте пару заправок и расходов — здесь появятся графики и средние цифры.');
  const { n, from, to, prevFrom, prevTo } = range();
  const cur = es.filter((e) => inRange(e, from, to)), prev = es.filter((e) => inRange(e, prevFrom, prevTo));
  const total = sum(cur, (e) => e.total), prevTotal = sum(prev, (e) => e.total);
  const dist = kmBetween(from, to);
  const monthsSpan = Math.max(1, n - 1 + parse(to).getDate() / 30);
  const byK = totalsByKind(cur);
  const kinds = KIND_ORDER.filter((k) => byK[k] > 0);
  const fs = fuelStats(es, from, to);
  const pct = ST.period !== 'all' && prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : null;

  const seg = `<div class="seg" style="margin-bottom:16px">${PERIODS.map(([k, l]) => `<button data-act="stats-period" data-p="${k}" class="${ST.period === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const hero = `<div class="hero">
    <div class="eyebrow">Потрачено · ${ST.period === 'all' ? 'всё время' : ST.period === '12m' ? '12 месяцев' : n + ' ' + plural(n, 'месяц', 'месяца', 'месяцев')}</div>
    <div class="hero-num">${int(total)}<small>₪</small></div>
    <div class="hero-delta">${pct != null ? `<span class="pill ${pct > 0 ? 'up' : 'down'}">${icon(pct > 0 ? 'arrow-up-right' : 'arrow-down-right', 14)}${Math.abs(pct)}%</span><span>к прошлому такому же периоду</span>` : `<span>${cur.length} ${plural(cur.length, 'запись', 'записи', 'записей')}</span>`}</div>
    <div class="tiles" style="margin-top:18px;gap:8px">
      <div class="hero-mini"><b>${moneyR(total / monthsSpan)}</b><span>в месяц</span></div>
      <div class="hero-mini"><b>${dist && dist > 100 ? num(total / dist, 2) + ' ₪' : '—'}</b><span>за 1 км</span></div>
      <div class="hero-mini"><b>${dist ? int(dist) + ' км' : '—'}</b><span>проехали</span></div></div>
  </div>`;

  const monthCard = `<div class="section"><div class="card chart-card"><h3>По месяцам</h3><div class="sub">Нажмите на столбик</div>
    <div class="readout" id="mo-read"></div><div class="chart" id="ch-month"></div>
    <div class="legend">${kinds.map((k) => `<span style="--c:var(--c-${k})"><i></i>${kindLabelShort[k]}</span>`).join('')}</div>
    <details class="tbl"><summary>Таблица по месяцам</summary><div id="mo-table"></div></details></div></div>`;

  const max = Math.max(...kinds.map((k) => byK[k]), 1);
  const cats = `<div class="section"><div class="section-head"><h2>Категории</h2></div><div class="card"><div class="hbars">${kinds.sort((a, b) => byK[b] - byK[a]).map((k) => `
    <div class="k-${k}"><div class="hbar-top"><span><i class="dot"></i>${esc(KINDS[k].label)}</span><b>${moneyR(byK[k])}<span class="pc">${Math.round((byK[k] / total) * 100)}%</span></b></div>
    <div class="hbar-track"><div class="hbar-fill" style="width:${(byK[k] / max) * 100}%"></div></div></div>`).join('')}</div></div></div>`;

  let fuel = '';
  if (fs.fills) {
    const st = byStation(es, from, to);
    fuel = `<div class="section"><div class="section-head"><h2>Топливо</h2><span class="muted" style="font-size:13px">${fs.fills} ${plural(fs.fills, 'заправка', 'заправки', 'заправок')}</span></div>
      <div class="tiles four">
        <div class="tile"><div class="t-l">Залито</div><div class="t-v">${int(fs.liters)}<small>л</small></div><div class="t-s">${moneyR(fs.spent)}</div></div>
        <div class="tile"><div class="t-l">Средняя цена</div><div class="t-v">${num(fs.avgPpl, 2)}<small>₪/л</small></div><div class="t-s">взвешенная</div></div>
        <div class="tile"><div class="t-l">Расход</div><div class="t-v">${fs.l100 ? num(fs.l100, 1) : '—'}<small>л/100 км</small></div><div class="t-s">${fs.l100 ? 'средний' : 'нужны полные баки с пробегом'}</div></div>
        <div class="tile"><div class="t-l">Топливо на 100 км</div><div class="t-v">${fs.per100 ? int(fs.per100) : '—'}<small>₪</small></div><div class="t-s">${fs.per100 ? num(fs.per100 / 100, 2) + ' ₪ за км' : ''}</div></div></div>
      <div class="card chart-card" style="margin-top:12px"><h3>Цена за литр</h3><div class="sub">по каждой заправке</div><div class="readout" id="pp-read"></div><div class="chart" id="ch-price"></div></div>
      ${fs.cons.size && [...fs.cons.keys()].some((id) => es.find((e) => e.id === id && inRange(e, from, to))) ? `<div class="card chart-card" style="margin-top:12px"><h3>Расход на баке</h3><div class="sub">литров на 100 км между полными заправками</div><div class="readout" id="cs-read"></div><div class="chart" id="ch-cons"></div></div>` : ''}
      ${st.length > 1 ? `<div class="card chart-card" style="margin-top:12px"><h3>Где дешевле</h3><div class="sub">средняя цена по заправкам</div>
        <table class="table" style="margin-top:8px"><tr><th>Станция</th><th>Раз</th><th>₪/л</th><th>Всего</th></tr>${st.map((r, i) => `<tr class="${i === 0 ? 'best' : ''}"><td>${esc(r.name)}</td><td>${r.n}</td><td><b>${num(r.ppl, 2)}</b></td><td>${moneyR(r.spent)}</td></tr>`).join('')}</table></div>` : ''}</div>`;
  }
  return head + seg + hero + monthCard + cats + fuel;
}

export function mountStats(root) {
  const es = S.entries; if (!es.length) return;
  const { n, from, to } = range();
  const rows = monthly(es, ym(from), ym(to));
  const read = root.querySelector('#mo-read');
  stackedColumns(root.querySelector('#ch-month'), rows, {
    onSelect: (r) => {
      const parts = KIND_ORDER.filter((k) => r.byKind[k] > 0).sort((a, b) => r.byKind[b] - r.byKind[a]).slice(0, 3).map((k) => `${kindLabelShort[k]} ${int(r.byKind[k])}`);
      read.innerHTML = `<b>${moneyR(r.total)}</b><span>${esc(monthTitle(r.key))}${parts.length ? ' · ' + esc(parts.join(' · ')) : ' · без расходов'}</span>`;
    },
  });
  const tbl = root.querySelector('#mo-table');
  if (tbl) tbl.innerHTML = `<table class="table"><tr><th>Месяц</th><th>Топливо</th><th>Другое</th><th>Итого</th></tr>${[...rows].reverse().map((r) => `<tr><td>${esc(monthTitle(r.key))}</td><td>${int(r.byKind.fuel)}</td><td>${int(r.total - r.byKind.fuel)}</td><td><b>${int(r.total)}</b></td></tr>`).join('')}</table>`;

  const fs = fuelStats(es, from, to);
  const fills = sortAsc(es.filter((e) => e.kind === 'fuel' && e.ppl > 0 && inRange(e, from, to))).slice(-60);
  const pr = root.querySelector('#ch-price');
  if (pr) lineChart(pr, fills.map((e) => ({ t: Date.parse(e.date), v: e.ppl, label: e.date, e })), {
    onSelect: (p) => (root.querySelector('#pp-read').innerHTML = `<b>${num(p.v, 2)} ₪/л</b><span>${dateShort(p.label)}${p.e.station ? ' · ' + esc(p.e.station) : ''} · ${num(p.e.liters, 1)} л</span>`),
  });
  const cs = root.querySelector('#ch-cons');
  if (cs) {
    const pts = sortAsc(es.filter((e) => fs.cons.has(e.id) && inRange(e, from, to))).slice(-40).map((e) => ({ t: Date.parse(e.date), v: fs.cons.get(e.id).l100, label: e.date, km: fs.cons.get(e.id).km }));
    lineChart(cs, pts, { ref: fs.l100, color: 'var(--c-fuel)', fmt: (v) => num(v, 1), onSelect: (p) => (root.querySelector('#cs-read').innerHTML = `<b>${num(p.v, 1)} л/100 км</b><span>${dateShort(p.label)} · проехали ${int(p.km)} км</span>`) });
  }
}
