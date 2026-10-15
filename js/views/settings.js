import { S, saveSettings, logOdo, currentOdo, wipeAll, subscribe } from '../store.js';
import * as db from '../db.js';
import { FUELS } from '../consts.js';
import { icon } from '../icons.js';
import { esc, int, parseNum, today, dateShort, uid, addMonths, num, km } from '../util.js';
import { page, sheet, closeLayer, confirmDialog, toast, applyTheme, swap } from '../ui.js';
import { reminderStatus } from '../store.js';
import { exportJSON, exportCSV, importFile } from '../dataio.js';
import { remIconFor } from './common.js';

function remRow(r) {
  const st = reminderStatus(r);
  const sub = [r.dueDate ? 'до ' + dateShort(r.dueDate) : '', r.dueKm != null ? 'на ' + int(r.dueKm) + ' км' : ''].filter(Boolean).join(' · ');
  const cls = st ? st.state : '';
  return `<button class="rem ${cls}" data-rem="${r.id}" style="width:100%;text-align:left">
    <div class="rem-ring" style="${st ? '' : 'background:var(--surface-2);color:var(--ink-3)'}">${icon(remIconFor(r.key), 22)}</div>
    <div class="row-main"><div class="row-title">${esc(r.title)}</div><div class="row-sub">${sub || 'не задано — нажмите, чтобы указать'}</div></div>${icon('chevron-right', 18)}</button>`;
}

