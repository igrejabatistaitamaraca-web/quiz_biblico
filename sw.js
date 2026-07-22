const CACHE = "biblia-play-v1";
const APP_SHELL = [
  "./", "./index.html", "./tv_quiz.html", "./tv.html", "./controle.html", "./duelo.html",
  "./manifest.webmanifest", "./js/supabase.js", "./js/data-provider.js", "./js/game.js",
  "./js/questions.js", "./js/audio.js", "./js/tv.js", "./js/controle.js", "./js/duelo.js", "./js/pwa.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request)));
});
