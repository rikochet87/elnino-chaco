/* Service worker: la app funciona sin conexión con la última emisión descargada. */
const VERSION = "v0.3.0";
const CACHE_APP = `app-${VERSION}`;
const CACHE_DATOS = "datos";

const APP = [
  "./",
  "index.html",
  "tecnica.html",
  "css/app.css",
  "js/comun.js",
  "js/ciudadana.js",
  "js/tecnica.js",
  "vendor/maplibre-gl.js",
  "vendor/maplibre-gl.css",
  "manifest.webmanifest",
  "icons/icono-192.png",
  "icons/icono-512.png",
  "fonts/ibm-plex-sans-latin-400-normal.woff2",
  "fonts/ibm-plex-sans-latin-500-normal.woff2",
  "fonts/ibm-plex-sans-latin-600-normal.woff2",
  "fonts/ibm-plex-sans-latin-700-normal.woff2",
  "fonts/ibm-plex-mono-latin-400-normal.woff2",
  "fonts/ibm-plex-mono-latin-500-normal.woff2",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_APP).then((c) => c.addAll(APP)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((claves) => Promise.all(claves.filter((k) => k.startsWith("app-") && k !== CACHE_APP).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  // Datos: primero la red (para tener la emisión nueva), si no hay conexión, la copia guardada.
  if (url.pathname.includes("/data/")) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          if (r.ok) { const copia = r.clone(); caches.open(CACHE_DATOS).then((c) => c.put(e.request, copia)); }
          return r;
        })
        .catch(() => caches.match(e.request, { ignoreSearch: true }))
    );
    return;
  }

  // Aplicación: primero la copia guardada, y se actualiza en segundo plano.
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((guardada) => {
      const red = fetch(e.request)
        .then((r) => {
          if (r.ok) { const copia = r.clone(); caches.open(CACHE_APP).then((c) => c.put(e.request, copia)); }
          return r;
        })
        .catch(() => guardada || (e.request.mode === "navigate" ? caches.match("index.html") : undefined));
      return guardada || red;
    })
  );
});
