/* ══════════════════════════════════════════════════════════════
   QCP CORE — общий модуль для всех страниц QCP

   ГЛАВНОЕ: период (месяц) один на всю компанию.
   Firestore: config/active_sheet → { period: "Сентябрь" }
   Каждая страница сама находит свой лист по месяцу:
     manager  → "СЕНТЯБРЬ KPI" и "ЗП Сентябрь"
     seller   → "ЗП Сентябрь"
     advanced → "Сентябрь" (в своей таблице)
   Поэтому рассинхрона между страницами больше быть не может.

   Подключение: <script src="qcp-core.js"></script> после firebase-*-compat.js
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

// ── КТО МОЖЕТ МЕНЯТЬ ПЕРИОД ──────────────────────────────────
// Остальные роли видят месяц, но переключать не могут.
// Хочешь разрешить всем — поставь пустой массив: []
const CAN_SWITCH = ['admin', 'manager'];

const CFG_COLL = 'config';
const CFG_DOC  = 'active_sheet';
const API_KEY  = 'AIzaSyAQ-RAQTV4S7hA1xWmvbITudc9l_wjC8nw';

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const STEMS  = ['янв','февр','март','апрел','май','июн',
                'июл','авг','сент','октяб','нояб','декаб'];

// ── СОСТОЯНИЕ ────────────────────────────────────────────────
let _db = null, _auth = null;
let _role = null;
let _period = null;              // "Сентябрь"
let _over = {};                  // ручные переопределения листов
let _resolvers = {};             // { kpiSheet: {source, match}, ... }
let _fallback = {};              // на случай если лист не найден
let _tabs = { main: [], adv: [] };
let _ids  = { main: '', adv: '' };
let _resolved = {};
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
  min-width:200px;max-height:min(60vh,420px);overflow-y:auto;
  background:var(--bg2,#141414);border:1px solid var(--border2,#333);
  border-radius:14px;padding:6px;
}
.qcp-picker.open .qcp-menu{display:block}
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
.qcp-sec{padding:12px 12px 2px}
.qcp-sect{font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;
  color:var(--text3,#555);padding:0 4px 8px}
.qcp-chips{display:flex;flex-wrap:wrap;gap:6px}
.qcp-chip{
  padding:8px 12px;border-radius:20px;
  border:1px solid var(--border2,#333);background:var(--bg3,#1e1e1e);
  color:var(--text2,#aaa);font-family:inherit;font-size:12px;font-weight:600;
  line-height:1;cursor:pointer;transition:border-color .12s,color .12s;
}
.qcp-chip:hover{color:var(--text,#fff)}
.qcp-chip.on{border-color:var(--accent,#0066ff);color:var(--accent,#0066ff)}
.qcp-chip[disabled]{opacity:.5;cursor:default}
.qcp-dsep{height:1px;background:var(--border,#2a2a2a);margin:12px 12px 2px}
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
  cal:   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
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

// ── МЕСЯЦЫ ───────────────────────────────────────────────────
// Какой месяц зашит в названии листа: "ЗП Сентябрь" → "Сентябрь"
function monthOf(tab) {
  const t = String(tab || '').toLowerCase();
  for (let i = 0; i < MONTHS.length; i++) {
    if (t.indexOf(MONTHS[i].toLowerCase()) > -1) return MONTHS[i];
  }
  for (let i = 0; i < STEMS.length; i++) {
    if (t.indexOf(STEMS[i]) > -1) return MONTHS[i];
  }
  return null;
}

// Месяцы, для которых реально есть листы во всех нужных таблицах
function availableMonths() {
  const seen = {};
  Object.keys(_resolvers).forEach(f => {
    const r = _resolvers[f];
    (_tabs[r.source === 'adv' ? 'adv' : 'main'] || []).forEach(tab => {
      if (!r.match(tab)) return;
      const m = monthOf(tab);
      if (m) seen[m] = true;
    });
  });
  const out = MONTHS.filter(m => seen[m]);
  if (_period && out.indexOf(_period) === -1) out.push(_period);
  return out;
}

// Найти лист для поля при данном месяце
function resolveField(field, month) {
  if (_over[field]) return _over[field];
  const r = _resolvers[field];
  if (!r || !month) return _fallback[field] || null;
  const list = _tabs[r.source === 'adv' ? 'adv' : 'main'] || [];
  const hit = list.find(tab => r.match(tab) && monthOf(tab) === month);
  return hit || _fallback[field] || null;
}

function recompute() {
  const next = {};
  Object.keys(_resolvers).forEach(f => { next[f] = resolveField(f, _period); });
  const changed = Object.keys(next).filter(f => next[f] !== _resolved[f]);
  _resolved = next;
  return changed;
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

// ── ПОДПИСКА НА КОНФИГ ───────────────────────────────────────
function watch(seedMonth) {
  if (_unsub) _unsub();
  _unsub = db().collection(CFG_COLL).doc(CFG_DOC).onSnapshot(snap => {
    const d = snap.exists ? (snap.data() || {}) : {};

    const prevPeriod = _period;
    _period = (typeof d.period === 'string' && d.period.trim()) ? d.period.trim() : null;

    _over = {};
    Object.keys(_resolvers).forEach(f => {
      if (typeof d[f] === 'string' && d[f].trim()) _over[f] = d[f].trim();
    });

    // Документа ещё нет — сеем текущий месяц, чтобы все встали на одно
    if (!_period && seedMonth && canSwitch()) {
      setPeriod(seedMonth);
      return;
    }
    if (!_period) _period = seedMonth || null;

    const changed = recompute();
    paintAll();
    if (changed.length || _period !== prevPeriod) {
      _changeCbs.forEach(fn => {
        try { fn(_resolved, changed, _period); } catch (e) { console.error('[QCP]', e); }
      });
    }
  }, err => console.error('[QCP] config:', err));
}

// Смена месяца: чистим ручные переопределения, иначе они «залипают»
// и страницы снова разъезжаются по разным месяцам.
async function setPeriod(month) {
  if (!month || !canSwitch()) return;
  const patch = {
    period: month,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: (auth().currentUser || {}).email || 'unknown'
  };
  Object.keys(_resolvers).forEach(f => {
    patch[f] = firebase.firestore.FieldValue.delete();
  });
  try {
    await db().collection(CFG_COLL).doc(CFG_DOC).set(patch, { merge: true });
  } catch (e) {
    console.error('[QCP] запись периода:', e);
    alert('Не удалось сменить месяц: ' + e.message);
  }
}

// Ручное переопределение одного листа (используют настройки админа)
async function setSheet(field, value) {
  if (!value || !canSwitch()) return;
  const patch = {
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: (auth().currentUser || {}).email || 'unknown'
  };
  patch[field] = value;
  const m = monthOf(value);
  if (m) patch.period = m;
  try {
    await db().collection(CFG_COLL).doc(CFG_DOC).set(patch, { merge: true });
  } catch (e) {
    console.error('[QCP] запись листа:', e);
  }
}

// ── ВЫБОР МЕСЯЦА (кнопка в шапке) ────────────────────────────
const _pickers = [];

function mountPicker(target) {
  css();
  hosts(target).forEach(host => {
    const w = document.createElement('div');
    w.className = 'qcp-picker';
    host.appendChild(w);
    _pickers.push(w);
    paint(w);
  });
  return _pickers;
}

function paint(w) {
  const on = canSwitch();
  const months = availableMonths();

  w.innerHTML = `
    <button type="button" class="qcp-btn${on ? '' : ' locked'}"
      title="${on ? 'Выбрать месяц' : 'Месяц задаёт админ или менеджер'}">
      ${I.cal}<span class="qcp-cur">${esc(_period || 'Месяц…')}</span>${on ? I.chev : I.lock}
    </button>
    <div class="qcp-menu">
      ${months.map(m => `<button type="button" class="qcp-opt${m === _period ? ' on' : ''}" data-m="${esc(m)}">
        <span class="qcp-tick">${m === _period ? I.tick : ''}</span><span>${esc(m)}</span>
      </button>`).join('') || '<div class="qcp-note">Листы не загружены</div>'}
      <div class="qcp-note">Месяц общий для всех страниц и сотрудников.</div>
    </div>`;

  const btn = w.querySelector('.qcp-btn');
  if (!on) { btn.onclick = e => e.stopPropagation(); return; }

  btn.onclick = e => {
    e.stopPropagation();
    _pickers.forEach(p => { if (p !== w) p.classList.remove('open'); });
    w.classList.toggle('open');
  };
  w.querySelectorAll('.qcp-opt').forEach(b => {
    b.onclick = e => { e.stopPropagation(); w.classList.remove('open'); setPeriod(b.dataset.m); };
  });
}

document.addEventListener('click', () => _pickers.forEach(p => p.classList.remove('open')));

// ── МЕНЮ-ОВЕРЛЕЙ ─────────────────────────────────────────────
let _drawer = null;
const _secs = [];

function paintSec(box) {
  const sec = box._sec;
  const wrap = box.querySelector('.qcp-chips');

  if (sec.kind === 'period') {
    const on = canSwitch();
    const months = availableMonths();
    wrap.innerHTML = months.map(m =>
      `<button type="button" class="qcp-chip${m === _period ? ' on' : ''}"
        data-v="${esc(m)}" ${on ? '' : 'disabled'}>${esc(m)}</button>`).join('')
      || '<div class="qcp-sect" style="padding:0 4px">Листы не загружены</div>';
    if (!on) return;
    wrap.querySelectorAll('.qcp-chip').forEach(b => {
      b.onclick = () => setPeriod(b.dataset.v);
    });
    return;
  }

  wrap.innerHTML = (sec.items || []).map(it =>
    `<button type="button" class="qcp-chip${it.value === sec.value ? ' on' : ''}"
      data-v="${esc(it.value)}">${esc(it.label)}</button>`).join('');
  wrap.querySelectorAll('.qcp-chip').forEach(b => {
    b.onclick = () => {
      const it = (sec.items || []).find(x => String(x.value) === b.dataset.v);
      if (!it) return;
      sec.value = it.value;
      paintSec(box);
      if (it.action) it.action();
      if (!sec.keepOpen && _drawer) _drawer.close();
    };
  });
}

function navSet(group, value) {
  _secs.forEach(box => {
    if (box._sec.group !== group) return;
    box._sec.value = value;
    paintSec(box);
  });
}

function paintAll() {
  _pickers.forEach(paint);
  _secs.forEach(b => { if (b._sec.kind === 'period') paintSec(b); });
  document.querySelectorAll('.qcp-dsheet').forEach(el => {
    const rows = [`Месяц: <b>${esc(_period || '—')}</b>`];
    (el._fields || []).forEach(f =>
      rows.push(`${esc(f.label)}: <b>${esc(_resolved[f.field] || '—')}</b>`));
    el.innerHTML = rows.join('<br>');
  });
}

function mountNav(target, opt) {
  css();
  opt = opt || {};
  const items = opt.items || [];

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
    function addLinks(list) {
      list.forEach(it => {
        const el = document.createElement(it.href ? 'a' : 'button');
        el.className = 'qcp-dlink' + (it.active ? ' on' : '');
        el.textContent = it.label;
        if (it.href) el.href = it.href; else el.type = 'button';
        el.addEventListener('click', () => {
          if (!it.keepOpen) close();
          if (it.action) setTimeout(it.action, it.keepOpen ? 0 : 60);
        });
        nav.appendChild(el);
      });
    }
    addLinks(items);

    (opt.sections || []).forEach(sec => {
      const sep = document.createElement('div');
      sep.className = 'qcp-dsep';
      nav.appendChild(sep);

      if (sec.kind === 'list') {
        if (sec.label) {
          const t = document.createElement('div');
          t.className = 'qcp-sec'; t.style.paddingBottom = '0';
          t.innerHTML = `<div class="qcp-sect">${esc(sec.label)}</div>`;
          nav.appendChild(t);
        }
        addLinks(sec.items || []);
        return;
      }

      const box = document.createElement('div');
      box.className = 'qcp-sec';
      box.innerHTML = `<div class="qcp-sect">${esc(sec.label || '')}</div><div class="qcp-chips"></div>`;
      box._sec = sec;
      nav.appendChild(box);
      _secs.push(box);
      paintSec(box);
    });

    dr.querySelector('.qcp-dsheet')._fields = opt.sheets || [];

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
  if (_inited) return _resolved;
  _inited = true;

  _resolvers = o.resolvers || {};
  _fallback  = o.fallback  || {};
  _ids.main  = o.sheetId    || '';
  _ids.adv   = o.advSheetId || '';

  _role = await fetchRole();
  const [m, a] = await Promise.all([
    _ids.main ? fetchTabs(_ids.main) : Promise.resolve([]),
    _ids.adv  ? fetchTabs(_ids.adv)  : Promise.resolve([]),
  ]);
  _tabs.main = m; _tabs.adv = a;

  // если конфига ещё нет — на что вставать по умолчанию
  const seed = o.seedMonth
    || monthOf(_fallback[Object.keys(_fallback)[0]] || '')
    || MONTHS[new Date().getMonth()];

  watch(seed);
  return _resolved;
}

// ── ПУБЛИЧНЫЙ API ────────────────────────────────────────────
global.QCP = {
  init,
  get(f)       { return _resolved[f] || _fallback[f] || null; },
  period()     { return _period; },
  setPeriod, setSheet,
  months()     { return availableMonths(); },
  monthOf,
  role()       { return _role; },
  canSwitch,
  tabs(src)    { return (_tabs[src || 'main'] || []).slice(); },
  onChange(fn) { _changeCbs.push(fn); },
  mountPicker, mountNav, navSet,
  openMenu()   { _drawer && _drawer.open(); },
};

})(window);
