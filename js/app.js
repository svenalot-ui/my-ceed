import * as store from './store.js';
import { S, currentOdo, logOdo, openIssues } from './store.js';
import { $, $$, debounce, int, km, parseNum } from './util.js';
import { icon } from './icons.js';
import { applyTheme, closeLayer, sheet, toast, layerCount } from './ui.js';
import { renderHome } from './views/home.js';
import { renderJournal, journalList, J } from './views/journal.js';
import { renderIssues, I, openIssue, openIssueForm } from './views/issues.js';
import { renderStats, mountStats, ST } from './views/stats.js';
import { openSettings, openOnboarding, openReminderEditor } from './views/settings.js';
import { openEntry } from './views/detail.js';
import { openEntryForm, openAddMenu } from './views/entryForm.js';
import { openMechanic } from './views/mechanicView.js';

const demo = new URLSearchParams(location.search).has('demo');
const VIEWS = { home: renderHome, log: renderJournal, issues: renderIssues, stats: renderStats };
let tab = (location.hash || '').slice(1);
if (!VIEWS[tab]) tab = 'home';

function tabbar() {
  const n = openIssues().length;
  const t = (k, ic, label, badge = '') => `<button class="tab${tab === k ? ' on' : ''}" data-act="tab" data-tab="${k}" aria-label="${label}"${tab === k ? ' aria-current="page"' : ''}>${icon(ic, 24)}<span>${label}</span>${badge}</button>`;
  $('#tabbar').innerHTML = t('home', 'house', 'Главная') + t('log', 'receipt-text', 'Журнал')
    + `<button class="fab" data-act="add" aria-label="Добавить запись">${icon('plus', 30)}</button>`
    + t('issues', 'triangle-alert', 'Поломки', n ? `<span class="badge">${n}</span>` : '') + t('stats', 'chart-column', 'Статистика');
}
function render(keepScroll = true) {
  const v = $('#view'), y = keepScroll ? v.scrollTop : 0;
  v.innerHTML = VIEWS[tab]();
  if (tab === 'stats') mountStats(v);
  v.style.scrollBehavior = 'auto'; v.scrollTop = y; v.style.scrollBehavior = '';
  tabbar();
}
function setTab(k) { if (!VIEWS[k]) return; const same = k === tab; tab = k; history.replaceState(history.state, '', '#' + k); render(same); }

function openOdoSheet() {
  const cur = currentOdo();
  const l = sheet(`<h2>Пробег</h2><div class="form"><div class="field"><label>Что на одометре сейчас, км</label><input class="input" id="odo" inputmode="numeric" value="${cur ?? ''}" style="height:64px;font-size:26px;font-weight:720"><div class="hint" id="oh">${cur ? 'В журнале сейчас ' + km(cur) : 'Первый раз — просто впишите цифру'}</div></div>
    <button class="btn primary block" id="ok">Сохранить</button></div>`);
  const inp = l.el.querySelector('#odo'); setTimeout(() => { inp.focus(); inp.select(); }, 350);
  inp.addEventListener('input', () => (inp.value = inp.value.replace(/\D/g, '')));
  l.el.querySelector('#ok').onclick = async () => {
    const v = parseInt(inp.value, 10);
    if (!(v > 0)) return;
    if (cur && v < cur) { const h = l.el.querySelector('#oh'); h.className = 'hint warn'; h.textContent = `Меньше, чем в журнале (${int(cur)} км). Исправьте старую запись или впишите больше.`; return; }
    await logOdo(v); await closeLayer(l.el); toast('Пробег обновлён');
  };
}

const actions = {
  close: (el) => closeLayer(el.closest('.layer')),
  tab: (el) => setTab(el.dataset.tab),
  add: (el) => (el.dataset.kind ? openEntryForm({ kind: el.dataset.kind }) : openAddMenu()),
  entry: (el) => openEntry(el.dataset.id),
  issue: (el) => openIssue(el.dataset.id),
  'issue-new': () => openIssueForm(),
  'issues-tab': (el) => { I.tab = el.dataset.tab; render(false); },
  mechanic: () => openMechanic(),
  settings: (el) => openSettings({ anchor: el.dataset.anchor }),
  odo: () => openOdoSheet(),
  reminder: (el) => openReminderEditor(el.dataset.id),
  'journal-search': () => { J.search = !J.search; if (!J.search) J.q = ''; render(true); if (J.search) $('#jq')?.focus(); },
  'journal-kind': (el) => { J.kind = el.dataset.kind; render(true); },
  'stats-period': (el) => { ST.period = el.dataset.p; render(true); },
  demo: () => (location.search = '?demo'),
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  const fn = el && actions[el.dataset.act];
  if (fn) fn(el, e);
});
document.addEventListener('input', (e) => {
  if (e.target.dataset?.input === 'journal-q') { J.q = e.target.value; $('#journal-list').innerHTML = journalList(); }
});
window.addEventListener('resize', debounce(() => { if (tab === 'stats' && !layerCount()) render(true); }, 250));
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(S.settings.theme));

async function boot() {
  try { await store.init({ demo }); }
  catch (err) {
    $('#view').innerHTML = `<div class="empty" style="padding-top:90px"><h3>Не удалось открыть хранилище</h3><p>Браузер не даёт сохранять данные (возможно, приватный режим). Откройте сайт в обычной вкладке.</p></div>`;
    console.error(err); return;
  }
  const th = S.settings.theme;
  applyTheme(th);
  try { localStorage.setItem('myceed-theme', JSON.stringify(th)); } catch {}
  if (demo) $('#app').insertAdjacentHTML('afterbegin', `<div class="demo-bar"><span>Демо — это ненастоящие данные</span><a href="./">Выйти</a></div>`);
  history.replaceState(null, '', location.pathname + location.search + '#' + tab);
  render(false);
  store.subscribe(() => { render(true); try { localStorage.setItem('myceed-theme', JSON.stringify(S.settings.theme)); } catch {} });
  if (!S.settings.onboarded && !S.entries.length && !S.issues.length) setTimeout(openOnboarding, 250);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('Вышла новая версия', { label: 'Обновить', onAction: () => location.reload(), ms: 12000 }); });
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
boot();
