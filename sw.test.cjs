const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('service worker canonicalizes shared-link navigation cache keys', async () => {
  const handlers = {};
  const cachedResponse = { source: 'app-shell-cache' };
  const networkResponse = {
    ok: true,
    clone() {
      return this;
    },
  };
  const matchedKeys = [];
  const storedKeys = [];
  let offline = false;

  const context = {
    URL,
    Promise,
    location: { origin: 'https://example.com' },
    fetch() {
      return offline
        ? Promise.reject(new Error('offline'))
        : Promise.resolve(networkResponse);
    },
    caches: {
      open() {
        return Promise.resolve({
          match(key) {
            matchedKeys.push(key);
            return Promise.resolve(key === './' ? cachedResponse : undefined);
          },
          put(key) {
            storedKeys.push(key);
            return Promise.resolve();
          },
        });
      },
      keys() {
        return Promise.resolve([]);
      },
      delete() {
        return Promise.resolve(true);
      },
    },
    self: {
      clients: { claim() { return Promise.resolve(); } },
      skipWaiting() {},
      addEventListener(type, handler) {
        handlers[type] = handler;
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'sw.js'), 'utf8');
  vm.runInContext(source, context);

  function navigate(url) {
    let responsePromise;
    handlers.fetch({
      request: { url, mode: 'navigate' },
      respondWith(promise) {
        responsePromise = promise;
      },
    });
    assert.ok(responsePromise, 'navigation must be handled by the service worker');
    return responsePromise;
  }

  const onlineResult = await navigate(
    'https://example.com/Art-Village_order/?sharedBy=%E7%8E%8B%E5%B0%8F%E6%98%8E'
  );
  assert.equal(onlineResult, networkResponse);
  assert.deepEqual(storedKeys, ['./']);

  offline = true;
  const offlineResult = await navigate(
    'https://example.com/Art-Village_order/?sharedBy=%E6%9D%8E%E5%B0%8F%E8%8F%AF'
  );
  assert.equal(offlineResult, cachedResponse);
  assert.deepEqual(matchedKeys, ['./']);
});
