'use strict';

const CACHE = 'last-broad-school-v11';
const PREFIX = 'last-broad-school-';
const CORE = [
  './', './index.html', './school.css?v=11', './school-copy.js?v=11', './school.js?v=11',
  './media/school-studio.webp', './manifest.webmanifest', './ys-install.js', './ys-qr.js', './qr.svg',
  './icons/favicon-32.png', './icons/icon-192.png', './icons/apple-touch-icon.png',
  ...['future-review', 'opening', 'answer', 'door', 'question', 'hold', 'backup', 'clean', 'student', 'deadline-v6',
    'handoff-live', 'handoff-live-known', 'hold-known', 'backup-restart', 'backup-restart-known', 'close-clean', 'hold-answer', 'close-backup', 'winner-live', 'hold-student', 'winner-backup', 'practice', 'clean-reactions', 'backup-reactions', 'swap-brief', 'ready-yellow', 'ready-blue', 'epilogue-save', 'epilogue-clock', 'teacher-cue', 'classroom-cue', 'teacher-envelope']
    .map((name) => './audio/school-' + name + '.mp3'),
];

self.addEventListener('install', (event) => event.waitUntil(
  caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting())
));

self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE)
    .map((key) => caches.delete(key)))).then(() => self.clients.claim())
));

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.open(CACHE).then((cache) => cache.match('./index.html'))));
    return;
  }
  event.respondWith(caches.open(CACHE).then((cache) => cache.match(request).then((hit) => hit || fetch(request))));
});
