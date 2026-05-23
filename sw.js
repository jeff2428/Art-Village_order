var CACHE_NAME = 'av-cache-v1';
var PRECACHE_URLS = [
  './',
  './index.html',
  './dist/bundle.js',
  './config.js',
  './utils.js',
  './liff-auth.js',
  './api.js',
  './menu.js',
  './customization.js',
  './reservation.js',
  './announcement.js',
  './order-submit.js'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
          .map(function(n) { return caches.delete(n); })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  if (url.origin !== location.origin) {
    return;
  }

  var ext = url.pathname.split('.').pop();
  if (['js', 'css', 'html', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].indexOf(ext) === -1) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.match(event.request).then(function(cached) {
        var fetchPromise = fetch(event.request).then(function(response) {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
        return cached || fetchPromise;
      });
    })
  );
});
