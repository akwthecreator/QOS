/* ══════════════════════════════════════════════════════════════
   QCP ICONS — иконки из фирменной библиотеки (Figma)

   Использование:
     QCPIcons.get('chat-light')              → SVG 16px
     QCPIcons.get('chat-light', 20)          → SVG 20px
     QCPIcons.get('lock-fill', 14, { title: 'Закрыто' })   → с подписью для скринридера
     QCPIcons.get('chart', 18, { cls: 'my-icon', style: 'opacity:.6' })

   Цвет берётся из текста вокруг (currentColor), как у шрифта:
     <span style="color:var(--accent)">${QCPIcons.get('star-fill')}</span>

   Два файла:
     qcp-icons.js      — этот: движок + иконки, которые стоят на сайте
     qcp-icons-all.js  — вся библиотека; подключается после этого файла
                         и только там, где нужна (каталог, песочница дизайна)
   ══════════════════════════════════════════════════════════════ */
(function (global) {
'use strict';

const VERSION = '20260928a';
const LIB = {};
let uid = 0;
const warned = {};

// Вырезы в залитых иконках красятся в цвет фона карточки,
// чтобы в тёмной теме не появлялось белых пятен.
function injectCSS() {
  if (typeof document === 'undefined' || document.getElementById('qcp-icons-css')) return;
  const el = document.createElement('style');
  el.id = 'qcp-icons-css';
  el.textContent =
    ':root{--qi-cut:var(--bg2,#fff)}' +
    '.qi{display:inline-block;vertical-align:middle;flex-shrink:0;overflow:visible}';
  (document.head || document.documentElement).appendChild(el);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
}

function register(obj) {
  if (obj && typeof obj === 'object') Object.assign(LIB, obj);
  return QCPIcons;
}

function get(name, size, opts) {
  injectCSS();
  opts = opts || {};
  size = size || 16;
  const ic = LIB[name];
  if (!ic) {
    // Не роняем страницу из-за опечатки — пустое место и одно предупреждение
    if (!warned[name]) {
      warned[name] = 1;
      console.warn('[QCPIcons] нет иконки «' + name + '». ' +
        (Object.keys(LIB).length < 200 ? 'Может, она есть в qcp-icons-all.js — он подключён?' : 'Проверь имя в каталоге.'));
    }
    return '<svg class="qi qi-missing" width="' + size + '" height="' + size + '" aria-hidden="true"></svg>';
  }

  let body = ic.b;
  // Маски ссылаются на id. Если на странице две одинаковые иконки,
  // id совпадут и вторая возьмёт маску первой — делаем их уникальными.
  if (body.indexOf('id="') !== -1) {
    const sfx = '_q' + (++uid);
    body = body
      .replace(/\bid="([^"]+)"/g, 'id="$1' + sfx + '"')
      .replace(/url\(#([^)]+)\)/g, 'url(#$1' + sfx + ')')
      .replace(/href="#([^"]+)"/g, 'href="#$1' + sfx + '"');
  }

  const cls   = 'qi' + (opts.cls ? ' ' + esc(opts.cls) : '');
  const style = opts.style ? ' style="' + esc(opts.style) + '"' : '';
  const a11y  = opts.title ? ' role="img"' : ' aria-hidden="true" focusable="false"';
  const title = opts.title ? '<title>' + esc(opts.title) + '</title>' : '';

  return '<svg class="' + cls + '" width="' + size + '" height="' + size +
         '" viewBox="' + (ic.v || '0 0 24 24') + '" fill="none"' + a11y + style +
         ' xmlns="http://www.w3.org/2000/svg">' + title + body + '</svg>';
}

// ── Метки в разметке ─────────────────────────────────────────
// <i class="qi-slot" data-qi="bell" data-qs="20"></i>
// Работает одинаково в HTML и внутри JS-строк/шаблонов: как только метка
// попадает на страницу (разбор HTML или innerHTML), она заменяется на SVG.
// Замена происходит до отрисовки кадра, поэтому пустого места не видно.
function slot(name, size, style) {
  return '<i class="qi-slot" data-qi="' + esc(name) + '"' +
         (size ? ' data-qs="' + size + '"' : '') +
         (style ? ' style="' + esc(style) + '"' : '') + '></i>';
}

function hydrateEl(el) {
  const name = el.getAttribute('data-qi');
  if (!name || !el.parentNode) return;
  const tmp = document.createElement('span');
  tmp.innerHTML = get(name, +el.getAttribute('data-qs') || 16, {
    style: el.getAttribute('style') || '',
    cls:   el.getAttribute('data-qc') || '',
    title: el.getAttribute('title') || '',
  });
  const svg = tmp.firstChild;
  if (svg) el.parentNode.replaceChild(svg, el);
}

function hydrate(root) {
  root = root || document;
  if (root.nodeType === 1 && root.matches && root.matches('i.qi-slot')) { hydrateEl(root); return; }
  if (root.querySelectorAll) root.querySelectorAll('i.qi-slot').forEach(hydrateEl);
}

function watch() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return;
  const mo = new MutationObserver(list => {
    for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1) hydrate(n);
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });
  // Не сразу: набор иконок регистрируется ниже в этом же файле
  Promise.resolve().then(() => hydrate(document));
  document.addEventListener('DOMContentLoaded', () => hydrate(document));
}

