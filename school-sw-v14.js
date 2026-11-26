'use strict';

const CACHE = 'last-broad-school-v14';
const PREFIX = 'last-broad-school-';
const RUNTIME = ['./school.css?v=14', './school-copy.js?v=14', './school.js?v=14'];
const runtimeUrls = new Set(RUNTIME.map((path) => new URL(path, self.registration.scope).href));
const CORE = [
  './', './index.html', ...RUNTIME,
  './media/school-studio.webp', './manifest.webmanifest', './ys-install.js', './ys-qr.js', './qr.svg',
  './icons/favicon-32.png', './icons/icon-192.png', './icons/apple-touch-icon.png',
  ...['future-review', 'opening', 'answer', 'door', 'question', 'hold-reason', 'backup', 'clean', 'student', 'deadline-v6',
    'handoff-live', 'handoff-live-known', 'hold-reason-known', 'backup-restart', 'backup-restart-known', 'close-clean', 'hold-answer', 'close-backup', 'winner-live', 'hold-student', 'winner-backup', 'practice', 'clean-reactions', 'backup-reactions', 'swap-brief', 'ready-yellow', 'ready-blue', 'epilogue-save', 'epilogue-clock', 'teacher-cue', 'classroom-cue', 'teacher-envelope', 'teacher-handoff']
    .map((name) => './audio/school-' + name + '.mp3'),
];

self.addEventListener('install', (event) => event.waitUntil(
  caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
));

self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim())
));

async function refreshRuntime(request) {
  const cache = await caches.open(CACHE);
  const response = await fetch(request, { cache: 'no-store' }).catch(() => null);
  if (!response?.ok) return (await cache.match(request)) ?? response ?? Response.error();
  await cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then((cache) => cache.match('./index.html'))));
    return;
  }
  if (runtimeUrls.has(url.href)) {
    event.respondWith(refreshRuntime(request));
    return;
  }
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(request).then((hit) => hit || fetch(request))));
});
