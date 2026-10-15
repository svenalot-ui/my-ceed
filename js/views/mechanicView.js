import { S, openIssues } from '../store.js';
import { icon } from '../icons.js';
import { esc } from '../util.js';
import { page, toast } from '../ui.js';
import { hydratePhotos } from '../photos.js';
import { viewPhotos } from '../ui.js';
import { build, toText, toHTML } from '../mechanic.js';
import { openIssueForm } from './issues.js';

export function openMechanic() {
  const st = { lang: 'ru', inc: new Set(openIssues().map((i) => i.id)), recent: true };
  const html = `<div><div class="page-bar"><div class="side"><button class="icon-btn flat" data-act="close" aria-label="Назад">${icon('chevron-left', 24)}</button></div><h2>Для мастера</h2><div class="side"></div></div>
  <div class="page-body no-print-pad"><div class="no-print">
    <div class="seg" id="lang" style="margin-bottom:14px"><button data-lang="ru" class="on">Русский</button><button data-lang="he">עברית</button></div>
    <div class="chips" id="pick" style="margin-bottom:6px"></div>
    <div class="hint" id="note" style="margin:0 2px 14px"></div></div>
    <div class="doc" id="doc"></div></div>
  <div class="page-foot no-print"><button class="btn primary" id="share">${icon('share-2', 20)} Отправить</button><button class="btn soft" id="copy" style="flex:0 0 56px;padding:0" aria-label="Копировать">${icon('copy', 20)}</button><button class="btn soft" id="print" style="flex:0 0 56px;padding:0" aria-label="Печать">${icon('printer', 20)}</button></div></div>`;
  const layer = page(html), el = layer.el;
  const doc = () => build(st.lang, st.inc, st.recent);
  function draw() {
    const open = openIssues();
    el.querySelector('#pick').innerHTML = open.map((i) => `<button type="button" class="chip${st.inc.has(i.id) ? ' on' : ''}" data-id="${i.id}">${esc(i.title)}</button>`).join('') + `<button type="button" class="chip${st.recent ? ' on' : ''}" data-recent>Недавние работы</button>`;
    el.querySelector('#note').textContent = st.lang === 'he' ? 'Названия, симптомы и условия переведены на иврит. Ваши описания останутся как написаны.' : 'Нажмите на пункт, чтобы убрать его из списка.';
    const d = el.querySelector('#doc'); d.dir = st.lang === 'he' ? 'rtl' : 'ltr'; d.lang = st.lang;
    d.innerHTML = toHTML(doc()); hydratePhotos(d);
  }
  el.addEventListener('click', async (ev) => {
    const t = ev.target;
    const lg = t.closest('[data-lang]'); if (lg) { st.lang = lg.dataset.lang; el.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b === lg)); return draw(); }
    const c = t.closest('#pick [data-id]'); if (c) { st.inc.has(c.dataset.id) ? st.inc.delete(c.dataset.id) : st.inc.add(c.dataset.id); return draw(); }
    if (t.closest('[data-recent]')) { st.recent = !st.recent; return draw(); }
    const v = t.closest('[data-viewer]'); if (v) { const ids = [...el.querySelectorAll('#doc [data-viewer]')].map((x) => x.dataset.viewer); return viewPhotos(ids, ids.indexOf(v.dataset.viewer)); }
    if (t.closest('#share')) {
      const text = toText(doc());
      if (navigator.share) { try { await navigator.share({ title: 'Мой Сид — список неисправностей', text }); } catch {} }
      else { await navigator.clipboard?.writeText(text); toast('Текст скопирован — вставьте в WhatsApp'); }
    }
    if (t.closest('#copy')) { try { await navigator.clipboard.writeText(toText(doc())); toast('Скопировано'); } catch { toast('Не удалось скопировать'); } }
    if (t.closest('#print')) window.print();
  });
  draw();
}
