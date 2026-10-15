import { esc, $ } from './util.js';
import { icon } from './icons.js';
import { photoURL } from './photos.js';

/* ============ layers (pages / sheets / dialogs) tied to browser history so the back gesture closes them ============ */
const stack = [];
let histDepth = 0;
const waiters = new Map();

export function openLayer(el, { kind = 'page', onClose, replace = false } = {}) {
  el.classList.add('layer', kind);
  $('#layers').appendChild(el);
  stack.push({ el, onClose });
  if (replace && histDepth > 0) history.replaceState({ l: stack.length }, '');
  else { history.pushState({ l: stack.length }, ''); histDepth = stack.length; }
  document.body.classList.add('has-layer');
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  return { el, close: () => closeLayer(el) };
}

function removeTop() {
  const l = stack.pop();
  if (!l) return;
  l.el.classList.remove('in'); l.el.classList.add('out');
  setTimeout(() => l.el.remove(), 280);
  if (!stack.length) document.body.classList.remove('has-layer');
  l.onClose?.();
  waiters.get(l.el)?.(); waiters.delete(l.el);
}
window.addEventListener('popstate', (e) => {
  histDepth = e.state?.l || 0;
  while (stack.length > histDepth) removeTop();
});

/** Close a layer; resolves once it is gone. */
export function closeLayer(el, { silent = false } = {}) {
  const i = stack.findIndex((l) => l.el === el);
  if (i < 0) return Promise.resolve();
  if (silent) { // history entry is kept for an immediate replace-open
    const [l] = stack.splice(i, 1);
    l.el.classList.remove('in'); l.el.classList.add('out'); setTimeout(() => l.el.remove(), 280);
    if (!stack.length) document.body.classList.remove('has-layer');
    l.onClose?.();
    return Promise.resolve();
  }
  return new Promise((res) => {
    waiters.set(el, res);
    if (i === stack.length - 1) { history.back(); setTimeout(() => { if (stack.some((l) => l.el === el)) { histDepth = Math.max(0, histDepth - 1); removeTop(); } }, 500); }
    else { const [l] = stack.splice(i, 1); l.el.remove(); l.onClose?.(); res(); }
  });
}
export const topLayer = () => stack[stack.length - 1]?.el;
export const layerCount = () => stack.length;

export function page(html, opts = {}) {
  const el = document.createElement('div');
  el.innerHTML = html;
  const root = el.firstElementChild;
  return openLayer(root, { kind: 'page', ...opts });
}
export function sheet(html, opts = {}) {
  const el = document.createElement('div');
  el.className = 'sheet-wrap';
  el.innerHTML = `<div class="backdrop" data-act="close"></div><div class="sheet" role="dialog"><div class="grab"></div>${html}</div>`;
  return openLayer(el, { kind: 'sheetwrap', ...opts });
}

/** Opens a replacement for `old`, reusing its history slot. */
export function swap(old, open) {
  closeLayer(old.el, { silent: true });
  return open({ replace: true });
}

export function confirmDialog({ title, text = '', ok = 'Да', cancel = 'Отмена', danger = false }) {
  return new Promise((resolve) => {
    let result = false;
    const el = document.createElement('div');
    el.className = 'dialog-wrap';
    el.innerHTML = `<div class="backdrop" data-act="close"></div>
      <div class="dialog" role="alertdialog"><h3>${esc(title)}</h3>${text ? `<p>${esc(text)}</p>` : ''}
      <div class="dialog-btns"><button class="btn ghost" data-act="close">${esc(cancel)}</button>
      <button class="btn ${danger ? 'danger' : 'primary'}" data-dialog-ok>${esc(ok)}</button></div></div>`;
    const l = openLayer(el, { kind: 'dialogwrap', onClose: () => resolve(result) });
    el.querySelector('[data-dialog-ok]').onclick = () => { result = true; l.close(); };
  });
}

/* ============ toast ============ */
let toastTimer;
export function toast(msg, { label, onAction, ms = 4500 } = {}) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>${label ? `<button class="toast-act">${esc(label)}</button>` : ''}`;
  t.classList.add('show');
  clearTimeout(toastTimer);
  const hide = () => t.classList.remove('show');
  toastTimer = setTimeout(hide, ms);
  if (label) t.querySelector('.toast-act').onclick = () => { hide(); onAction?.(); };
}

/* ============ fullscreen photo viewer ============ */
export function viewPhotos(ids, start = 0) {
  let i = start;
  const el = document.createElement('div');
  el.className = 'viewer';
  el.innerHTML = `<div class="viewer-top"><span class="viewer-count"></span><button class="icon-btn light" data-act="close" aria-label="Закрыть">${icon('x', 22)}</button></div>
    <div class="viewer-stage"><img alt="Фото"></div>
    <div class="viewer-nav">${ids.length > 1 ? `<button class="icon-btn light" data-v="-1" aria-label="Назад">${icon('chevron-left', 24)}</button><button class="icon-btn light" data-v="1" aria-label="Вперёд">${icon('chevron-right', 24)}</button>` : ''}</div>`;
  const img = el.querySelector('img'), stage = el.querySelector('.viewer-stage');
  const show = async () => {
    img.classList.remove('zoom'); stage.scrollTo(0, 0);
    img.src = (await photoURL(ids[i])) || '';
    el.querySelector('.viewer-count').textContent = ids.length > 1 ? `${i + 1} / ${ids.length}` : '';
  };
  img.onclick = () => img.classList.toggle('zoom');
  el.addEventListener('click', (e) => { const v = e.target.closest('[data-v]'); if (v) { i = (i + +v.dataset.v + ids.length) % ids.length; show(); } });
  openLayer(el, { kind: 'viewerwrap' });
  show();
}

/* ============ small HTML builders ============ */
export const chip = (label, on, attrs = '', extra = '') => `<button type="button" class="chip${on ? ' on' : ''}" ${attrs}>${extra}${esc(label)}</button>`;
export const empty = (ic, title, text, btn = '') => `<div class="empty"><div class="empty-ic">${icon(ic, 30)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p>${btn}</div>`;

export function applyTheme(t) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t; else delete root.dataset.theme;
  const dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').content = dark ? '#0C0E11' : '#F4F3EF';
}
