// 같은 주소의 다른 앱과 캐시 저장소를 같이 쓰므로 내 접두어 캐시만 지운다
const CACHE = 'last-broad-v1';
const CACHE_PREFIX = 'last-broad-v';
const CORE = ['./', './index.html', './style.css?v=5', './locale.js?v=5', './game.js?v=5', './studio.webp', './manifest.webmanifest', './ys-install.js', './ys-qr.js', './qr.svg', './icons/icon-192.png'];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || /\.(mp4|wav)$/.test(url.pathname)) return;
  e.respondWith(fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; })
    .catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
