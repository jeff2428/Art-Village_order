var CACHE_NAME = 'av-cache-v2';
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
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
          .map(function(n) { return caches.delete(n); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  if (url.origin !== location.origin) {
    return;
  }

  var isNavigationRequest = event.request.mode === 'navigate';
  var cacheKey = isNavigationRequest ? './' : event.request;
  var ext = url.pathname.split('.').pop();
  if (!isNavigationRequest && ['js', 'css', 'html', 'json', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].indexOf(ext) === -1) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(function(cache) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response.ok) {
          cache.put(cacheKey, response.clone());
        }
        return response;
      });

      if (isNavigationRequest || ['html', 'js'].indexOf(ext) !== -1) {
        return fetchPromise.catch(function() {
          return cache.match(cacheKey);
        });
      }

      return cache.match(cacheKey).then(function(cached) {
        return cached || fetchPromise;
      });
    })
  );
});
