// Прежний сервис-воркер приложения (/PWA-Budget/sw.js): при проверке обновления браузер получает этот файл,
// который чистит кэш и снимает регистрацию — дальше старый адрес открывается из сети и перенаправляет на сайт MBT.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
    })(),
  )
})