// Разбор имени на базу и стиль — для каталога и поиска
const STYLE_RULES = [
  ['duotone-line', /duotone-(fill-)?line|light-duotone/],
  ['duotone',      /duotone/],
  ['fill',         /(^|-)fill($|-)/],
  ['light',        /(^|-)light($|-)/],
  ['line',         /(^|-)line($|-)/],
];
function styleOf(name) {
  for (const [s, re] of STYLE_RULES) if (re.test(name)) return s;
  return 'regular';
}
function baseOf(name) {
  return name.replace(/-\d+$/, '').split('-')[0];
}

global.QCPIcons = {
  VERSION,
  get, register, slot, hydrate,
  has(name)  { return !!LIB[name]; },
  list()     { return Object.keys(LIB).sort(); },
  count()    { return Object.keys(LIB).length; },
  styleOf, baseOf,
};

watch();

})(typeof window !== 'undefined' ? window : globalThis);

/* ── Иконки, которые стоят на сайте (42 шт.). Берутся из qcp-icons-all.js;
      warning нарисован отдельно — в библиотеке его нет ── */
QCPIcons.register({
"arrow-right-long":{"b":"<path d=\"M17 12H3\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M21.71 11.79L16.26 7.90C15.73 7.52 15 7.90 15 8.55V15.44C15 16.09 15.73 16.47 16.26 16.09L21.71 12.20C21.85 12.10 21.85 11.89 21.71 11.79Z\" fill=\"currentColor\"/>"},
"bell":{"b":"<path d=\"M6.44 7.96C6.76 5.14 9.15 3 12 3C14.84 3 17.23 5.14 17.55 7.96L17.80 10.23C17.80 10.26 17.80 10.27 17.81 10.29C17.93 11.41 18.30 12.50 18.88 13.47C18.89 13.48 18.89 13.49 18.91 13.52L19.49 14.48C20.01 15.35 20.27 15.79 20.22 16.15C20.18 16.39 20.06 16.61 19.87 16.76C19.59 17 19.08 17 18.06 17H5.93C4.91 17 4.40 17 4.12 16.76C3.93 16.61 3.81 16.39 3.77 16.15C3.72 15.79 3.98 15.35 4.50 14.48L5.08 13.52C5.10 13.49 5.10 13.48 5.11 13.47C5.69 12.50 6.06 11.41 6.18 10.29C6.19 10.27 6.19 10.26 6.19 10.23L6.44 7.96Z\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M8 17C8 17.52 8.10 18.04 8.30 18.53C8.50 19.01 8.80 19.45 9.17 19.82C9.54 20.19 9.98 20.49 10.46 20.69C10.95 20.89 11.47 21 12 21C12.52 21 13.04 20.89 13.53 20.69C14.01 20.49 14.45 20.19 14.82 19.82C15.19 19.45 15.49 19.01 15.69 18.53C15.89 18.04 16 17.52 16 17\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"boxes":{"b":"<path d=\"M16 12V15\" stroke=\"currentColor\" stroke-opacity=\".2\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M8 12V15\" stroke=\"currentColor\" stroke-opacity=\".2\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M9 4V7\" stroke=\"currentColor\" stroke-opacity=\".2\" stroke-width=\"2\" stroke-linecap=\"round\"/><rect x=\"5\" y=\"4\" width=\"8\" height=\"8\" rx=\"1.8\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M4 13.8C4 12.80 4.80 12 5.8 12H10.2C11.19 12 12 12.80 12 13.8V20H5.8C4.80 20 4 19.19 4 18.2V13.8Z\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M12 13.8C12 12.80 12.80 12 13.8 12H18.2C19.19 12 20 12.80 20 13.8V18.2C20 19.19 19.19 20 18.2 20H12V13.8Z\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"calendar":{"b":"<rect x=\"3\" y=\"6\" width=\"18\" height=\"15\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M4 11H20\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M9 16H15\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M8 3L8 7\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M16 3L16 7\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"chart":{"b":"<path d=\"M8 10L8 16\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M12 12V16\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M16 8V16\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"3\" y=\"4\" width=\"18\" height=\"16\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"chart-alt":{"b":"<path d=\"M17 9L13.95 13.56C13.52 14.20 12.57 14.14 12.22 13.45L11.77 12.54C11.42 11.85 10.47 11.79 10.04 12.43L7 17\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"chart-xy":{"b":"<path d=\"M12 3V21\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M21 12L3 12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M12 12H14C15.10 12 16 11.10 16 10V7C16 5.89 16.89 5 18 5H20\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M12 12H10C8.89 12 8 12.89 8 14V17C8 18.10 7.10 19 6 19H4\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"},
"check-ring":{"b":"<circle cx=\"12\" cy=\"12\" r=\"9\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M8 12L11 15L16 9\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"close-round":{"b":"<path d=\"M18 6L6 18\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M6 6L18 18\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"},
"copy":{"b":"<path d=\"M14 7C14 6.06 14 5.60 13.84 5.23C13.64 4.74 13.25 4.35 12.76 4.15C12.39 4 11.93 4 11 4H8C6.11 4 5.17 4 4.58 4.58C4 5.17 4 6.11 4 8V11C4 11.93 4 12.39 4.15 12.76C4.35 13.25 4.74 13.64 5.23 13.84C5.60 14 6.06 14 7 14\" stroke=\"currentColor\" stroke-width=\"2\"/><rect x=\"10\" y=\"10\" width=\"10\" height=\"10\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"done":{"b":"<path d=\"M5 14L9 17L18 6\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"expand-down":{"b":"<path d=\"M18 9L12 15L6 9\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"flask-alt":{"b":"<path d=\"M15 5V11.69C15 11.89 15.05 12.08 15.16 12.25L19.96 19.44C20.40 20.10 19.93 21 19.13 21H4.86C4.06 21 3.59 20.10 4.03 19.44L8.83 12.25C8.94 12.08 9 11.89 9 11.69V5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M16.9 18.2L14.8 15.4C14.61 15.14 14.31 15 14 15H10C9.68 15 9.38 15.14 9.2 15.4L7.1 18.2C6.85 18.52 7.08 19 7.5 19H16.5C16.91 19 17.14 18.52 16.9 18.2Z\" fill=\"currentColor\"/><path d=\"M7 5H17\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"},
"gps-fixed":{"b":"<circle cx=\"12\" cy=\"12\" r=\"7\" stroke=\"currentColor\" stroke-width=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"2\" fill=\"currentColor\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M12 5V3\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M19 12L21 12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M12 21L12 19\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M3 12H5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"group":{"b":"<circle cx=\"12\" cy=\"8\" r=\"3\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M15.26 8C15.53 7.54 15.97 7.20 16.48 7.06C16.99 6.93 17.54 7 18 7.26C18.45 7.53 18.79 7.97 18.93 8.48C19.06 8.99 18.99 9.54 18.73 10C18.46 10.45 18.03 10.79 17.51 10.93C17 11.06 16.45 10.99 16 10.73C15.54 10.46 15.20 10.03 15.06 9.51C14.93 9 15 8.45 15.26 8L15.26 8Z\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M5.26 8C5.53 7.54 5.97 7.20 6.48 7.06C6.99 6.93 7.54 7 8 7.26C8.45 7.53 8.79 7.97 8.93 8.48C9.06 8.99 8.99 9.54 8.73 10C8.46 10.45 8.03 10.79 7.51 10.93C7 11.06 6.45 10.99 6 10.73C5.54 10.46 5.20 10.03 5.06 9.51C4.93 9 5 8.45 5.26 8L5.26 8Z\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M16.88 18L15.90 18.19L16.06 19H16.88V18ZM20.72 16.90L21.66 16.56V16.56L20.72 16.90ZM14.78 14.71L14.17 13.91L13.01 14.79L14.25 15.55L14.78 14.71ZM19.86 17H16.88V19H19.86V17ZM19.77 17.23C19.77 17.21 19.76 17.18 19.77 17.13C19.78 17.09 19.79 17.05 19.81 17.03C19.84 16.99 19.87 17 19.86 17V19C21.01 19 22.14 17.91 21.66 16.56L19.77 17.23ZM17 15C18.64 15 19.40 16.18 19.77 17.23L21.66 16.56C21.19 15.25 19.94 13 17 13V15ZM15.38 15.50C15.77 15.21 16.28 15 17 15V13C15.83 13 14.90 13.36 14.17 13.91L15.38 15.50ZM14.25 15.55C15.29 16.20 15.72 17.33 15.90 18.19L17.86 17.80C17.64 16.72 17.03 14.93 15.30 13.86L14.25 15.55Z\" fill=\"currentColor\"/><path d=\"M9.21 14.71L9.74 15.55L10.98 14.79L9.82 13.91L9.21 14.71ZM3.27 16.90L4.22 17.23L4.22 17.23L3.27 16.90ZM7.11 18V19H7.93L8.09 18.19L7.11 18ZM7 15C7.71 15 8.22 15.21 8.61 15.50L9.82 13.91C9.09 13.36 8.16 13 7 13V15ZM4.22 17.23C4.59 16.18 5.35 15 7 15V13C4.05 13 2.80 15.25 2.33 16.56L4.22 17.23ZM4.13 17C4.12 17 4.15 16.99 4.18 17.03C4.20 17.05 4.21 17.09 4.22 17.13C4.23 17.18 4.22 17.21 4.22 17.23L2.33 16.56C1.85 17.91 2.98 19 4.13 19V17ZM7.11 17H4.13V19H7.11V17ZM8.09 18.19C8.27 17.33 8.70 16.20 9.74 15.55L8.69 13.86C6.96 14.93 6.35 16.72 6.13 17.80L8.09 18.19Z\" fill=\"currentColor\"/><path d=\"M12 14C15.57 14 16.59 16.55 16.88 18.00C16.99 18.55 16.55 19 16 19H8C7.44 19 7 18.55 7.11 18.00C7.40 16.55 8.42 14 12 14Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"home":{"b":"<path d=\"M5 12.75C5 11.40 5 10.72 5.27 10.12C5.54 9.52 6.06 9.08 7.09 8.20L8.09 7.34C9.95 5.74 10.89 4.95 12 4.95C13.10 4.95 14.04 5.74 15.90 7.34L16.90 8.20C17.93 9.08 18.45 9.52 18.72 10.12C19 10.72 19 11.40 19 12.75V17C19 18.88 19 19.82 18.41 20.41C17.82 21 16.88 21 15 21H9C7.11 21 6.17 21 5.58 20.41C5 19.82 5 18.88 5 17V12.75Z\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M14.5 21V16C14.5 15.44 14.05 15 13.5 15H10.5C9.94 15 9.5 15.44 9.5 16V21\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>"},
"hourglass":{"b":"<path d=\"M12 12L18.12 16.16C18.67 16.54 19 17.16 19 17.82V20.5C19 20.77 18.77 21 18.5 21H5.5C5.22 21 5 20.77 5 20.5V17.82C5 17.16 5.32 16.54 5.87 16.16L12 12ZM12 12L18.12 7.83C18.67 7.45 19 6.83 19 6.17V3.5C19 3.22 18.77 3 18.5 3H5.5C5.22 3 5 3.22 5 3.5V6.17C5 6.83 5.32 7.45 5.87 7.83L12 12Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M16 18.77V20.85C16 20.93 15.93 21 15.85 21H8.15C8.06 21 8 20.93 8 20.85V18.77C8 18.60 8.08 18.44 8.23 18.35L11.57 16.26C11.83 16.10 12.16 16.10 12.42 16.26L15.76 18.35C15.91 18.44 16 18.60 16 18.77Z\" fill=\"currentColor\"/>"},
"info":{"b":"<circle cx=\"12\" cy=\"12\" r=\"9\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M12.5 7.5C12.5 7.77 12.27 8 12 8C11.72 8 11.5 7.77 11.5 7.5C11.5 7.22 11.72 7 12 7C12.27 7 12.5 7.22 12.5 7.5Z\" fill=\"currentColor\" stroke=\"currentColor\"/><path d=\"M12 17V10\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"lightning":{"b":"<path d=\"M12.01 2.91L12.18 2.96C12.54 3.10 12.74 3.39 12.83 3.59C12.92 3.79 12.95 4.01 12.96 4.15C13 4.45 13 4.85 13 5.27V9.20H13.87C14.54 9.20 15.15 9.19 15.63 9.26C16.13 9.34 16.74 9.52 17.12 10.12C17.49 10.71 17.41 11.34 17.27 11.82C17.13 12.29 16.87 12.85 16.59 13.46L13.86 19.36C13.68 19.74 13.51 20.10 13.36 20.35C13.29 20.48 13.17 20.66 13 20.81C12.81 20.97 12.44 21.18 11.98 21.08C11.51 20.98 11.27 20.63 11.16 20.40C11.07 20.20 11.04 19.98 11.03 19.84C10.99 19.54 11 19.14 11 18.72V14.79H10.12C9.45 14.79 8.84 14.80 8.36 14.73C7.86 14.65 7.25 14.47 6.87 13.87C6.50 13.28 6.58 12.65 6.72 12.17C6.86 11.70 7.12 11.14 7.40 10.54L10.13 4.63C10.31 4.25 10.48 3.89 10.63 3.64C10.70 3.51 10.82 3.33 10.99 3.18C11.16 3.04 11.46 2.86 11.84 2.88L12.01 2.91Z\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"line-up":{"b":"<path d=\"M21 6L15.70 11.29C15.31 11.68 14.68 11.68 14.29 11.29L12.70 9.70C12.31 9.31 11.68 9.31 11.29 9.70L7 14\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M3 3V17.8C3 18.92 3 19.48 3.21 19.90C3.40 20.28 3.71 20.59 4.09 20.78C4.51 21 5.07 21 6.2 21H21\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"lock":{"b":"<path d=\"M4 13C4 11.11 4 10.17 4.58 9.58C5.17 9 6.11 9 8 9H16C17.88 9 18.82 9 19.41 9.58C20 10.17 20 11.11 20 13V15C20 17.82 20 19.24 19.12 20.12C18.24 21 16.82 21 14 21H10C7.17 21 5.75 21 4.87 20.12C4 19.24 4 17.82 4 15V13Z\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M16 8V7C16 4.79 14.20 3 12 3C9.79 3 8 4.79 8 7V8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"12\" cy=\"15\" r=\"2\" fill=\"currentColor\"/>"},
"menu":{"b":"<path d=\"M5 7H19\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M5 12H19\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M5 17H19\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"money":{"b":"<rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M6 9H8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M16 15H18\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"12\" cy=\"12\" r=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"moon-alt":{"b":"<path d=\"M11.43 18.97L11.51 17.98L11.43 18.97ZM9.71 18.48L10.69 18.26L9.71 18.48ZM11.94 5.21L12.50 4.38L11.94 5.21ZM18 12C18 8.68 15.31 6 12 6V4C16.41 4 20 7.58 20 12H18ZM12 18C15.31 18 18 15.31 18 12H20C20 16.41 16.41 20 12 20V18ZM11.51 17.98C11.67 17.99 11.83 18 12 18V20C11.78 20 11.56 19.99 11.35 19.97L11.51 17.98ZM10.96 16.21C12.78 15.18 14 13.23 14 10.99H16C16 13.98 14.36 16.57 11.95 17.95L10.96 16.21ZM14 10.99C14 8.93 12.96 7.12 11.37 6.03L12.50 4.38C14.61 5.82 16 8.25 16 10.99H14ZM11.35 19.97C10.84 19.93 10.34 19.89 9.96 19.80C9.61 19.72 8.91 19.49 8.73 18.70L10.69 18.26C10.65 18.09 10.54 17.95 10.44 17.88C10.36 17.83 10.33 17.84 10.42 17.86C10.50 17.88 10.62 17.89 10.82 17.92C11.01 17.94 11.23 17.95 11.51 17.98L11.35 19.97ZM11.95 17.95C11.32 18.31 10.93 18.54 10.69 18.71C10.58 18.80 10.57 18.82 10.60 18.78C10.65 18.71 10.74 18.52 10.69 18.26L8.73 18.70C8.64 18.27 8.78 17.90 8.95 17.64C9.11 17.41 9.32 17.23 9.50 17.10C9.86 16.84 10.38 16.54 10.96 16.21L11.95 17.95ZM12 6C12.45 6 12.76 5.67 12.85 5.34C12.94 5.02 12.84 4.62 12.50 4.38L11.37 6.03C10.93 5.74 10.81 5.22 10.92 4.81C11.04 4.39 11.43 4 12 4V6Z\" fill=\"currentColor\"/><path d=\"M5.4 10.2L5.4 10.2C5.50 10.50 5.55 10.65 5.60 10.72C5.80 10.98 6.19 10.98 6.39 10.72C6.44 10.65 6.49 10.50 6.6 10.2L6.6 10.2C6.68 9.95 6.72 9.83 6.77 9.72C6.97 9.30 7.30 8.97 7.72 8.77C7.83 8.72 7.95 8.68 8.2 8.6L8.2 8.6C8.50 8.49 8.65 8.44 8.72 8.39C8.98 8.19 8.98 7.80 8.72 7.60C8.65 7.55 8.50 7.50 8.2 7.4L8.2 7.4C7.95 7.31 7.83 7.27 7.72 7.22C7.30 7.02 6.97 6.69 6.77 6.27C6.72 6.16 6.68 6.04 6.6 5.8C6.49 5.49 6.44 5.34 6.39 5.27C6.19 5.01 5.80 5.01 5.60 5.27C5.55 5.34 5.50 5.49 5.4 5.8C5.31 6.04 5.27 6.16 5.22 6.27C5.02 6.69 4.69 7.02 4.27 7.22C4.16 7.27 4.04 7.31 3.8 7.4C3.49 7.50 3.34 7.55 3.27 7.60C3.01 7.80 3.01 8.19 3.27 8.39C3.34 8.44 3.49 8.49 3.8 8.6C4.04 8.68 4.16 8.72 4.27 8.77C4.69 8.97 5.02 9.30 5.22 9.72C5.27 9.83 5.31 9.95 5.4 10.2Z\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"notebook":{"b":"<rect x=\"6\" y=\"4\" width=\"13\" height=\"17\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M15 10V8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M4 9H8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M4 13H8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M4 17H8\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"pin-1":{"b":"<path d=\"M14.63 3.90C15.28 3.47 15.61 3.25 15.97 3.29C16.32 3.32 16.60 3.60 17.15 4.15L19.84 6.84C20.39 7.39 20.67 7.67 20.70 8.02C20.74 8.38 20.52 8.71 20.09 9.36L18.44 11.83C17.88 12.68 17.59 13.10 17.37 13.55C17.20 13.88 17.06 14.22 16.94 14.58C16.78 15.05 16.68 15.55 16.49 16.54L16.29 17.50C16.29 17.50 16.29 17.50 16.29 17.51C16.15 18.21 15.34 18.54 14.75 18.13C14.74 18.13 14.74 18.13 14.74 18.13C14.73 18.12 14.72 18.11 14.71 18.11C11.26 15.72 8.27 12.73 5.88 9.28C5.88 9.27 5.87 9.26 5.86 9.25C5.86 9.25 5.86 9.25 5.86 9.24C5.45 8.65 5.78 7.84 6.48 7.70C6.49 7.70 6.49 7.70 6.49 7.70L7.45 7.50C8.44 7.31 8.94 7.21 9.41 7.05C9.77 6.93 10.11 6.79 10.44 6.62C10.89 6.40 11.32 6.11 12.16 5.55L14.63 3.90Z\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M5 19L9.5 14.5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"refresh-2":{"b":"<path d=\"M14 15L10 19L14 23\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M18.06 8.5C18.67 9.56 19 10.77 19 12C19 13.22 18.67 14.43 18.06 15.5C17.44 16.56 16.56 17.44 15.5 18.06C14.43 18.67 13.22 19 12 19\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M10 9L14 5L10 1\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M5.93 15.5C5.32 14.43 5 13.22 5 12C5 10.77 5.32 9.56 5.93 8.5C6.55 7.43 7.43 6.55 8.5 5.93C9.56 5.32 10.77 5 12 5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"save":{"b":"<path d=\"M16 21V19C16 17.11 16 16.17 15.41 15.58C14.82 15 13.88 15 12 15H11C9.11 15 8.17 15 7.58 15.58C7 16.17 7 17.11 7 19V21\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M7 8H12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M3 9C3 6.17 3 4.75 3.87 3.87C4.75 3 6.17 3 9 3H16.17C16.58 3 16.78 3 16.96 3.07C17.15 3.15 17.29 3.29 17.58 3.58L20.41 6.41C20.70 6.70 20.84 6.84 20.92 7.03C21 7.21 21 7.41 21 7.82V15C21 17.82 21 19.24 20.12 20.12C19.24 21 17.82 21 15 21H9C6.17 21 4.75 21 3.87 20.12C3 19.24 3 17.82 3 15V9Z\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"send-hor":{"b":"<path d=\"M6.99 10.24L7.43 11.00C7.70 11.49 7.84 11.73 7.84 12C7.84 12.26 7.70 12.50 7.43 12.99L7.43 12.99L6.99 13.75C5.75 15.92 5.14 17 5.62 17.54C6.10 18.07 7.24 17.57 9.53 16.57L15.81 13.83C17.60 13.04 18.50 12.65 18.50 12C18.50 11.34 17.60 10.95 15.81 10.16L9.53 7.42C7.24 6.42 6.10 5.92 5.62 6.45C5.14 6.99 5.75 8.07 6.99 10.24Z\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"setting-alt-line":{"b":"<path d=\"M3.08 13.94C2.55 12.99 2.28 12.51 2.28 12C2.28 11.48 2.55 11 3.08 10.05L4.43 7.63L5.85 5.24C6.41 4.31 6.69 3.84 7.14 3.58C7.59 3.33 8.13 3.32 9.22 3.30L12 3.26L14.77 3.30C15.86 3.32 16.40 3.33 16.85 3.58C17.30 3.84 17.58 4.31 18.14 5.24L19.56 7.63L20.91 10.05C21.44 11 21.71 11.48 21.71 12C21.71 12.51 21.44 12.99 20.91 13.94L19.56 16.37L18.14 18.75C17.58 19.68 17.30 20.15 16.85 20.41C16.40 20.66 15.86 20.67 14.77 20.69L12 20.74L9.22 20.69C8.13 20.67 7.59 20.66 7.14 20.41C6.69 20.15 6.41 19.68 5.85 18.75L4.43 16.37L3.08 13.94Z\" stroke=\"currentColor\" stroke-width=\"2\"/><circle cx=\"12\" cy=\"12\" r=\"3\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"sign-out-squre":{"b":"<path d=\"M2 12L1.21 11.37L0.71 12L1.21 12.62L2 12ZM11 13C11.55 13 12 12.55 12 12C12 11.44 11.55 11 11 11V13ZM5.21 6.37L1.21 11.37L2.78 12.62L6.78 7.62L5.21 6.37ZM1.21 12.62L5.21 17.62L6.78 16.37L2.78 11.37L1.21 12.62ZM2 13H11V11H2V13Z\" fill=\"currentColor\"/><path d=\"M10 8.13V7.38C10 5.77 10 4.96 10.47 4.40C10.94 3.84 11.74 3.70 13.34 3.44L15.01 3.16C18.25 2.62 19.87 2.35 20.93 3.25C22 4.15 22 5.79 22 9.08V14.91C22 18.20 22 19.84 20.93 20.74C19.87 21.64 18.25 21.37 15.01 20.83L13.34 20.55C11.74 20.29 10.94 20.15 10.47 19.59C10 19.03 10 18.22 10 16.61V16.06\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"star":{"b":"<path d=\"M10.14 6.62C10.93 4.66 11.32 3.68 12 3.68C12.67 3.68 13.06 4.66 13.85 6.62L13.89 6.71C14.33 7.82 14.55 8.38 15.01 8.71C15.46 9.05 16.05 9.10 17.24 9.21L17.46 9.23C19.40 9.40 20.38 9.49 20.59 10.11C20.79 10.73 20.07 11.38 18.63 12.70L18.14 13.14C17.41 13.80 17.05 14.14 16.88 14.57C16.84 14.65 16.82 14.74 16.80 14.82C16.68 15.28 16.79 15.76 17.01 16.73L17.07 17.03C17.47 18.80 17.66 19.69 17.32 20.07C17.19 20.21 17.02 20.32 16.84 20.37C16.34 20.50 15.64 19.93 14.23 18.78C13.30 18.03 12.84 17.65 12.31 17.56C12.10 17.53 11.89 17.53 11.68 17.56C11.15 17.65 10.69 18.03 9.76 18.78C8.35 19.93 7.65 20.50 7.15 20.37C6.97 20.32 6.80 20.21 6.67 20.07C6.33 19.69 6.52 18.80 6.92 17.03L6.98 16.73C7.20 15.76 7.31 15.28 7.19 14.82C7.17 14.74 7.15 14.65 7.11 14.57C6.94 14.14 6.58 13.80 5.85 13.14L5.36 12.70C3.92 11.38 3.20 10.73 3.40 10.11C3.61 9.49 4.59 9.40 6.53 9.23L6.75 9.21C7.94 9.10 8.53 9.05 8.98 8.71C9.44 8.38 9.66 7.82 10.10 6.71L10.14 6.62Z\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"stat":{"b":"<rect x=\"18\" y=\"7\" width=\"4\" height=\"13\" rx=\"1\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><rect x=\"10\" y=\"13\" width=\"4\" height=\"7\" rx=\"1\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><rect x=\"2\" y=\"9\" width=\"4\" height=\"11\" rx=\"1\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/>"},
"sun-1":{"b":"<circle cx=\"12\" cy=\"12\" r=\"3\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M12 5V3\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M12 21V19\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M16.94 7.05L18.36 5.63\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M5.63 18.36L7.05 16.94\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M19 12L21 12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M3 12L5 12\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M16.94 16.94L18.36 18.36\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M5.63 5.63L7.05 7.05\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"table":{"b":"<path d=\"M15 9H21V18C21 18.94 21 19.41 20.70 19.70C20.41 20 19.94 20 19 20H15V9Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M3 9H9V20H5C4.05 20 3.58 20 3.29 19.70C3 19.41 3 18.94 3 18V9Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><rect x=\"9\" y=\"9\" width=\"6\" height=\"11\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M3 6C3 5.05 3 4.58 3.29 4.29C3.58 4 4.05 4 5 4H19C19.94 4 20.41 4 20.70 4.29C21 4.58 21 5.05 21 6V9H3V6Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"ticket":{"b":"<path d=\"M3 8.5C3 7.10 3 6.40 3.22 5.85C3.53 5.11 4.11 4.53 4.85 4.22C5.40 4 6.10 4 7.5 4H16.5C17.89 4 18.59 4 19.14 4.22C19.88 4.53 20.46 5.11 20.77 5.85C21 6.40 21 7.10 21 8.5V9.25C21 9.66 20.66 10 20.25 10H20C18.89 10 18 10.89 18 12C18 13.10 18.89 14 20 14H20.25C20.66 14 21 14.33 21 14.75V15.5C21 16.89 21 17.59 20.77 18.14C20.46 18.88 19.88 19.46 19.14 19.77C18.59 20 17.89 20 16.5 20H7.5C6.10 20 5.40 20 4.85 19.77C4.11 19.46 3.53 18.88 3.22 18.14C3 17.59 3 16.89 3 15.5V14.75C3 14.33 3.33 14 3.75 14H4C5.10 14 6 13.10 6 12C6 10.89 5.10 10 4 10H3.75C3.33 10 3 9.66 3 9.25V8.5Z\" stroke=\"currentColor\" stroke-width=\"2\"/><path d=\"M11.55 10.68C11.72 10.25 11.80 10.03 11.94 10.00C11.98 9.99 12.01 9.99 12.05 10.00C12.19 10.03 12.27 10.25 12.44 10.68C12.53 10.93 12.58 11.05 12.67 11.14C12.70 11.16 12.72 11.18 12.75 11.20C12.86 11.27 12.98 11.28 13.24 11.30C13.68 11.34 13.90 11.36 13.97 11.49C13.98 11.52 13.99 11.55 13.99 11.58C14.02 11.72 13.85 11.87 13.53 12.18L13.44 12.26C13.29 12.40 13.22 12.47 13.18 12.56C13.15 12.62 13.13 12.67 13.12 12.73C13.11 12.83 13.13 12.93 13.18 13.14L13.19 13.21C13.27 13.58 13.31 13.77 13.26 13.86C13.22 13.94 13.14 13.99 13.05 13.99C12.94 14 12.80 13.88 12.52 13.64C12.34 13.48 12.24 13.41 12.14 13.38C12.05 13.35 11.95 13.35 11.85 13.38C11.75 13.41 11.65 13.48 11.47 13.64C11.19 13.88 11.05 14 10.94 13.99C10.85 13.99 10.77 13.94 10.73 13.86C10.68 13.77 10.72 13.58 10.80 13.21L10.81 13.14C10.86 12.93 10.88 12.83 10.87 12.73C10.86 12.67 10.84 12.62 10.81 12.56C10.77 12.47 10.70 12.40 10.55 12.26L10.46 12.18C10.14 11.87 9.97 11.72 10 11.58C10 11.55 10.01 11.52 10.02 11.49C10.09 11.36 10.31 11.34 10.75 11.30C11.01 11.28 11.13 11.27 11.24 11.20C11.27 11.18 11.29 11.16 11.32 11.14C11.41 11.05 11.46 10.93 11.55 10.68Z\" fill=\"currentColor\" stroke=\"currentColor\"/>"},
"ticket-alt":{"b":"<path d=\"M18 21V2.99L15 4.99L12 2.99L9 4.99L6 2.99V21L9 19.5L12 21L15 19.5L18 21Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M10 9H14\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M10 15H14\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M10 12H14\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"transfer-long-right":{"b":"<path d=\"M2 10H14V6.43C14 6.26 14.20 6.17 14.33 6.28L21 12L14.33 17.71C14.20 17.82 14 17.73 14 17.56V14H2\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"trophy":{"b":"<path d=\"M16.5 20.5H7.5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M13 18.5C13 19.05 12.55 19.5 12 19.5C11.44 19.5 11 19.05 11 18.5H13ZM11 18.5V16H13V18.5H11Z\" fill=\"currentColor\"/><path d=\"M10.5 9.5H13.5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M5.5 14.5C5.5 14.5 3.5 13 3.5 10.5C3.5 9.73 3.5 9.06 3.5 8.49C3.5 7.39 4.39 6.5 5.5 6.5C6.60 6.5 7.5 7.39 7.5 8.5V9.5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M18.5 14.5C18.5 14.5 20.5 13 20.5 10.5C20.5 9.73 20.5 9.06 20.5 8.49C20.5 7.39 19.60 6.5 18.5 6.5C17.39 6.5 16.5 7.39 16.5 8.5V9.5\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M16.5 11.35V7.5C16.5 6.39 15.60 5.5 14.5 5.5H9.5C8.39 5.5 7.5 6.39 7.5 7.5V11.35C7.5 12.69 8.16 13.94 9.28 14.68L11.44 16.13C11.78 16.35 12.21 16.35 12.55 16.13L14.71 14.68C15.83 13.94 16.5 12.69 16.5 11.35Z\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"user":{"b":"<path d=\"M19.72 20.44C19.27 19.17 18.26 18.04 16.87 17.23C15.47 16.43 13.76 16 12 16C10.23 16 8.52 16.43 7.12 17.23C5.73 18.04 4.72 19.17 4.27 20.44\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"12\" cy=\"8\" r=\"4\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/>"},
"wallet":{"b":"<path d=\"M3 6.5L3 17C3 18.88 3 19.82 3.58 20.41C4.17 21 5.11 21 7 21L19 21C19.94 21 20.41 21 20.70 20.70C21 20.41 21 19.94 21 19L21 17M21 17L21 13L21 11C21 10.05 21 9.58 20.70 9.29C20.41 9 19.94 9 19 9L5.50 9C4.11 9 3 7.88 3 6.5M3 6.5C3 5.11 4.11 4 5.50 4L19.28 4C19.48 4 19.58 4 19.66 4.02C19.80 4.07 19.92 4.19 19.97 4.33C20 4.41 20 4.51 20 4.71C20 5.91 20 6.50 19.83 6.99C19.53 7.85 18.85 8.53 17.99 8.83C17.50 9 16.91 9 15.71 9L15 9M21 17H17C16.05 17 15.58 17 15.29 16.70C15 16.41 15 15.94 15 15C15 14.05 15 13.58 15.29 13.29C15.58 13 16.05 13 17 13H21\" stroke=\"currentColor\" stroke-width=\"2\"/>"},
"warning":{"b":"<path d=\"M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M12 9v4\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M12 17h.01\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\"/>"}
});
