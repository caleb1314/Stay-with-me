// 完整的 Service Worker，满足 Chrome 的安装审查
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // 拦截请求，让浏览器认为我们具备离线能力
    event.respondWith(
        fetch(event.request).catch(() => {
            return new Response('Offline');
        })
    );
});
