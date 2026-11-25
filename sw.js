// 같은 주소의 다른 앱과 캐시 저장소를 같이 쓰므로 내 접두어 캐시만 지운다
const CACHE = 'last-broad-v12';
const CACHE_PREFIX = 'last-broad-v';
const AUDIO_CACHE = 'last-broad-audio-v1';
const audioPath = new URL('audio/', self.registration.scope).pathname;
const CORE = [
  './', './index.html', './style.css?v=16', './locale.js?v=16', './game.js?v=16',
  './studio.webp', './hall.webp', './hall-empty.webp', './archive.webp', './roof.webp', './pier.webp',
  './opening-harbor.webp', './opening-receiver.webp',
  './manifest.webmanifest', './ys-install.js', './ys-qr.js', './qr.svg', './icons/icon-192.png',
];
self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith(CACHE_PREFIX) && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith(audioPath) && url.pathname.endsWith('.wav')) {
    e.respondWith(caches.match(req, { cacheName: AUDIO_CACHE }).catch(() => undefined).then(hit => hit || fetch(req)));
    return;
  }
  if (/\.(mp4|wav)$/.test(url.pathname)) return;
  e.respondWith(fetch(req).then(res => { if (res.ok) { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); } return res; })
    .catch(() => caches.match(req).then(hit => hit || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))));
});
