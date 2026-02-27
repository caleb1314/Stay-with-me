// sw.js - 仅用于满足 PWA 安装条件
self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
    // 默认放行所有请求，不做离线缓存，避免影响你后续更新代码
});