export function openSettings({ anchor } = {}) {
  const c = S.settings.car;
  const html = () => `<div><div class="page-bar"><div class="side"><button class="icon-btn flat" data-act="close" aria-label="Назад">${icon('chevron-left', 24)}</button></div><h2>Настройки</h2><div class="side"></div></div>
  <div class="page-body" id="sbody">
    <div class="section" style="margin-top:6px"><div class="section-head"><h2>Машина</h2></div>
      <div class="card form" style="gap:16px">
        <div class="field"><label>Модель</label><input class="input" data-car="name" value="${esc(c.name)}"></div>
        <div class="grid2"><div class="field"><label>Год</label><input class="input" data-car="year" inputmode="numeric" value="${c.year ?? ''}"></div>
          <div class="field"><label>Номер</label><input class="input" data-car="plate" value="${esc(c.plate)}" placeholder="12-345-67"></div></div>
        <div class="grid2"><div class="field"><label>Бак, л</label><input class="input" data-car="tank" inputmode="decimal" value="${c.tank ?? ''}"></div>
          <div class="field"><label>Топливо</label><select class="select" data-car="fuel">${FUELS.map((f) => `<option value="${f.key}" ${c.fuel === f.key ? 'selected' : ''}>${f.label}</option>`).join('')}</select></div></div>
        <div class="field"><label>Пробег сейчас, км</label><input class="input" data-odo inputmode="numeric" value="${currentOdo() ?? ''}" placeholder="км"></div>
      </div></div>

    <div class="section" id="rem"><div class="section-head"><h2>Напоминания</h2><button class="link" data-rem-new>+ Своё</button></div>
      <div class="list">${S.settings.reminders.map(remRow).join('')}</div>
      <div class="hint">Тест и страховка обновятся сами, когда запишете новую оплату. ТО — когда запишете сервис.</div></div>

    <div class="section"><div class="section-head"><h2>Внешний вид</h2></div>
      <div class="seg" id="theme">${[['auto', 'Авто'], ['light', 'Светлая'], ['dark', 'Тёмная']].map(([k, l]) => `<button data-theme="${k}" class="${S.settings.theme === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <button class="switch-row" id="ocr" style="margin-top:12px"><span><b>Читать чек с фото</b><small>Распознавание цифр на телефоне. Первый раз скачает ~6 МБ</small></span><span class="sw ${S.settings.ocr ? 'on' : ''}"></span></button></div>

    <div class="section"><div class="section-head"><h2>Данные</h2></div>
      <div class="list">
        <button class="setrow" data-exp="json">${icon('download', 22)}<span class="row-main"><b>Резервная копия</b><small>Всё вместе с фото — один файл</small></span>${icon('chevron-right', 18)}</button>
        <button class="setrow" data-exp="json-lite">${icon('download', 22)}<span class="row-main"><b>Копия без фото</b><small>Лёгкий файл</small></span>${icon('chevron-right', 18)}</button>
        <button class="setrow" data-exp="csv">${icon('file-text', 22)}<span class="row-main"><b>Таблица для Excel (CSV)</b><small>Для бухгалтера или своих расчётов</small></span>${icon('chevron-right', 18)}</button>
        <label class="setrow" for="imp">${icon('upload', 22)}<span class="row-main"><b>Загрузить копию</b><small>Восстановить из файла</small></span>${icon('chevron-right', 18)}</label>
      </div><input class="sr" id="imp" type="file" accept=".json,application/json">
      <div class="hint" id="storage" style="margin-top:12px"></div>
      <button class="text-btn danger" data-wipe style="margin-top:6px">Удалить все данные…</button></div>

    <div class="install" style="margin-top:26px"><b>Как поставить на телефон</b>
      iPhone: Safari → «Поделиться» → «На экран Домой».<br>Android: Chrome → ⋮ → «Установить приложение».<br>Данные хранятся только на этом телефоне — делайте копию раз в месяц.</div>
  </div></div>`;

  const layer = page(html());
  const el = layer.el;
  const rerender = () => { const sc = el.querySelector('#sbody').scrollTop; el.innerHTML = html().replace(/^<div>|<\/div>$/g, ''); el.querySelector('#sbody').scrollTop = sc; bindStorage(); };
  const unsub = subscribe(() => { if (document.body.contains(el)) rerender(); else unsub(); });
  async function bindStorage() {
    const st = el.querySelector('#storage'); if (!st) return;
    try {
      const e = await navigator.storage.estimate(), p = await navigator.storage.persisted?.();
      st.textContent = `Занято на телефоне: ${num((e.usage || 0) / 1048576, 1)} МБ${p ? ' · защищено от автоочистки' : ''}`;
    } catch { st.textContent = ''; }
  }
  bindStorage();
  if (anchor) setTimeout(() => el.querySelector('#' + anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);

  el.addEventListener('change', async (ev) => {
    const t = ev.target;
    if (t.dataset.car) {
      let v = t.value.trim();
      if (['year', 'tank'].includes(t.dataset.car)) v = parseNum(v);
      await saveSettings({ car: { [t.dataset.car]: v } }, true); toast('Сохранено', { ms: 1200 });
    }
    if (t.matches('[data-odo]')) { const v = parseInt(t.value.replace(/\D/g, ''), 10); if (v > 0) { await logOdo(v); toast('Пробег обновлён', { ms: 1500 }); } }
    if (t.id === 'imp' && t.files[0]) { await importFile(t.files[0]); t.value = ''; }
  });
  el.addEventListener('click', async (ev) => {
    const t = ev.target;
    const th = t.closest('[data-theme]'); if (th) { await saveSettings({ theme: th.dataset.theme }, true); applyTheme(th.dataset.theme); el.querySelectorAll('[data-theme]').forEach((b) => b.classList.toggle('on', b === th)); return; }
    if (t.closest('#ocr')) { const v = !S.settings.ocr; await saveSettings({ ocr: v }, true); el.querySelector('#ocr .sw').classList.toggle('on', v); return; }
    const rem = t.closest('[data-rem]'); if (rem) return openReminderEditor(rem.dataset.rem);
    if (t.closest('[data-rem-new]')) return openReminderEditor(null);
    const ex = t.closest('[data-exp]'); if (ex) return ex.dataset.exp === 'csv' ? exportCSV() : exportJSON(ex.dataset.exp === 'json');
    if (t.closest('[data-wipe]')) {
      if (!(await confirmDialog({ title: 'Удалить все данные?', text: 'Заправки, расходы, поломки и фото на этом телефоне исчезнут. Сначала лучше сделать резервную копию.', ok: 'Удалить всё', danger: true }))) return;
      if (!(await confirmDialog({ title: 'Точно удалить?', text: 'Вернуть будет нельзя.', ok: 'Да, удалить', danger: true }))) return;
      await wipeAll(); await closeLayer(el); toast('Всё удалено');
    }
  });
  return layer;
}

export function openReminderEditor(id) {
  const base = id ? S.settings.reminders.find((r) => r.id === id) : { id: uid(), key: 'custom', title: '', dueDate: null, dueKm: null };
  const r = { ...base };
  const isService = r.key === 'service';
  const l = sheet(`<h2>${id ? 'Напоминание' : 'Новое напоминание'}</h2><div class="form">
    <div class="field"><label>Что</label><input class="input" name="title" value="${esc(r.title)}" placeholder="Например: замена шин на зимние"></div>
    <div class="field"><label>Срок — дата</label><input class="input" type="date" name="dueDate" value="${r.dueDate || ''}"></div>
    <div class="field"><label>Или по пробегу, км</label><input class="input" name="dueKm" inputmode="numeric" value="${r.dueKm ?? ''}" placeholder="например ${int((currentOdo() || 80000) + 5000)}"></div>
    ${isService ? `<div class="grid2"><div class="field"><label>Интервал, км</label><input class="input" name="everyKm" inputmode="numeric" value="${r.everyKm ?? ''}"></div>
      <div class="field"><label>Интервал, мес</label><input class="input" name="everyMonths" inputmode="numeric" value="${r.everyMonths ?? ''}"></div></div>
      <div class="hint" style="margin-top:-14px">Каждые 15 000 км или год — типично для Kia. Сверьтесь с сервисной книжкой.</div>` : ''}
    <div style="display:flex;gap:10px"><button class="btn primary" style="flex:1" id="ok">Сохранить</button>
      ${id ? `<button class="btn soft" id="clear" aria-label="Очистить">${id && r.key === 'custom' ? icon('trash-2', 20) : 'Сбросить'}</button>` : ''}</div></div>`);
  const el = l.el, F = (n) => el.querySelector(`[name="${n}"]`);
  const commit = async (next) => {
    const list = S.settings.reminders.slice(); const i = list.findIndex((x) => x.id === next.id);
    if (next._del) list.splice(i, 1); else if (i >= 0) list[i] = next; else list.push(next);
    await saveSettings({ reminders: list }); await closeLayer(el);
  };
  el.querySelector('#ok').onclick = () => {
    if (!F('title').value.trim()) return toast('Дайте название');
    const n = { ...r, title: F('title').value.trim(), dueDate: F('dueDate').value || null, dueKm: F('dueKm').value ? parseInt(F('dueKm').value.replace(/\D/g, ''), 10) : null };
    if (isService) { n.everyKm = parseInt(F('everyKm').value, 10) || null; n.everyMonths = parseInt(F('everyMonths').value, 10) || null; }
    commit(n);
  };
  el.querySelector('#clear')?.addEventListener('click', () => (r.key === 'custom' ? commit({ ...r, _del: true }) : commit({ ...r, dueDate: null, dueKm: null })));
}

/* ================= first run ================= */
export function openOnboarding() {
  const c = S.settings.car;
  const html = `<div><div class="page-body" style="padding-top:calc(var(--sat) + 24px)">
    <div class="onb-hero"><img class="logo" src="icons/icon-192.png" alt=""><h1>Мой Сид</h1><p>Расходы, заправки и поломки вашей машины — в одном месте. Пара вопросов для старта:</p></div>
    <div class="form">
      <div class="grid2"><div class="field"><label>Машина</label><input class="input" name="name" value="${esc(c.name)}"></div><div class="field"><label>Год</label><input class="input" name="year" inputmode="numeric" value="${c.year}"></div></div>
      <div class="grid2"><div class="field"><label>Пробег сейчас, км</label><input class="input" name="odo" inputmode="numeric" placeholder="85000"></div><div class="field"><label>Номер (необязательно)</label><input class="input" name="plate" placeholder="12-345-67"></div></div>
      <div class="field"><label>Бак, литров</label><input class="input" name="tank" inputmode="decimal" value="${c.tank}"><div class="hint">Смотрите в инструкции — нужен, чтобы ловить опечатки.</div></div>
      <div class="sep"></div>
      <div class="lbl" style="margin:0 2px -8px">Напомню заранее — когда истекает:</div>
      <div class="field"><label>Тест + лицензия (טסט)</label><input class="input" type="date" name="test"></div>
      <div class="grid2"><div class="field"><label>Страховка обязательная</label><input class="input" type="date" name="ins_m"></div><div class="field"><label>Комплексная</label><input class="input" type="date" name="ins_c"></div></div>
      <div class="field"><label>Последнее ТО было на, км</label><input class="input" name="svc" inputmode="numeric" placeholder="если помните"></div>
    </div></div>
    <div class="page-foot"><button class="btn ghost" id="skip" style="flex:0 0 auto">Позже</button><button class="btn primary" id="go">Поехали</button></div></div>`;
  const layer = page(html), el = layer.el, F = (n) => el.querySelector(`[name="${n}"]`);
  const finish = async (save) => {
    const patch = { onboarded: true };
    if (save) {
      patch.car = { name: F('name').value.trim() || c.name, year: parseInt(F('year').value, 10) || c.year, plate: F('plate').value.trim(), tank: parseNum(F('tank').value) || c.tank };
      const rs = S.settings.reminders.map((r) => ({ ...r }));
      ['test', 'ins_m', 'ins_c'].forEach((k) => { const v = F(k).value; if (v) rs.find((r) => r.key === k).dueDate = v; });
      const svc = parseInt(F('svc').value.replace(/\D/g, ''), 10);
      if (svc) { const r = rs.find((x) => x.key === 'service'); r.lastKm = svc; r.dueKm = svc + (r.everyKm || 15000); }
      patch.reminders = rs;
      const odo = parseInt(F('odo').value.replace(/\D/g, ''), 10);
      await saveSettings(patch, true);
      if (odo > 0) await logOdo(odo); else await saveSettings({});
    } else await saveSettings(patch);
    await closeLayer(el);
  };
  el.querySelector('#go').onclick = () => finish(true);
  el.querySelector('#skip').onclick = () => finish(false);
  return layer;
}
