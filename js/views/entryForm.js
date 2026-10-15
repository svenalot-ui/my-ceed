import { S, saveEntry, saveIssue, currentOdo } from '../store.js';
import { KINDS, KIND_ORDER, TITLE_CHIPS, DOC_TYPES, STATIONS, FUELS } from '../consts.js';
import { icon } from '../icons.js';
import { esc, uid, today, addMonths, parseNum, round, inputVal, num, int, km, money } from '../util.js';
import { page, sheet, swap, closeLayer, toast, viewPhotos, chip } from '../ui.js';
import { shrink, savePhoto, deletePhotos, hydratePhotos } from '../photos.js';
import { consumption } from '../calc.js';
import { recognize } from '../ocr.js';
import { openIssueForm } from './issues.js';

export function openAddMenu() {
  const others = KIND_ORDER.filter((k) => k !== 'fuel');
  const layer = sheet(`<h2>Что добавить?</h2>
    <button class="add-fuel" data-kind="fuel"><span class="ph-ic">${icon('camera', 26)}</span><span><b>Заправка</b><small>Сфотографируйте чек — посчитаю сам</small></span></button>
    <div class="add-grid">${others.map((k) => `<button class="add-tile k-${k}" data-kind="${k}"><span class="row-ic">${icon(KINDS[k].icon, 22)}</span><b>${esc(KINDS[k].label)}</b></button>`).join('')}</div>
    <button class="add-issue" data-issue>${icon('triangle-alert', 22)}<span><b>Записать поломку</b><small>Стук, скрип, индикатор — чтобы рассказать мастеру</small></span>${icon('chevron-right', 20)}</button>`);
  layer.el.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-kind]');
    if (b) return swap(layer, (o) => openEntryForm({ kind: b.dataset.kind, ...o }));
    if (ev.target.closest('[data-issue]')) swap(layer, (o) => openIssueForm(o));
  });
}

const numField = (name, label, unit, val) => `<div class="num-field" data-f="${name}"><label>${label}</label>
  <input class="input" name="${name}" inputmode="decimal" autocomplete="off" placeholder="0" value="${val}"><span class="unit">${unit}</span></div>`;

