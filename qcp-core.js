/* ══════════════════════════════════════════════════════════════
   QCP CORE  —  общий модуль для всех страниц
   1) Глобальный выбор листа (Firestore, один на всю компанию)
   2) Мобильное меню-оверлей слева (одна кнопка рядом с аккаунтом)

   Подключение (после firebase-*-compat.js и firebase.initializeApp):
     <script src="qcp-core.js"></script>
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

// ── НАСТРОЙКИ ────────────────────────────────────────────────
const MAIN_SHEET_ID = '1mlIejiqrLwvjUPef1ObVfAaNexiMHYzlmom2BPPIlLQ';
const API_KEY       = 'AIzaSyAQ-RAQTV4S7hA1xWmvbITudc9l_wjC8nw';

// Firestore: один документ на всю компанию
const CFG_COLL = 'config';
const CFG_DOC  = 'active_sheet';

// Пункты меню. roles: [] = видно всем.
const NAV_ITEMS = [
  { href: 'panel.html',      label: 'Панель',        roles: ['admin'] },
  { href: 'manager.html',    label: 'Магазин',       roles: [] },
  { href: 'seller.html',     label: 'Продавцы',      roles: [] },
  { href: 'advanced-2.html', label: 'Advanced KPI',  roles: [] },
  { href: 'cert.html',       label: 'Сертификаты',   roles: [] },
];

// Кто может менять лист глобально. Пусто = все авторизованные.
const CAN_SWITCH_SHEET = [];

// ── СОСТОЯНИЕ ────────────────────────────────────────────────
let _db = null, _auth = null;
let _role = null;
let _tabs = [];                    // список листов таблицы
let _sheetName = null;             // текущий активный лист
let _sheetId = MAIN_SHEET_ID;
let _listeners = [];
let _unsubCfg = null;
let _ready = false;
let _readyQueue = [];

function db()   { return _db   || (_db   = firebase.firestore()); }
function auth() { return _auth || (_auth = firebase.auth()); }

// ── СТИЛИ ────────────────────────────────────────────────────
const CSS = `
.qcp-picker{position:relative;display:inline-block}
.qcp-picker-btn{
  display:flex;align-items:center;gap:6px;
  height:32px;padding:0 12px;border-radius:8px;
  border:1px solid var(--border2,#333);background:var(--bg3,#1e1e1e);
  color:var(--text,#fff);font:600 12px/1 inherit;
  cursor:pointer;white-space:nowrap;transition:border-color .15s,color .15s;
  font-family:inherit;
}
.qcp-picker-btn:hover{border-color:var(--accent,#0066ff)}
.qcp-picker-btn[disabled]{opacity:.55;cursor:default}
.qcp-picker-btn svg{flex-shrink:0;opacity:.6}
.qcp-picker-cur{max-width:120px;overflow:hidden;text-overflow:ellipsis}
.qcp-picker-menu{
  display:none;position:absolute;top:38px;right:0;z-index:900;
  min-width:190px;max-height:340px;overflow-y:auto;
  background:var(--bg2,#141414);border:1px solid var(--border2,#333);
  border-radius:12px;padding:6px;
  box-shadow:0 10px 30px rgba(0,0,0,.45);
}
.qcp-picker.open .qcp-picker-menu{display:block}
.qcp-picker-hint{
  padding:6px 10px 8px;font-size:10px;line-height:1.4;
  color:var(--text3,#555);border-bottom:1px solid var(--border,#2a2a2a);margin-bottom:4px;
}
.qcp-opt{
  display:flex;align-items:center;gap:8px;width:100%;
  padding:8px 10px;border:none;border-radius:8px;background:transparent;
  color:var(--text2,#aaa);font:500 13px/1.2 inherit;font-family:inherit;
  text-align:left;cursor:pointer;transition:background .12s,color .12s;
}
.qcp-opt:hover{background:var(--bg3,#1e1e1e);color:var(--text,#fff)}
.qcp-opt.active{color:var(--accent,#0066ff);font-weight:700}
.qcp-opt-mark{width:14px;flex-shrink:0;display:flex;align-items:center}
.qcp-opt-mark svg{display:block}

.qcp-menu-btn{
  width:32px;height:32px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  border-radius:8px;border:1px solid var(--border2,#333);
  background:var(--bg3,#1e1e1e);color:var(--text2,#aaa);
  cursor:pointer;transition:border-color .15s,color .15s;
}
.qcp-menu-btn:hover{border-color:var(--accent,#0066ff);color:var(--accent,#0066ff)}

.qcp-drawer-ov{
  position:fixed;inset:0;z-index:1000;
  background:rgba(0,0,0,.55);
  opacity:0;pointer-events:none;transition:opacity .22s ease;
}
.qcp-drawer-ov.open{opacity:1;pointer-events:auto}
.qcp-drawer{
  position:fixed;top:0;left:0;bottom:0;z-index:1001;
  width:270px;max-width:82vw;
  background:var(--bg2,#141414);border-right:1px solid var(--border,#2a2a2a);
  transform:translateX(-100%);transition:transform .26s cubic-bezier(.16,1,.3,1);
  display:flex;flex-direction:column;
  padding:calc(env(safe-area-inset-top,0px) + 14px) 0 14px;
}
.qcp-drawer.open{transform:translateX(0)}
.qcp-drawer-head{
  display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:0 16px 14px;border-bottom:1px solid var(--border,#2a2a2a);margin-bottom:8px;
}
.qcp-drawer-title{font-size:13px;font-weight:700;letter-spacing:.5px;color:var(--text,#fff)}
.qcp-drawer-user{font-size:11px;color:var(--text3,#555);margin-top:2px;
  max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qcp-drawer-close{
  width:28px;height:28px;flex-shrink:0;border-radius:8px;
  border:1px solid var(--border2,#333);background:var(--bg3,#1e1e1e);
  color:var(--text2,#aaa);cursor:pointer;
  display:flex;align-items:center;justify-content:center;
}
.qcp-drawer-nav{flex:1;overflow-y:auto;padding:4px 10px}
.qcp-drawer-link{
  display:flex;align-items:center;gap:10px;
  padding:11px 12px;margin-bottom:2px;border-radius:10px;
  color:var(--text2,#aaa);text-decoration:none;
  font-size:14px;font-weight:600;transition:background .12s,color .12s;
}
.qcp-drawer-link:hover{background:var(--bg3,#1e1e1e);color:var(--text,#fff)}
.qcp-drawer-link.active{background:var(--bg3,#1e1e1e);color:var(--accent,#0066ff)}
.qcp-drawer-foot{padding:10px 16px 0;border-top:1px solid var(--border,#2a2a2a)}
.qcp-drawer-sheet{font-size:11px;color:var(--text3,#555);line-height:1.5}
.qcp-drawer-sheet b{color:var(--text2,#aaa);font-weight:600}
.qcp-logout{
  width:100%;margin-top:10px;padding:9px;border-radius:9px;
  border:1px solid var(--border2,#333);background:transparent;
  color:var(--red,#ff3333);font:600 12px/1 inherit;font-family:inherit;cursor:pointer;
}
.qcp-logout:hover{border-color:var(--red,#ff3333)}
body.qcp-locked{overflow:hidden}
`;

function injectCSS() {
  if (document.getElementById('qcp-core-css')) return;
  const st = document.createElement('style');
  st.id = 'qcp-core-css';
  st.textContent = CSS;
  document.head.appendChild(st);
}

// ── ХЕЛПЕРЫ ──────────────────────────────────────────────────
const ICON = {
  chev:  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>',
  check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
  burger:'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  sheet: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function localCFG() {
  try { return JSON.parse(localStorage.getItem('qgi_config') || '{}'); }
  catch (e) { return {}; }
}

function notify() {
  _listeners.forEach(fn => { try { fn(_sheetName, _sheetId); } catch (e) { console.error('[QCP]', e); } });
}

// ── ЗАГРУЗКА СПИСКА ЛИСТОВ ───────────────────────────────────
async function loadTabs() {
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${_sheetId}`
              + `?key=${API_KEY}&fields=sheets.properties.title`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    _tabs = (json.sheets || []).map(s => s.properties.title);
  } catch (e) {
    console.warn('[QCP] Не удалось получить список листов:', e.message);
    _tabs = [];
  }
}

// ── ЧТЕНИЕ/ЗАПИСЬ ГЛОБАЛЬНОГО ЛИСТА ──────────────────────────
function subscribeConfig() {
  if (_unsubCfg) _unsubCfg();
  _unsubCfg = db().collection(CFG_COLL).doc(CFG_DOC).onSnapshot(
    snap => {
      const d = snap.exists ? (snap.data() || {}) : {};
      const nextId   = (d.sheetId || '').trim() || MAIN_SHEET_ID;
      const nextName = (d.sheetName || '').trim();

      const idChanged = nextId !== _sheetId;
      _sheetId = nextId;

      if (nextName && nextName !== _sheetName) {
        _sheetName = nextName;
        localStorage.setItem('qcp_last_sheet', nextName);
        renderAllPickers();
        notify();
      } else if (!_sheetName) {
        // документа ещё нет — берём локальный фолбэк
        const c = localCFG();
        _sheetName = localStorage.getItem('qcp_last_sheet')
                  || (c.ADV_SHEET_NAME || c.SELLERS_SHEET_NAME || '').trim()
                  || (_tabs[_tabs.length - 1] || '');
        renderAllPickers();
        notify();
      } else {
        renderAllPickers();
      }
      if (idChanged) loadTabs().then(renderAllPickers);
    },
    err => console.error('[QCP] Firestore config:', err)
  );
}

async function setSheet(name) {
  if (!name || name === _sheetName) return;
  const u = auth().currentUser;
  try {
    await db().collection(CFG_COLL).doc(CFG_DOC).set({
      sheetName: name,
      sheetId: _sheetId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: u ? (u.email || u.uid) : 'unknown',
    }, { merge: true });
    // onSnapshot сам обновит UI и вызовет подписчиков
  } catch (e) {
    console.error('[QCP] Не удалось сохранить лист:', e);
    alert('Не удалось сменить лист: ' + e.message);
  }
}

// ── РОЛЬ ─────────────────────────────────────────────────────
async function loadRole() {
  const u = auth().currentUser;
  if (!u) { _role = null; return; }
  try {
    const snap = await db().collection('users').doc(u.uid).get();
    _role = snap.exists ? ((snap.data() || {}).role || null) : null;
  } catch (e) {
    console.warn('[QCP] Роль не прочитана:', e.message);
    _role = null;
  }
}

function canSwitch() {
  if (!CAN_SWITCH_SHEET.length) return true;
  return CAN_SWITCH_SHEET.includes(_role);
}

// ── ВЫБОР ЛИСТА (UI) ─────────────────────────────────────────
const _pickers = [];

function mountSheetPicker(target) {
  injectCSS();
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) { console.warn('[QCP] mountSheetPicker: контейнер не найден'); return; }

  const wrap = document.createElement('div');
  wrap.className = 'qcp-picker';
  host.appendChild(wrap);
  _pickers.push(wrap);

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) wrap.classList.remove('open');
  });

  renderPicker(wrap);
  return wrap;
}

function renderPicker(wrap) {
  const allowed = canSwitch();
  const opts = _tabs.length ? _tabs : (_sheetName ? [_sheetName] : []);

  wrap.innerHTML = `
    <button class="qcp-picker-btn" type="button" ${allowed ? '' : 'disabled'}>
      ${ICON.sheet}
      <span class="qcp-picker-cur">${esc(_sheetName || 'Лист…')}</span>
      ${allowed ? ICON.chev : ''}
    </button>
    <div class="qcp-picker-menu">
      <div class="qcp-picker-hint">Общий лист данных.<br>Смена применится у всех.</div>
      ${opts.map(t => `
        <button class="qcp-opt${t === _sheetName ? ' active' : ''}" type="button" data-sheet="${esc(t)}">
          <span class="qcp-opt-mark">${t === _sheetName ? ICON.check : ''}</span>
          <span>${esc(t)}</span>
        </button>`).join('')
        || '<div class="qcp-picker-hint">Листы не загружены</div>'}
    </div>`;

  if (!allowed) return;

  wrap.querySelector('.qcp-picker-btn').onclick = e => {
    e.stopPropagation();
    wrap.classList.toggle('open');
  };
  wrap.querySelectorAll('.qcp-opt').forEach(b => {
    b.onclick = () => {
      wrap.classList.remove('open');
      setSheet(b.dataset.sheet);
    };
  });
}

function renderAllPickers() {
  _pickers.forEach(renderPicker);
  const dv = document.getElementById('qcpDrawerSheet');
  if (dv) dv.innerHTML = `Лист данных: <b>${esc(_sheetName || '—')}</b>`;
}

// ── МЕНЮ-ОВЕРЛЕЙ ─────────────────────────────────────────────
function mountNav(target, opts) {
  injectCSS();
  opts = opts || {};
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!host) { console.warn('[QCP] mountNav: контейнер не найден'); return; }

  const current = opts.active
    || (location.pathname.split('/').pop() || 'index.html');

  // Кнопка
  const btn = document.createElement('button');
  btn.className = 'qcp-menu-btn';
  btn.type = 'button';
  btn.title = 'Меню';
  btn.innerHTML = ICON.burger;
  host.appendChild(btn);

  // Оверлей + панель
  const ov = document.createElement('div');
  ov.className = 'qcp-drawer-ov';
  const dr = document.createElement('aside');
  dr.className = 'qcp-drawer';

  const u = auth().currentUser;
  const items = NAV_ITEMS
    .filter(it => !it.roles.length || it.roles.includes(_role))
    .map(it => `<a class="qcp-drawer-link${it.href === current ? ' active' : ''}"
                   href="${it.href}">${esc(it.label)}</a>`).join('');

  dr.innerHTML = `
    <div class="qcp-drawer-head">
      <div>
        <div class="qcp-drawer-title">QCP</div>
        <div class="qcp-drawer-user">${esc(u ? (u.email || '') : '')}${_role ? ' · ' + esc(_role) : ''}</div>
      </div>
      <button class="qcp-drawer-close" type="button">${ICON.close}</button>
    </div>
    <nav class="qcp-drawer-nav">${items}</nav>
    <div class="qcp-drawer-foot">
      <div class="qcp-drawer-sheet" id="qcpDrawerSheet">Лист данных: <b>${esc(_sheetName || '—')}</b></div>
      <button class="qcp-logout" type="button">Выйти</button>
    </div>`;

  document.body.appendChild(ov);
  document.body.appendChild(dr);

  const open  = () => { ov.classList.add('open'); dr.classList.add('open'); document.body.classList.add('qcp-locked'); };
  const close = () => { ov.classList.remove('open'); dr.classList.remove('open'); document.body.classList.remove('qcp-locked'); };

  btn.onclick = open;
  ov.onclick  = close;
  dr.querySelector('.qcp-drawer-close').onclick = close;
  // Закрываем сразу при переходе — оверлей не остаётся висеть
  dr.querySelectorAll('.qcp-drawer-link').forEach(a => a.addEventListener('click', close));
  dr.querySelector('.qcp-logout').onclick = () => {
    auth().signOut().then(() => location.href = 'index.html');
  };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

  return { open, close };
}

// ── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────
async function init() {
  injectCSS();
  const c = localCFG();
  _sheetId = (c.ADV_SHEET_ID || '').trim() || MAIN_SHEET_ID;

  await loadRole();
  await loadTabs();
  subscribeConfig();

  _ready = true;
  _readyQueue.splice(0).forEach(fn => fn());
}

// ── ПУБЛИЧНЫЙ API ────────────────────────────────────────────
global.QCP = {
  init,
  ready(fn)        { _ready ? fn() : _readyQueue.push(fn); },
  onSheetChange(fn){ _listeners.push(fn); if (_sheetName) fn(_sheetName, _sheetId); },
  sheetName()      { return _sheetName; },
  sheetId()        { return _sheetId; },
  tabs()           { return _tabs.slice(); },
  role()           { return _role; },
  setSheet,
  mountSheetPicker,
  mountNav,
  API_KEY,
};

})(window);
