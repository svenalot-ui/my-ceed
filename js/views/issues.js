import { S, saveIssue, removeIssue, restoreIssue, saveEntry, openIssues, currentOdo } from '../store.js';
import { SEVERITY, AREAS, CONDITIONS, SYMPTOMS, LIGHTS, byKey } from '../consts.js';
import { icon } from '../icons.js';
import { esc, uid, today, dateFull, dateShort, km, plural, money, parseNum, int } from '../util.js';
import { page, sheet, swap, closeLayer, toast, viewPhotos, confirmDialog, chip, empty } from '../ui.js';
import { shrink, savePhoto, deletePhotos, hydratePhotos } from '../photos.js';
import { issueCard, sevPill, thumbsHTML } from './common.js';
import { openEntry } from './detail.js';

export const I = { tab: 'open' };

export function renderIssues() {
  const open = openIssues(), fixed = S.issues.filter((i) => i.status === 'fixed');
  const list = (I.tab === 'open' ? open : fixed).sort((a, b) => (I.tab === 'open' ? ['urgent', 'fix', 'low'].indexOf(a.severity) - ['urgent', 'fix', 'low'].indexOf(b.severity) : 0) || (a.date < b.date ? 1 : -1));
  return `<div class="title-row"><div><div class="h1">Поломки</div><div class="sub">Заметил — записал — показал мастеру</div></div>
    <button class="icon-btn" data-act="issue-new" aria-label="Добавить поломку">${icon('plus', 22)}</button></div>
    ${open.length ? `<button class="btn dark block" data-act="mechanic" style="margin-bottom:16px;height:56px">${icon('stethoscope', 22)} Показать мастеру · ${open.length}</button>` : ''}
    <div class="seg" style="margin-bottom:16px"><button data-act="issues-tab" data-tab="open" class="${I.tab === 'open' ? 'on' : ''}">Открытые · ${open.length}</button><button data-act="issues-tab" data-tab="fixed" class="${I.tab === 'fixed' ? 'on' : ''}">Исправлено · ${fixed.length}</button></div>
    ${list.length ? list.map(issueCard).join('') : I.tab === 'open'
      ? empty('circle-check', 'Всё в порядке', 'Появился стук, скрип или загорелась лампочка? Запишите — к приезду к мастеру ничего не забудется.', `<button class="btn primary" data-act="issue-new">${icon('plus', 20)} Записать поломку</button>`)
      : empty('wrench', 'Пока пусто', 'Здесь будут поломки, которые вы уже починили.')}`;
}