export function openEntryForm({ kind = 'fuel', entry = null, issueId = null, prefill = {}, replace = false } = {}) {
  const car = S.settings.car;
  const d = entry ? structuredClone(entry) : {
    id: uid(), kind, date: today(), odo: null, total: null, liters: null, ppl: null, full: true, missed: false,
    station: '', fuel: car.fuel || '95', title: '', note: '', place: '', photos: [], docType: null, validUntil: null, ...prefill,
  };
  kind = d.kind;
  const K = KINDS[kind], isFuel = kind === 'fuel';
  const added = [], removed = [];
  let saved = false, validAuto = !entry?.validUntil, dateTouched = !!entry, ocrBlob = null;
  const order = entry && isFuel ? ['liters', 'total'] : [];
  let autoField = null;
  const resolves = new Set(entry ? S.issues.filter((i) => i.fixedBy === entry.id).map((i) => i.id) : issueId ? [issueId] : []);
  const issueChoices = S.issues.filter((i) => i.status !== 'fixed' || (entry && i.fixedBy === entry.id));
  const lastOdo = currentOdo();

  const stationList = [...STATIONS, ...S.settings.stations.filter((s) => !STATIONS.includes(s)), ...(d.station && !STATIONS.includes(d.station) && !S.settings.stations.includes(d.station) ? [d.station] : [])];
  const showPlace = ['service', 'repair', 'tires', 'other'].includes(kind);
  const showOdo = isFuel || ['service', 'repair', 'tires'].includes(kind);

  const html = `<div><div class="page-bar"><div class="side"><button class="icon-btn flat" data-act="close" aria-label="Закрыть">${icon('x', 24)}</button></div>
    <h2>${entry ? 'Изменить · ' : ''}${esc(K.label)}</h2><div class="side"></div></div>
  <div class="page-body"><form class="form" autocomplete="off" onsubmit="return false">
    <input class="sr" type="file" id="file" accept="image/*" multiple>
    <div class="field"><div id="ph"></div><div id="ocr"></div></div>

    ${isFuel ? `<div><div class="triple">${numField('total', 'Сумма', '₪', inputVal(d.total))}${numField('liters', 'Литры', 'л', inputVal(d.liters))}${numField('ppl', 'Цена', '₪/л', inputVal(d.ppl, 3))}</div>
      <div class="hint" id="trihint">Заполните любые два — третье посчитается само.</div></div>`
      : `<div class="field"><label>Сумма</label><div class="num-field" data-f="total"><input class="input" name="total" inputmode="decimal" placeholder="0" value="${inputVal(d.total)}" style="height:64px;font-size:26px;font-weight:720"><span class="unit" style="bottom:21px">₪</span></div></div>`}

    <div class="${showOdo ? 'grid2' : ''}">
      <div class="field"><label>Дата</label><input class="input" type="date" name="date" value="${d.date}" max="${today()}"></div>
      ${showOdo ? `<div class="field"><label>Пробег, км</label><input class="input" name="odo" inputmode="numeric" placeholder="${lastOdo ? int(lastOdo) : 'например 87000'}" value="${d.odo ?? ''}"></div>` : ''}
    </div>
    <div class="hint" id="odohint" style="margin-top:-14px;display:none"></div>

    ${isFuel ? `
    <div class="field"><label>Заправка</label><div class="chips" id="stations">${stationList.map((s) => chip(s, d.station === s, `data-st="${esc(s)}"`)).join('')}${chip('Другая…', false, 'data-st-other')}</div>
      <input class="input" name="station" placeholder="Название заправки" style="margin-top:10px;display:none" value="${esc(d.station && !stationList.includes(d.station) ? d.station : '')}"></div>
    <div class="field"><label>Топливо</label><div class="seg" id="fuels">${FUELS.map((f) => `<button type="button" data-fuel="${f.key}" class="${d.fuel === f.key ? 'on' : ''}">${f.label}</button>`).join('')}</div></div>
    <button type="button" class="switch-row" id="full"><span><b>Заправил до полного бака</b><small>Нужно, чтобы точно считать расход</small></span><span class="sw ${d.full ? 'on' : ''}"></span></button>
    <div class="live" id="live"></div>
    <button type="button" class="switch-row" id="missed"><span><b>Пропустил заправку в журнале</b><small>Если между записями был ещё бак — расход не посчитаем зря</small></span><span class="sw ${d.missed ? 'on' : ''}"></span></button>`
    : kind === 'docs' ? `
    <div class="field"><label>Что оформили</label><div class="chips" id="doctypes">${DOC_TYPES.map((t) => chip(t.title, d.docType === t.key, `data-doc="${t.key}"`)).join('')}</div></div>
    <div class="field"><label>Действует до</label><input class="input" type="date" name="validUntil" value="${d.validUntil || ''}"><div class="hint">Напомню заранее, когда подходит срок.</div></div>`
    : `<div class="field"><label>${kind === 'repair' ? 'Что чинили' : 'Что сделали'}</label><input class="input" name="title" placeholder="${kind === 'service' ? 'Например: замена масла' : 'Коротко, своими словами'}" value="${esc(d.title)}">
      ${TITLE_CHIPS[kind] ? `<div class="chips" id="tchips" style="margin-top:10px">${TITLE_CHIPS[kind].map((t) => chip(t, false, `data-t="${esc(t)}"`)).join('')}</div>` : ''}</div>`}

    ${showPlace ? `<div class="field"><label>Где</label><input class="input" name="place" placeholder="Мастерская, магазин…" value="${esc(d.place || '')}"></div>` : ''}

    ${(kind === 'service' || kind === 'repair') && issueChoices.length ? `<div class="field"><label>Это починило поломки из списка?</label><div class="card flat" style="padding:4px 0">${issueChoices.map((i) => `<button type="button" class="setrow" data-resolve="${i.id}" style="padding:12px 16px"><span class="cb ${resolves.has(i.id) ? 'on' : ''}">${icon('check', 16)}</span><span class="row-main"><b style="font-weight:600;font-size:15.5px">${esc(i.title)}</b></span></button>`).join('')}</div></div>` : ''}

    <div class="field"><label>Заметка</label><textarea class="textarea" name="note" placeholder="Что важно запомнить" style="min-height:76px">${esc(d.note || '')}</textarea></div>
  </form></div>
  <div class="page-foot"><button class="btn primary block" id="save">${icon('check', 20)} Сохранить</button></div></div>`;

  const layer = page(html, { replace, onClose: () => { if (!saved) deletePhotos(added); } });
  const el = layer.el, F = (n) => el.querySelector(`[name="${n}"]`);
  const $ = (s) => el.querySelector(s);

  /* ---------- photos ---------- */
  function renderPhotos() {
    const ph = $('#ph');
    if (!d.photos.length) {
      ph.innerHTML = `<label class="photo-hero" for="file"><span class="ph-ic">${icon('camera', 26)}</span><span><b>${isFuel ? 'Сфотографировать чек' : 'Фото чека или счёта'}</b><span>${isFuel ? 'Литры, цена и сумма заполнятся сами' : 'Пригодится для гарантии и споров'}</span></span></label>`;
    } else {
      const big = isFuel && d.photos.length === 1;
      ph.innerHTML = `<div class="thumbs">${d.photos.map((id) => `<div class="thumb${big ? ' big' : ''}" data-viewer="${id}"><img data-photo="${id}" alt="Фото"><button type="button" class="x" data-rm="${id}" aria-label="Убрать фото">${icon('x', 14)}</button></div>`).join('')}
        <label class="thumb add${big ? '' : ''}" for="file" style="${big ? 'width:100%;height:52px;border-radius:16px;gap:8px;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:14.5px' : ''}">${icon('camera', big ? 20 : 24)}${big ? 'Переснять / добавить' : ''}</label></div>`;
      hydratePhotos(ph);
    }
  }
  $('#file').addEventListener('change', async (ev) => {
    const files = [...ev.target.files]; ev.target.value = '';
    if (!files.length) return;
    const first = !d.photos.length;
    for (const f of files) {
      try { const b = await shrink(f); const id = await savePhoto(b); added.push(id); d.photos.push(id); if (!ocrBlob) ocrBlob = b; } catch { toast('Не удалось открыть фото'); }
    }
    renderPhotos();
    if (isFuel && S.settings.ocr && ocrBlob && (first || !d.liters)) runOcr(ocrBlob);
  });
  el.addEventListener('click', (ev) => {
    const rm = ev.target.closest('[data-rm]');
    if (rm) { ev.stopImmediatePropagation(); const id = rm.dataset.rm; d.photos = d.photos.filter((x) => x !== id); if (added.includes(id)) { deletePhotos([id]); added.splice(added.indexOf(id), 1); } else removed.push(id); ocrBlob = null; setOcr(null); renderPhotos(); return; }
    const v = ev.target.closest('[data-viewer]');
    if (v) viewPhotos(d.photos, d.photos.indexOf(v.dataset.viewer));
  });

  /* ---------- OCR ---------- */
  function setOcr(state, title = '', sub = '', p = 0, retry = false) {
    const o = $('#ocr');
    if (!state) { o.innerHTML = ''; return; }
    o.innerHTML = `<div class="ocr-status ${state}">${state === 'work' ? '<div class="spin"></div>' : icon(state === 'ok' ? 'sparkles' : 'info', 22)}
      <div class="grow"><b>${esc(title)}</b>${sub ? `<span class="muted" style="font-size:13px">${esc(sub)}</span>` : ''}${state === 'work' ? `<div class="bar"><i style="width:${Math.round(p * 100)}%"></i></div>` : ''}</div>
      ${retry ? '<button type="button" class="btn sm soft" data-ocr-retry>Ещё раз</button>' : ''}</div>`;
    o.querySelector('[data-ocr-retry]')?.addEventListener('click', () => ocrBlob && runOcr(ocrBlob));
  }
  async function runOcr(blob) {
    setOcr('work', 'Читаю чек…', 'Первый раз загрузка займёт ~10 секунд', 0.02);
    try {
      const r = await recognize(blob, (label, p) => setOcr('work', label, 'Первый раз загрузка займёт ~10 секунд', p));
      if (!r.total) return setOcr('bad', 'Не нашёл литры и сумму', 'Фото сохранено — введите цифры вручную', 0, true);
      d.liters = r.liters; d.ppl = r.ppl; d.total = r.total;
      order.length = 0; order.push('liters', 'total'); autoField = null;
      ['total', 'liters', 'ppl'].forEach((n) => { F(n).value = inputVal(d[n], n === 'ppl' ? 3 : 2); F(n).closest('.num-field').classList.remove('auto'); F(n).closest('.num-field').classList.add('ocr'); });
      if (r.date && !dateTouched) { d.date = r.date; F('date').value = r.date; }
      if (r.station && !d.station) pickStation(r.station);
      if (r.fuel) pickFuel(r.fuel);
      setOcr('ok', 'Прочитал с чека', `${num(r.liters, 2)} л × ${num(r.ppl, 2)} ₪ = ${num(r.total, 2)} ₪ — проверьте цифры`);
      refresh();
    } catch {
      setOcr('bad', navigator.onLine ? 'Не получилось прочитать чек' : 'Нет интернета для распознавания', 'Фото сохранено — введите цифры вручную', 0, navigator.onLine);
    }
  }

  /* ---------- fuel maths: any two of three → third ---------- */
  const TF = ['total', 'liters', 'ppl'];
  function recalc() {
    TF.forEach((n) => F(n)?.closest('.num-field').classList.remove('auto', 'ocr'));
    const last2 = order.slice(-2);
    if (last2.length < 2) {
      if (autoField) { d[autoField] = null; F(autoField).value = ''; autoField = null; }
      return;
    }
    const c = TF.find((x) => !last2.includes(x)), { liters: L, ppl: P, total: T } = d;
    let v = null;
    if (c === 'total' && L > 0 && P > 0) v = round(L * P, 2);
    if (c === 'liters' && T > 0 && P > 0) v = round(T / P, 2);
    if (c === 'ppl' && T > 0 && L > 0) v = round(T / L, 3);
    d[c] = v; F(c).value = v == null ? '' : inputVal(v, c === 'ppl' ? 3 : 2);
    autoField = c; if (v != null) F(c).closest('.num-field').classList.add('auto');
  }

  /* ---------- stations / fuels ---------- */
  function pickStation(s) {
    d.station = s;
    el.querySelectorAll('[data-st]').forEach((b) => b.classList.toggle('on', b.dataset.st === s));
    if (!stationList.includes(s)) { F('station').style.display = ''; F('station').value = s; }
  }
  function pickFuel(k) { d.fuel = k; el.querySelectorAll('[data-fuel]').forEach((b) => b.classList.toggle('on', b.dataset.fuel === k)); }

  /* ---------- live feedback ---------- */
  function refresh() {
    if (isFuel) {
      const lv = $('#live');
      const h = $('#trihint');
      const warn = [];
      if (d.liters > (car.tank || 50) * 1.1) warn.push(`Больше объёма бака (${car.tank} л) — проверьте литры`);
      if (d.ppl && (d.ppl < 4 || d.ppl > 12)) warn.push('Цена за литр выглядит странно');
      h.className = 'hint' + (warn.length ? ' warn' : ''); h.textContent = warn[0] || 'Заполните любые два — третье посчитается само.';
      let t = '';
      if (!d.full) t = `${icon('info', 20)}<span>Неполный бак — расход посчитаю со следующей полной заправки.</span>`;
      else if (!(d.liters > 0)) t = '';
      else if (d.odo == null) t = `${icon('gauge', 20)}<span>Укажите пробег — и я посчитаю расход на этом баке.</span>`;
      else {
        const c = consumption([...S.entries.filter((x) => x.id !== d.id), { ...d, kind: 'fuel' }]).get(d.id);
        t = c ? `<div class="row-ic" style="color:var(--c-fuel)">${icon('fuel', 22)}</div><span><b>${num(c.l100, 1)} л/100 км</b><br>проехали ${km(c.km)} · топливо ${num((c.l100 / 100) * (d.ppl || 0), 2)} ₪/км</span>`
          : `${icon('info', 20)}<span>Расход появится после второй полной заправки с пробегом.</span>`;
      }
      lv.style.display = t ? '' : 'none'; lv.innerHTML = t;
    }
    const oh = $('#odohint');
    if (oh && d.odo != null) {
      const prev = S.entries.filter((x) => x.id !== d.id && x.odo != null && x.date <= d.date).reduce((m, x) => Math.max(m, x.odo), 0);
      const next = S.entries.filter((x) => x.id !== d.id && x.odo != null && x.date > d.date).reduce((m, x) => Math.min(m, x.odo), Infinity);
      let msg = '';
      if (prev && d.odo < prev) msg = `Меньше, чем раньше (${int(prev)} км). Проверьте цифры.`;
      else if (next !== Infinity && d.odo > next) msg = `Больше, чем в более поздней записи (${int(next)} км).`;
      else if (prev && d.odo - prev > 3000) msg = `+${int(d.odo - prev)} км с прошлой записи — всё верно?`;
      oh.style.display = msg ? '' : 'none'; oh.textContent = msg; oh.className = 'hint warn';
    } else if (oh) oh.style.display = 'none';
  }

  /* ---------- events ---------- */
  el.addEventListener('input', (ev) => {
    const n = ev.target.name; if (!n) return;
    if (['total', 'liters', 'ppl', 'odo'].includes(n)) ev.target.value = ev.target.value.replace(n === 'odo' ? /[^\d]/g : /[^\d.,]/g, '');
    if (TF.includes(n) && isFuel) {
      d[n] = parseNum(ev.target.value);
      const i = order.indexOf(n); if (i >= 0) order.splice(i, 1);
      if (d[n] != null) order.push(n);
      if (autoField === n) autoField = null;
      ev.target.closest('.num-field').classList.remove('ocr');
      recalc();
    } else if (n === 'total') d.total = parseNum(ev.target.value);
    else if (n === 'odo') d.odo = ev.target.value === '' ? null : parseInt(ev.target.value, 10);
    else if (n === 'date') { d.date = ev.target.value; dateTouched = true; if (kind === 'docs' && validAuto && d.date) { d.validUntil = addMonths(d.date, 12); F('validUntil').value = d.validUntil; } }
    else if (n === 'validUntil') { d.validUntil = ev.target.value || null; validAuto = false; }
    else if (n === 'station') { d.station = ev.target.value.trim(); el.querySelectorAll('[data-st]').forEach((b) => b.classList.remove('on')); }
    else if (n === 'title' || n === 'place' || n === 'note') d[n] = ev.target.value;
    refresh();
  });
  el.addEventListener('click', (ev) => {
    const t = ev.target;
    const st = t.closest('[data-st]');
    if (st) { F('station').style.display = 'none'; return pickStation(st.dataset.st); }
    if (t.closest('[data-st-other]')) { el.querySelectorAll('[data-st]').forEach((b) => b.classList.remove('on')); d.station = ''; const s = F('station'); s.style.display = ''; s.focus(); return; }
    const fu = t.closest('[data-fuel]'); if (fu) return pickFuel(fu.dataset.fuel);
    if (t.closest('#full')) { d.full = !d.full; t.closest('#full').querySelector('.sw').classList.toggle('on', d.full); return refresh(); }
    if (t.closest('#missed')) { d.missed = !d.missed; t.closest('#missed').querySelector('.sw').classList.toggle('on', d.missed); return refresh(); }
    const dc = t.closest('[data-doc]');
    if (dc) {
      const type = DOC_TYPES.find((x) => x.key === dc.dataset.doc);
      d.docType = type.key; d.title = type.title;
      el.querySelectorAll('[data-doc]').forEach((b) => b.classList.toggle('on', b === dc));
      if (validAuto || !d.validUntil) { d.validUntil = addMonths(d.date, 12); F('validUntil').value = d.validUntil; }
      return;
    }
    const tc = t.closest('[data-t]');
    if (tc) {
      const v = tc.dataset.t, inp = F('title'), parts = inp.value.split(',').map((x) => x.trim()).filter(Boolean);
      const i = parts.indexOf(v); if (i >= 0) parts.splice(i, 1); else parts.push(v);
      inp.value = parts.join(', '); d.title = inp.value; tc.classList.toggle('on', i < 0);
      return;
    }
    const rs = t.closest('[data-resolve]');
    if (rs) { const id = rs.dataset.resolve; resolves.has(id) ? resolves.delete(id) : resolves.add(id); rs.querySelector('.cb').classList.toggle('on', resolves.has(id)); }
  });

  $('#save').addEventListener('click', async () => {
    if (isFuel) {
      if (!(d.liters > 0) || !(d.total > 0)) return toast('Укажите хотя бы два значения из трёх: сумма, литры, цена');
      if (!(d.ppl > 0)) d.ppl = round(d.total / d.liters, 3);
    } else if (d.total == null || d.total < 0) return toast('Укажите сумму');
    if (!d.date) return toast('Укажите дату');
    if (kind === 'docs' && !d.title) { d.title = 'Документ'; d.docType ||= 'other'; }
    const e = { ...d, total: round(d.total, 2) };
    if (isFuel) { e.title = 'Заправка'; e.liters = round(d.liters, 2); e.ppl = round(d.ppl, 3); }
    else { delete e.liters; delete e.ppl; delete e.full; delete e.missed; delete e.station; delete e.fuel; if (!e.title) e.title = K.label; }
    if (kind !== 'docs') { delete e.docType; delete e.validUntil; }
    $('#save').disabled = true;
    await saveEntry(e);
    for (const i of issueChoices) {
      const was = i.fixedBy === e.id, now = resolves.has(i.id);
      if (now && !was) await saveIssue({ ...i, status: 'fixed', fixedDate: e.date, fixedBy: e.id });
      else if (!now && was) { const c = { ...i, status: 'open' }; delete c.fixedDate; delete c.fixedBy; await saveIssue(c); }
    }
    if (removed.length) deletePhotos(removed);
    saved = true;
    await closeLayer(el);
    toast(entry ? 'Изменения сохранены' : isFuel ? `Заправка сохранена · ${money(e.total)}` : 'Запись сохранена');
  });

  renderPhotos(); if (!entry) recalc(); refresh();
  return layer;
}
