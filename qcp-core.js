/* ══════════════════════════════════════════════════════════════
   QCP CORE — общий модуль для всех страниц QCP
   1) Глобальный выбор листов (Firestore: config/active_sheet)
      Один документ на всю компанию. Меняешь у себя — меняется у всех.
   2) Мобильное меню-оверлей слева (одна кнопка вместо нижней панели)

   Подключение: <script src="qcp-core.js"></script> после firebase-*-compat.js
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

// ── КТО МОЖЕТ МЕНЯТЬ ЛИСТ ────────────────────────────────────
// Остальные роли видят текущий лист, но переключать не могут.
// Хочешь разрешить всем — поставь пустой массив: []
const CAN_SWITCH = ['admin', 'manager'];

const CFG_COLL = 'config';
const CFG_DOC  = 'active_sheet';
const API_KEY  = 'AIzaSyAQ-RAQTV4S7hA1xWmvbITudc9l_wjC8nw';

// ── СОСТОЯНИЕ ────────────────────────────────────────────────
let _db = null, _auth = null;
let _role = null;
let _cfg = {};
let _defaults = {};
let _tabs = { main: [], adv: [] };
let _ids  = { main: '', adv: '' };
let _changeCbs = [];
let _unsub = null;
let _inited = false;

function db()   { return _db   || (_db   = firebase.firestore()); }
function auth() { return _auth || (_auth = firebase.auth()); }

// ── СТИЛИ ────────────────────────────────────────────────────
const CSS = `
.qcp-picker{position:relative;display:inline-flex}
.qcp-btn{
  display:inline-flex;align-items:center;gap:6px;
  height:36px;padding:0 12px;border-radius:10px;
  border:1px solid var(--border2,#333);background:var(--bg3,#1e1e1e);
  color:var(--text,#fff);font-family:inherit;font-size:12px;font-weight:600;
  line-height:1;cursor:pointer;white-space:nowrap;
  transition:border-color .15s,color .15s;
}
.qcp-btn:hover{border-color:var(--accent,#0066ff)}
.qcp-btn svg{flex-shrink:0;opacity:.65}
.qcp-btn.locked{cursor:default}
.qcp-btn.locked:hover{border-color:var(--border2,#333)}
.qcp-cur{max-width:130px;overflow:hidden;text-overflow:ellipsis}
.qcp-menu{
  display:none;position:absolute;top:42px;right:0;z-index:1200;
  min-width:210px;max-height:min(60vh,420px);overflow-y:auto;
  background:var(--bg2,#141414);border:1px solid var(--border2,#333);
  border-radius:14px;padding:6px;
}
.qcp-picker.open .qcp-menu{display:block}
.qcp-grp{padding:9px 10px 5px;font-size:10px;font-weight:700;letter-spacing:.6px;
  text-transform:uppercase;color:var(--text3,#555)}
.qcp-note{padding:8px 10px 10px;font-size:10px;line-height:1.45;color:var(--text3,#555);
  border-top:1px solid var(--border,#2a2a2a);margin-top:6px}
.qcp-opt{
  display:flex;align-items:center;gap:8px;width:100%;
  padding:9px 10px;border:none;border-radius:9px;background:transparent;
  color:var(--text2,#aaa);font-family:inherit;font-size:13px;font-weight:500;
  text-align:left;cursor:pointer;transition:background .12s,color .12s;
}
.qcp-opt:hover{background:var(--bg3,#1e1e1e);color:var(--text,#fff)}
.qcp-opt.on{color:var(--accent,#0066ff);font-weight:700}
.qcp-tick{width:14px;flex-shrink:0;display:flex;align-items:center}

.qcp-navbtn{
  display:inline-flex;align-items:center;justify-content:center;
  width:36px;height:36px;flex-shrink:0;
  border-radius:10px;border:1px solid var(--border2,#333);
  background:var(--bg3,#1e1e1e);color:var(--text2,#aaa);cursor:pointer;
  transition:border-color .15s,color .15s;
}
.qcp-navbtn:hover{border-color:var(--accent,#0066ff);color:var(--accent,#0066ff)}

.qcp-ov{position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,.55);
  opacity:0;pointer-events:none;transition:opacity .22s ease}
.qcp-ov.open{opacity:1;pointer-events:auto}
.qcp-drawer{
  position:fixed;top:0;left:0;bottom:0;z-index:2001;
  width:272px;max-width:82vw;
  background:var(--bg2,#141414);border-right:1px solid var(--border,#2a2a2a);
  transform:translateX(-100%);transition:transform .26s cubic-bezier(.16,1,.3,1);
  display:flex;flex-direction:column;
  padding:calc(env(safe-area-inset-top,0px) + 16px) 0 calc(env(safe-area-inset-bottom,0px) + 14px);
}
.qcp-drawer.open{transform:translateX(0)}
.qcp-dhead{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;
  padding:0 16px 14px;border-bottom:1px solid var(--border,#2a2a2a)}
.qcp-dtitle{font-size:13px;font-weight:800;letter-spacing:.5px;color:var(--text,#fff)}
.qcp-duser{font-size:11px;color:var(--text3,#555);margin-top:3px;max-width:175px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.qcp-dclose{width:28px;height:28px;flex-shrink:0;border-radius:8px;
  border:1px solid var(--border2,#333);background:var(--bg3,#1e1e1e);
  color:var(--text2,#aaa);cursor:pointer;display:flex;align-items:center;justify-content:center}
.qcp-dnav{flex:1;overflow-y:auto;padding:10px}
.qcp-dlink{
  display:flex;align-items:center;gap:10px;width:100%;
  padding:12px;margin-bottom:2px;border-radius:11px;border:none;background:transparent;
  color:var(--text2,#aaa);text-decoration:none;text-align:left;
  font-family:inherit;font-size:14px;font-weight:600;cursor:pointer;
  transition:background .12s,color .12s;
}
.qcp-dlink:hover{background:var(--bg3,#1e1e1e);color:var(--text,#fff)}
.qcp-dlink.on{background:var(--bg3,#1e1e1e);color:var(--accent,#0066ff)}
.qcp-dfoot{padding:12px 16px 0;border-top:1px solid var(--border,#2a2a2a)}
.qcp-dsheet{font-size:11px;color:var(--text3,#555);line-height:1.6}
.qcp-dsheet b{color:var(--text2,#aaa);font-weight:600}
.qcp-out{width:100%;margin-top:10px;padding:10px;border-radius:10px;
  border:1px solid var(--border2,#333);background:transparent;
  color:var(--red,#ff3333);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer}
.qcp-out:hover{border-color:var(--red,#ff3333)}
body.qcp-lock{overflow:hidden}
@media(min-width:769px){ .qcp-mobile{display:none !important} }
`;

function css() {
  if (document.getElementById('qcp-core-css')) return;
  const s = document.createElement('style');
  s.id = 'qcp-core-css'; s.textContent = CSS;
  document.head.appendChild(s);
}

const I = {
  chev:  '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>',
  tick:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>',
  lock:  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  sheet: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
  burger:'<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}
function hosts(t) {
  if (!t) return [];
  if (typeof t === 'string') return Array.from(document.querySelectorAll(t));
  if (t.length !== undefined && !t.tagName) return Array.from(t);
  return [t];
}

// ── СПИСОК ЛИСТОВ ────────────────────────────────────────────
async function fetchTabs(id) {
  if (!id) return [];
  try {
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}`
                        + `?key=${API_KEY}&fields=sheets.properties.title`);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    return (j.sheets || []).map(s => s.properties.title);
  } catch (e) {
    console.warn('[QCP] список листов не загружен:', e.message);
    return [];
  }
}

// ── РОЛЬ ─────────────────────────────────────────────────────
async function fetchRole() {
  const u = auth().currentUser;
  if (!u) return null;
  try {
    const d = await db().collection('users').doc(u.uid).get();
    return d.exists ? String((d.data() || {}).role || '').toLowerCase() : null;
  } catch (e) { return null; }
}
function canSwitch() { return !CAN_SWITCH.length || CAN_SWITCH.includes(_role); }

// ── ПОДПИСКА НА КОНФИГ ───────────────────────────────────────
function watch() {
  if (_unsub) _unsub();
  _unsub = db().collection(CFG_COLL).doc(CFG_DOC).onSnapshot(snap => {
    const remote = snap.exists ? (snap.data() || {}) : {};
    const next = Object.assign({}, _defaults);
    Object.keys(remote).forEach(k => {
      if (typeof remote[k] === 'string' && remote[k].trim()) next[k] = remote[k].trim();
    });

    const changed = Object.keys(next).filter(k => next[k] !== _cfg[k]);
    _cfg = next;
    paintAll();
    if (changed.length) _changeCbs.forEach(fn => {
      try { fn(_cfg, changed); } catch (e) { console.error('[QCP]', e); }
    });
  }, err => console.error('[QCP] config:', err));
}

async function set(patch) {
  if (!canSwitch()) return;
  const u = auth().currentUser;
  const clean = {};
  Object.keys(patch).forEach(k => { if (patch[k]) clean[k] = String(patch[k]); });
  if (!Object.keys(clean).length) return;
  clean.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
  clean.updatedBy = u ? (u.email || u.uid) : 'unknown';
  try {
    await db().collection(CFG_COLL).doc(CFG_DOC).set(clean, { merge: true });
  } catch (e) {
    console.error('[QCP] запись листа:', e);
    alert('Не удалось сменить лист: ' + e.message);
  }
}

// ── ВЫБОР ЛИСТА (UI) ─────────────────────────────────────────
const _pickers = [];

function mountPicker(target, opt) {
  css();
  opt = opt || {};
  const groups = opt.groups || [];
  hosts(target).forEach(host => {
    const w = document.createElement('div');
    w.className = 'qcp-picker';
    w._groups = groups;
    w._main = opt.main || (groups[0] && groups[0].field);
    host.appendChild(w);
    _pickers.push(w);
    paint(w);
  });
  return _pickers;
}

function optsFor(g) {
  const list = _tabs[g.source === 'adv' ? 'adv' : 'main'] || [];
  const f = g.filter ? list.filter(t => g.filter.test(t)) : list;
  const out = f.length ? f.slice() : list.slice();
  const cur = _cfg[g.field];
  if (cur && out.indexOf(cur) === -1) out.unshift(cur);
  return out;
}

function paint(w) {
  const on = canSwitch();
  const label = _cfg[w._main] || 'Лист…';
  const body = w._groups.map((g, gi) => {
    const opts = optsFor(g);
    return `${w._groups.length > 1 ? `<div class="qcp-grp">${esc(g.label || g.field)}</div>` : ''}
      ${opts.map(t => `<button type="button" class="qcp-opt${t === _cfg[g.field] ? ' on' : ''}"
          data-g="${gi}" data-v="${esc(t)}">
          <span class="qcp-tick">${t === _cfg[g.field] ? I.tick : ''}</span><span>${esc(t)}</span>
        </button>`).join('') || '<div class="qcp-note">Листы не загружены</div>'}`;
  }).join('');

  w.innerHTML = `
    <button type="button" class="qcp-btn${on ? '' : ' locked'}" title="${on ? 'Выбрать лист данных' : 'Лист задаёт админ или менеджер'}">
      ${I.sheet}<span class="qcp-cur">${esc(label)}</span>${on ? I.chev : I.lock}
    </button>
    <div class="qcp-menu">${body}
      <div class="qcp-note">Общий лист для всех сотрудников.<br>Смена применится у всех сразу.</div>
    </div>`;

  const btn = w.querySelector('.qcp-btn');
  if (!on) { btn.onclick = e => e.stopPropagation(); return; }

  btn.onclick = e => {
    e.stopPropagation();
    _pickers.forEach(p => { if (p !== w) p.classList.remove('open'); });
    w.classList.toggle('open');
  };
  w.querySelectorAll('.qcp-opt').forEach(b => {
    b.onclick = e => {
      e.stopPropagation();
      w.classList.remove('open');
      const g = w._groups[+b.dataset.g];
      const p = {}; p[g.field] = b.dataset.v;
      set(p);
    };
  });
}

function paintAll() {
  _pickers.forEach(paint);
  document.querySelectorAll('.qcp-dsheet').forEach(el => {
    el.innerHTML = (el._fields || []).map(f =>
      `${esc(f.label)}: <b>${esc(_cfg[f.field] || '—')}</b>`).join('<br>');
  });
}

document.addEventListener('click', () => _pickers.forEach(p => p.classList.remove('open')));

// ── МЕНЮ-ОВЕРЛЕЙ ─────────────────────────────────────────────
let _drawer = null;

function mountNav(target, opt) {
  css();
  opt = opt || {};
  const items = opt.items || [];
  const sheets = opt.sheets || [];

  if (!_drawer) {
    const ov = document.createElement('div');
    ov.className = 'qcp-ov';
    const dr = document.createElement('aside');
    dr.className = 'qcp-drawer';
    const u = auth().currentUser;

    dr.innerHTML = `
      <div class="qcp-dhead">
        <div>
          <div class="qcp-dtitle">${esc(opt.title || 'QCP')}</div>
          <div class="qcp-duser">${esc(u ? (u.email || '') : '')}${_role ? ' · ' + esc(_role) : ''}</div>
        </div>
        <button type="button" class="qcp-dclose">${I.close}</button>
      </div>
      <nav class="qcp-dnav"></nav>
      <div class="qcp-dfoot">
        <div class="qcp-dsheet"></div>
        <button type="button" class="qcp-out">Выйти</button>
      </div>`;

    document.body.appendChild(ov);
    document.body.appendChild(dr);

    const open  = () => { ov.classList.add('open'); dr.classList.add('open'); document.body.classList.add('qcp-lock'); };
    const close = () => { ov.classList.remove('open'); dr.classList.remove('open'); document.body.classList.remove('qcp-lock'); };

    const nav = dr.querySelector('.qcp-dnav');
    items.forEach(it => {
      const el = document.createElement(it.href ? 'a' : 'button');
      el.className = 'qcp-dlink' + (it.active ? ' on' : '');
      el.textContent = it.label;
      if (it.href) el.href = it.href; else el.type = 'button';
      el.addEventListener('click', () => {
        close();
        if (it.action) setTimeout(it.action, 60);
      });
      nav.appendChild(el);
    });

    dr.querySelector('.qcp-dsheet')._fields = sheets;

    ov.onclick = close;
    dr.querySelector('.qcp-dclose').onclick = close;
    dr.querySelector('.qcp-out').onclick = () =>
      auth().signOut().then(() => location.href = 'index.html');
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

    _drawer = { open, close, el: dr };
    paintAll();
  }

  hosts(target).forEach(host => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'qcp-navbtn' + (opt.mobileOnly ? ' qcp-mobile' : '');
    b.title = 'Меню';
    b.innerHTML = I.burger;
    b.onclick = _drawer.open;
    host.appendChild(b);
  });

  return _drawer;
}

// ── ИНИЦИАЛИЗАЦИЯ ────────────────────────────────────────────
async function init(o) {
  css();
  o = o || {};
  if (_inited) return _cfg;
  _inited = true;

  _defaults = Object.assign({}, o.defaults || {});
  _cfg = Object.assign({}, _defaults);
  _ids.main = o.sheetId || '';
  _ids.adv  = o.advSheetId || _defaults.advSheetId || '';

  _role = await fetchRole();
  const [m, a] = await Promise.all([
    _ids.main ? fetchTabs(_ids.main) : Promise.resolve([]),
    _ids.adv  ? fetchTabs(_ids.adv)  : Promise.resolve([]),
  ]);
  _tabs.main = m; _tabs.adv = a;

  watch();
  return _cfg;
}

// ── ПУБЛИЧНЫЙ API ────────────────────────────────────────────
global.QCP = {
  init, set,
  get(f)       { return _cfg[f]; },
  all()        { return Object.assign({}, _cfg); },
  role()       { return _role; },
  canSwitch,
  tabs(src)    { return (_tabs[src || 'main'] || []).slice(); },
  onChange(fn) { _changeCbs.push(fn); },
  mountPicker, mountNav,
  openMenu()   { _drawer && _drawer.open(); },
};

})(window);