/* ================= form ================= */
export function openIssueForm({ issue = null, replace = false } = {}) {
  const d = issue ? structuredClone(issue) : { id: uid(), title: '', status: 'open', severity: 'fix', area: null, symptoms: [], conditions: [], lights: [], desc: '', date: today(), odo: currentOdo(), photos: [], mechanic: '' };
  const added = [], removed = []; let saved = false;
  const group = (name, label, list, multi) => `<div class="field"><label>${label}</label><div class="chips" data-group="${name}">${list.map((x) => chip(x.ru, multi ? d[name].includes(x.key) : d[name] === x.key, `data-k="${x.key}"`)).join('')}</div></div>`;
  const html = `<div><div class="page-bar"><div class="side"><button class="icon-btn flat" data-act="close" aria-label="Закрыть">${icon('x', 24)}</button></div><h2>${issue ? 'Изменить поломку' : 'Новая поломка'}</h2><div class="side"></div></div>
  <div class="page-body"><form class="form" autocomplete="off" onsubmit="return false">
    <input class="sr" type="file" id="file" accept="image/*" multiple>
    <div class="field"><label>Что случилось?</label><input class="input" name="title" placeholder="Например: стук спереди слева" value="${esc(d.title)}"></div>
    <div class="field"><label>Насколько срочно</label><div class="seg" id="sev">${Object.entries(SEVERITY).map(([k, v]) => `<button type="button" data-sev="${k}" class="${d.severity === k ? 'on' : ''}">${v.short}</button>`).join('')}</div>
      <div class="hint" id="sevhint">${esc(SEVERITY[d.severity].ru)}</div></div>
    ${group('area', 'Где', AREAS, false)}
    ${group('symptoms', 'Что именно (можно несколько)', SYMPTOMS, true)}
    ${group('conditions', 'Когда проявляется', CONDITIONS, true)}
    ${group('lights', 'Горит на панели', LIGHTS, true)}
    <div class="field"><label>Подробности</label><textarea class="textarea" name="desc" placeholder="Когда началось, что делали до этого, как часто повторяется">${esc(d.desc)}</textarea></div>
    <div class="field"><label>Фото</label><div id="ph"></div></div>
    <div class="grid2"><div class="field"><label>Дата</label><input class="input" type="date" name="date" value="${d.date}" max="${today()}"></div>
      <div class="field"><label>Пробег, км</label><input class="input" name="odo" inputmode="numeric" value="${d.odo ?? ''}" placeholder="км"></div></div>
  </form></div>
  <div class="page-foot"><button class="btn primary block" id="save">${icon('check', 20)} Сохранить</button></div></div>`;
  const layer = page(html, { replace, onClose: () => { if (!saved) deletePhotos(added); } });
  const el = layer.el, F = (n) => el.querySelector(`[name="${n}"]`);

  function renderPhotos() {
    el.querySelector('#ph').innerHTML = `<div class="thumbs">${d.photos.map((id) => `<div class="thumb" data-viewer="${id}"><img data-photo="${id}" alt="Фото"><button type="button" class="x" data-rm="${id}" aria-label="Убрать">${icon('x', 14)}</button></div>`).join('')}<label class="thumb add" for="file">${icon('camera', 24)}</label></div>
      ${d.photos.length ? '' : '<div class="hint">Фото лампочек, течи, повреждений — мастеру проще понять.</div>'}`;
    hydratePhotos(el);
  }
  el.querySelector('#file').addEventListener('change', async (ev) => {
    const files = [...ev.target.files]; ev.target.value = '';
    for (const f of files) { try { const id = await savePhoto(await shrink(f)); added.push(id); d.photos.push(id); } catch { toast('Не удалось открыть фото'); } }
    renderPhotos();
  });
  el.addEventListener('click', (ev) => {
    const t = ev.target;
    const rm = t.closest('[data-rm]');
    if (rm) { ev.stopImmediatePropagation(); const id = rm.dataset.rm; d.photos = d.photos.filter((x) => x !== id); if (added.includes(id)) { deletePhotos([id]); added.splice(added.indexOf(id), 1); } else removed.push(id); return renderPhotos(); }
    const v = t.closest('[data-viewer]'); if (v) return viewPhotos(d.photos, d.photos.indexOf(v.dataset.viewer));
    const s = t.closest('[data-sev]');
    if (s) { d.severity = s.dataset.sev; el.querySelectorAll('[data-sev]').forEach((b) => b.classList.toggle('on', b === s)); el.querySelector('#sevhint').textContent = SEVERITY[d.severity].ru; return; }
    const c = t.closest('[data-group] [data-k]');
    if (c) {
      const g = c.parentElement.dataset.group, k = c.dataset.k;
      if (g === 'area') { d.area = d.area === k ? null : k; c.parentElement.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b.dataset.k === d.area)); }
      else { const i = d[g].indexOf(k); i >= 0 ? d[g].splice(i, 1) : d[g].push(k); c.classList.toggle('on', i < 0); }
    }
  });
  el.addEventListener('input', (ev) => {
    const n = ev.target.name; if (!n) return;
    if (n === 'odo') { ev.target.value = ev.target.value.replace(/\D/g, ''); d.odo = ev.target.value ? parseInt(ev.target.value, 10) : null; }
    else d[n] = ev.target.value;
  });
  el.querySelector('#save').addEventListener('click', async () => {
    if (!d.title.trim()) { F('title').focus(); return toast('Опишите коротко, что случилось'); }
    d.title = d.title.trim();
    await saveIssue(d);
    if (removed.length) deletePhotos(removed);
    saved = true; await closeLayer(el); toast(issue ? 'Изменения сохранены' : 'Поломка записана');
  });
  renderPhotos();
  return layer;
}

