const CACHE = 'qcp-v1';

// Файлы которые кэшируем для офлайн работы
const STATIC = [
  '/index.html',
  '/panel.html',
  '/seller.html',
  '/manager.html',
  '/cert.html',
  '/manifest.json'
];

// Установка — кэшируем основные файлы
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(STATIC))
  );
  self.skipWaiting();
});

// Активация — удаляем старые кэши
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Запросы — сначала сеть, при ошибке кэш
self.addEventListener('fetch', e => {
  // Не кэшируем Firebase и Google Sheets запросы
  const url = e.request.url;
  if (url.includes('firestore') ||
      url.includes('firebase') ||
      url.includes('googleapis') ||
      url.includes('gstatic')) {
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Обновляем кэш при успешном запросе
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
