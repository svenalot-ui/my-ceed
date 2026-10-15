import { S, saveSettings, emit } from './store.js';
import * as db from './db.js';
import { toast, sheet, closeLayer } from './ui.js';
import { today, num } from './util.js';
import { KINDS } from './consts.js';
import { icon } from './icons.js';

async function saveFile(name, blob) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const toDataURL = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
const fromDataURL = async (u) => (await fetch(u)).blob();

export async function exportJSON(withPhotos = true) {
  toast('Готовлю файл…', { ms: 2500 });
  const photos = [];
  if (withPhotos) for (const p of await db.all('photos')) photos.push({ id: p.id, data: await toDataURL(p.blob) });
  const data = { app: 'my-ceed', v: 1, exportedAt: new Date().toISOString(), settings: S.settings, entries: S.entries, issues: S.issues, photos };
  await saveFile(`my-ceed-${today()}${withPhotos ? '' : '-lite'}.json`, new Blob([JSON.stringify(data)], { type: 'application/json' }));
}

export async function exportCSV() {
  const esc = (v) => { v = v == null ? '' : String(v); return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const head = ['Дата', 'Категория', 'Название', 'Станция', 'Литры', 'Цена за литр', 'Сумма ₪', 'Пробег', 'Где', 'Заметка'];
  const rows = [...S.entries].sort((a, b) => (a.date < b.date ? -1 : 1)).map((e) => [e.date, KINDS[e.kind].label, e.title, e.station, e.liters, e.ppl, e.total, e.odo, e.place, e.note].map(esc).join(','));
  await saveFile(`my-ceed-${today()}.csv`, new Blob(['﻿' + [head.join(','), ...rows].join('\n')], { type: 'text/csv' }));
}

export async function importFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); if (data.app !== 'my-ceed') throw 0; } catch { return toast('Это не файл копии «Мой Сид»'); }
  const l = sheet(`<h2>Загрузить копию</h2><p class="muted" style="margin:-6px 2px 18px">В файле: ${data.entries?.length || 0} записей, ${data.issues?.length || 0} поломок, ${data.photos?.length || 0} фото. Сохранён ${String(data.exportedAt || '').slice(0, 10)}.</p>
    <div style="display:flex;flex-direction:column;gap:10px"><button class="btn primary block" data-m="merge">Добавить к текущим данным</button>
    <button class="btn soft block" data-m="replace">Заменить всё содержимое</button><button class="btn ghost block" data-act="close">Отмена</button></div>`);
  l.el.addEventListener('click', async (ev) => {
    const m = ev.target.closest('[data-m]')?.dataset.m; if (!m) return;
    await closeLayer(l.el);
    toast('Загружаю…', { ms: 2500 });
    if (m === 'replace') await Promise.all(['entries', 'issues', 'photos'].map(db.clear));
    for (const e of data.entries || []) await db.put('entries', e);
    for (const i of data.issues || []) await db.put('issues', i);
    for (const p of data.photos || []) await db.put('photos', { id: p.id, blob: await fromDataURL(p.data) });
    if (m === 'replace' && data.settings) await saveSettings(data.settings, true);
    S.entries = await db.all('entries'); S.issues = await db.all('issues');
    emit(); toast('Готово: данные загружены');
  });
}
