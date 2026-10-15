import { S, removeEntry, restoreEntry } from '../store.js';
import { KINDS, DOC_TYPES } from '../consts.js';
import { icon } from '../icons.js';
import { esc, num, int, money, dateFull, km } from '../util.js';
import { consumption } from '../calc.js';
import { page, closeLayer, confirmDialog, toast, viewPhotos, swap } from '../ui.js';
import { hydratePhotos, deletePhotos } from '../photos.js';
import { thumbsHTML } from './common.js';
import { openEntryForm } from './entryForm.js';

export function openEntry(id) {
  const e = S.entries.find((x) => x.id === id); if (!e) return;
  const k = KINDS[e.kind], c = consumption(S.entries).get(e.id);
  const facts = [['Дата', dateFull(e.date)]];
  if (e.kind === 'fuel') {
    facts.push(['Литры', `${num(e.liters, 2)} л`], ['Цена за литр', `${num(e.ppl, 2)} ₪`]);
    if (e.station) facts.push(['Станция', e.station]);
    facts.push(['Топливо', e.fuel === 'diesel' ? 'Солярка' : e.fuel || '95'], ['Бак', e.full ? 'Полный' : 'Неполный']);
    if (c) facts.push(['Расход на этом баке', `${num(c.l100, 1)} л/100 км`], ['Проехали с прошлой', km(c.km)], ['Топливо на 1 км', `${num((c.l100 / 100) * e.ppl, 2)} ₪`]);
  } else {
    facts.push(['Категория', k.label]);
    if (e.title) facts.push(['Что', e.title]);
    if (e.place) facts.push(['Где', e.place]);
    if (e.validUntil) facts.push(['Действует до', dateFull(e.validUntil)]);
  }
  if (e.odo != null) facts.push(['Пробег', km(e.odo)]);
  const fixed = S.issues.filter((i) => i.fixedBy === e.id);
  const html = `<div><div class="page-bar"><div class="side"><button class="icon-btn flat" data-act="close" aria-label="Назад">${icon('chevron-left', 24)}</button></div><h2>${esc(k.label)}</h2>
      <div class="side r"><button class="icon-btn flat" data-act="edit" aria-label="Изменить">${icon('pencil', 20)}</button></div></div>
    <div class="page-body k-${e.kind}">
      <div style="display:flex;align-items:center;gap:14px;margin:6px 2px 22px"><div class="row-ic" style="width:56px;height:56px;border-radius:18px">${icon(k.icon, 28)}</div>
        <div><div class="big-amt">${money(e.total)}</div><div class="sub">${esc(e.kind === 'fuel' ? (e.station ? e.station + ' · ' : '') + 'заправка' : e.title || k.label)}</div></div></div>
      ${e.photos?.length ? `<div class="thumbs" style="margin-bottom:20px">${thumbsHTML(e.photos, e.photos.length === 1)}</div>` : ''}
      <div class="facts">${facts.map(([a, b]) => `<div class="fact"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}</div>
      ${e.note ? `<div class="section" style="margin-top:20px"><div class="lbl">Заметка</div><div class="card flat" style="white-space:pre-wrap">${esc(e.note)}</div></div>` : ''}
      ${fixed.length ? `<div class="section" style="margin-top:20px"><div class="lbl">Починили</div><div class="card flat">${fixed.map((i) => `<div style="display:flex;gap:8px;align-items:center;padding:3px 0">${icon('circle-check', 18)}${esc(i.title)}</div>`).join('')}</div></div>` : ''}
      <button class="text-btn danger" data-act="del" style="margin-top:26px;display:flex;align-items:center;gap:8px">${icon('trash-2', 18)}Удалить запись</button>
    </div></div>`;
  const layer = page(html);
  const el = layer.el;
  hydratePhotos(el);
  el.addEventListener('click', async (ev) => {
    const v = ev.target.closest('[data-viewer]');
    if (v) return viewPhotos(e.photos, e.photos.indexOf(v.dataset.viewer));
    const a = ev.target.closest('[data-act]')?.dataset.act;
    if (a === 'edit') swap(layer, (o) => openEntryForm({ entry: e, ...o }));
    if (a === 'del') {
      if (!(await confirmDialog({ title: 'Удалить запись?', text: `${k.label}, ${money(e.total)}. Фото тоже удалятся.`, ok: 'Удалить', danger: true }))) return;
      await closeLayer(el);
      const removed = await removeEntry(e.id);
      let undone = false;
      toast('Запись удалена', { label: 'Вернуть', onAction: async () => { undone = true; await restoreEntry(removed); } });
      setTimeout(() => { if (!undone) deletePhotos(removed.photos); }, 4800);
    }
  });
}
