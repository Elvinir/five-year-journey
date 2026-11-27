/* A Five-Year Journey · 离线缓存 Service Worker (v4：文档网络优先，修复更新不生效) */
var CACHE = 'five-year-journey-v4';
var ASSETS = [
  './', './index.html', './preset.html', './blank.html',
  './manifest-preset.webmanifest', './manifest-blank.webmanifest',
  './icon-192.png', './icon-512.png', './icon-180.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(ASSETS).catch(function () {});
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; })
      .map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); })
    .then(function () {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
        list.forEach(function (c) { c.postMessage({ type: 'RELOAD_NEW_VERSION' }); });
      });
    }).catch(function () {}));
});

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  var req = e.request;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var accept = (req.headers && req.headers.get('accept')) || '';
  var isDoc = req.mode === 'navigate' || accept.indexOf('text/html') >= 0 ||
    /\.html(\?|$)/.test(url.pathname) || url.pathname === '/' || /\/$/.test(url.pathname);

  if (isDoc) {
    // 文档：网络优先，离线回退缓存 —— 确保每次打开都拿到最新版本
    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.status === 200) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return resp;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || caches.match('./index.html');
        });
      })
    );
    return;
  }

  // 静态资源：缓存优先，后台更新
  e.respondWith(
    caches.match(req).then(function (hit) {
      var network = fetch(req).then(function (resp) {
        if (resp && resp.status === 200) {
          var copy = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return resp;
      }).catch(function () { return hit; });
      return hit || network;
    })
  );
});
