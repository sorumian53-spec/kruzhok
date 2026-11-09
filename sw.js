// Служебный файл «Кружка»: принимает push-уведомления и открывает нужную страницу по клику.
// Ничего не сохраняет в память телефона, поэтому обновления сайта приходят сразу.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
// Нужен браузерам, чтобы разрешить установку сайта как приложения. Запросы идут как обычно.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = {}; }
  const title = String(d.title || 'Кружок').slice(0, 80);
  const opts = {
    body: String(d.body || '').slice(0, 200),
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: (typeof d.link === 'string' && d.link) ? d.link.slice(0, 100) : 'kruzhok',
    renotify: true,
    data: { link: typeof d.link === 'string' ? d.link.slice(0, 200) : '' }
  };
  e.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const link = (e.notification.data && e.notification.data.link) || '';
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of list) {
      if ('focus' in c) {
        await c.focus();
        c.postMessage({ type: 'go', link });
        return;
      }
    }
    await self.clients.openWindow('./?go=' + encodeURIComponent(link));
  })());
});