/* ================= detail ================= */
export function openIssue(id) {
  const i = S.issues.find((x) => x.id === id); if (!i) return;
  const fixed = i.status === 'fixed', ent = i.fixedBy && S.entries.find((e) => e.id === i.fixedBy);
  const tagSection = (label, list, keys) => (keys?.length ? `<div class="section" style="margin-top:20px"><div class="lbl">${label}</div><div class="tags" style="margin-top:0">${keys.map((k) => `<span class="tag">${esc(byKey(list, k)?.ru || k)}</span>`).join('')}</div></div>` : '');
  const html = `<div><div class="page-bar"><div class="side"><button class="icon-btn flat" data-act="close" aria-label="Назад">${icon('chevron-left', 24)}</button></div><h2>Поломка</h2>
    <div class="side r"><button class="icon-btn flat" data-act="edit" aria-label="Изменить">${icon('pencil', 20)}</button></div></div>
  <div class="page-body">
    <div style="margin:4px 2px 18px">${fixed ? `<span class="sev low" style="--s:var(--good);--s-ink:var(--good-ink)">${icon('circle-check', 14)}Исправлено${i.fixedDate ? ' · ' + dateShort(i.fixedDate) : ''}</span>` : sevPill(i.severity)}
      <div class="h1" style="font-size:27px;margin-top:12px;line-height:1.15">${esc(i.title)}</div></div>
    <div class="facts">
      ${byKey(AREAS, i.area) ? `<div class="fact"><span>Узел</span><span>${esc(byKey(AREAS, i.area).ru)}</span></div>` : ''}
      <div class="fact"><span>Замечено</span><span>${dateFull(i.date)}</span></div>
      ${i.odo != null ? `<div class="fact"><span>Пробег</span><span>${km(i.odo)}</span></div>` : ''}
      ${!fixed ? `<div class="fact"><span>Срочность</span><span>${esc(SEVERITY[i.severity].ru)}</span></div>` : ''}
    </div>
    ${tagSection('Симптомы', SYMPTOMS, i.symptoms)}${tagSection('Когда проявляется', CONDITIONS, i.conditions)}${tagSection('Горит на панели', LIGHTS, i.lights)}
    ${i.desc ? `<div class="section" style="margin-top:20px"><div class="lbl">Подробности</div><div class="card flat" style="white-space:pre-wrap">${esc(i.desc)}</div></div>` : ''}
    ${i.photos?.length ? `<div class="section" style="margin-top:20px"><div class="lbl">Фото</div><div class="thumbs">${thumbsHTML(i.photos)}</div></div>` : ''}
    <div class="section" style="margin-top:20px"><div class="lbl">Что сказал мастер</div><textarea class="textarea" id="mech" placeholder="Диагноз, цена, что нужно заказать…">${esc(i.mechanic || '')}</textarea></div>
    ${ent ? `<button class="callout" data-act="to-entry" style="margin-top:20px"><div class="row-ic" style="--c:var(--good)">${icon('circle-check', 22)}</div><div class="row-main"><b>Ремонт · ${money(ent.total)}</b><span>${esc(ent.title || '')}</span></div>${icon('chevron-right', 20)}</button>` : ''}
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:26px">
      ${fixed ? `<button class="btn soft block" data-act="reopen">${icon('undo-2', 20)} Вернуть в открытые</button>` : `<button class="btn primary block" data-act="fix">${icon('circle-check', 20)} Отметить исправленной</button>`}
      <button class="text-btn danger" data-act="del" style="display:flex;align-items:center;gap:8px;justify-content:center">${icon('trash-2', 18)}Удалить</button></div>
  </div></div>`;
  const layer = page(html), el = layer.el;
  hydratePhotos(el);
  el.querySelector('#mech').addEventListener('change', (ev) => saveIssue({ ...i, mechanic: ev.target.value.trim() }));
  el.addEventListener('click', async (ev) => {
    const v = ev.target.closest('[data-viewer]'); if (v) return viewPhotos(i.photos, i.photos.indexOf(v.dataset.viewer));
    const a = ev.target.closest('[data-act]')?.dataset.act;
    if (a === 'edit') swap(layer, (o) => openIssueForm({ issue: S.issues.find((x) => x.id === id), ...o }));
    if (a === 'to-entry') openEntry(ent.id);
    if (a === 'reopen') { const c = { ...i, status: 'open' }; delete c.fixedDate; delete c.fixedBy; await saveIssue(c); await closeLayer(el); toast('Вернул в открытые'); }
    if (a === 'fix') openFixSheet(i, layer);
    if (a === 'del') {
      if (!(await confirmDialog({ title: 'Удалить запись о поломке?', ok: 'Удалить', danger: true }))) return;
      await closeLayer(el); const r = await removeIssue(i.id);
      let undone = false;
      toast('Удалено', { label: 'Вернуть', onAction: async () => { undone = true; await restoreIssue(r); } });
      setTimeout(() => { if (!undone) deletePhotos(r.photos); }, 4800);
    }
  });
}

function openFixSheet(i, parent) {
  let withCost = true;
  const l = sheet(`<h2>Поломка исправлена</h2><div class="form">
    <div class="field"><label>Когда</label><input class="input" type="date" name="date" value="${today()}" max="${today()}"></div>
    <button type="button" class="switch-row" id="cost"><span><b>Записать расходы на ремонт</b><small>Появится в журнале и статистике</small></span><span class="sw on"></span></button>
    <div id="costf"><div class="grid2"><div class="field"><label>Сколько, ₪</label><input class="input" name="total" inputmode="decimal" placeholder="0"></div>
      <div class="field"><label>Где</label><input class="input" name="place" placeholder="Мастерская"></div></div></div>
    <button class="btn primary block" id="ok">${icon('check', 20)} Готово</button></div>`);
  const el = l.el, F = (n) => el.querySelector(`[name="${n}"]`);
  el.querySelector('#cost').onclick = (e) => { withCost = !withCost; e.currentTarget.querySelector('.sw').classList.toggle('on', withCost); el.querySelector('#costf').style.display = withCost ? '' : 'none'; };
  el.querySelector('#ok').onclick = async () => {
    const date = F('date').value || today();
    const total = parseNum(F('total').value);
    let fixedBy = null;
    if (withCost && total > 0) {
      fixedBy = uid();
      await saveEntry({ id: fixedBy, kind: 'repair', date, odo: currentOdo(), total, title: i.title, place: F('place').value.trim(), note: '', photos: [] });
    }
    await saveIssue({ ...i, status: 'fixed', fixedDate: date, ...(fixedBy ? { fixedBy } : {}) });
    await closeLayer(l.el); await closeLayer(parent.el);
    toast('Отмечено как исправленное');
  };
}
