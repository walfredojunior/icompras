// Service worker do iCompras.
//
// Deliberadamente conservador: guarda em cache SÓ os arquivos internos do site
// que nunca mudam de conteúdo (/_next/static/...) e os ícones. Páginas, preços
// e imagens de produto passam direto para a rede, para o visitante nunca ver
// preço velho.
//
// (As notificações de queda de preço entram aqui numa etapa futura.)
const CACHE = "icompras-estatico-v1";
const PRE_CACHE = ["/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRE_CACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const cacheavel = url.pathname.startsWith("/_next/static/") || PRE_CACHE.includes(url.pathname);
  if (!cacheavel) return; // resto vai direto para a rede

  event.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copia = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copia));
          }
          return res;
        }),
    ),
  );
});
