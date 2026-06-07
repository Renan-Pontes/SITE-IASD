// Service worker mínimo e seguro do IASD Gestão.
// Estratégia: network-first para navegação (HTML) com fallback ao shell em cache;
// cache-first para assets estáticos com hash. NUNCA cacheia /api (dados sempre frescos).

const CACHE = "iasd-shell-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Nunca interceptar a API nem mídia dinâmica.
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/media")) return;

  // Navegação (HTML): network-first, cai no shell em cache se offline.
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((resp) => {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copia));
          return resp;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  // Assets estáticos: cache-first com atualização em segundo plano.
  e.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((resp) => {
          if (resp.ok && url.origin === self.location.origin) {
            const copia = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copia));
          }
          return resp;
        }),
    ),
  );
});
