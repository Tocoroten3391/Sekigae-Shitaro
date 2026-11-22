// 席替えし太郎：オフラインでも動かすための仕組み（サービスワーカー）
// https で開いたときだけ使われます。file:// で開いたときは、何も起きません。
// つながっているときは、いつも最新のファイルを取りに行き、取れたものを覚えます。
// つながっていないときだけ、覚えているファイルを使います。
const CACHE = "sekigae-files";
const CORE = ["./", "index.html", "script.js", "style.css", "changelog.js", "manifest.webmanifest"];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(CACHE)
            .then(cache => Promise.all(CORE.map(u => fetch(u, { cache: "no-cache" }).then(r => r.ok && cache.put(u, r)).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
    const req = event.request;
    if (req.method !== "GET") return;
    const url = new URL(req.url);
    // このアプリのフォルダの中だけを扱います（更新情報や GAS など、ほかへの通信は、そのままです）
    if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
    event.respondWith(
        fetch(req, { cache: "no-cache" })
            .then(res => {
                if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
                return res;
            })
            .catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? caches.match("index.html") : undefined)))
    );
});
