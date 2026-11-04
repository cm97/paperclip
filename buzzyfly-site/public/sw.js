// Offline support: keeps the app shell available so plans open without a connection.
var CACHE = "bf-study-v3";
var SHELL = ["/app", "/app.js?v=3", "/styles.css?v=2", "/pwa.js?v=1", "/favicon.svg", "/icon-192.png"];
self.addEventListener("install", function (e) {
	e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
	e.waitUntil(caches.keys().then(function (keys) {
		return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
	}).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
	var url = new URL(e.request.url);
	if (e.request.method !== "GET" || url.origin !== location.origin) return;
	// Never cache payment, unlock, admin, support or API responses.
	if (/^\/(buy|paypal|stripe|unlock|restore|admin|support|api)/.test(url.pathname)) return;
	e.respondWith(
		fetch(e.request).then(function (res) {
			if (res.ok && (url.pathname === "/app" || SHELL.indexOf(url.pathname + url.search) !== -1)) {
				var copy = res.clone();
				caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
			}
			return res;
		}).catch(function () {
			return caches.match(e.request).then(function (r) { return r || caches.match("/app"); });
		})
	);
});
