const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createApi(fetchImpl) {
  const context = {
    fetch: fetchImpl,
    setTimeout(callback) {
      callback();
    },
    window: {
      ART_VILLAGE_CONFIG: {
        GAS_API_URL: 'https://example.com/exec',
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
  vm.runInContext(source, context);

  return context.Api;
}

test('Api retries a transient menu fetch network failure', async () => {
  let callCount = 0;
  const Api = createApi((url) => {
    callCount += 1;
    assert.equal(url, 'https://example.com/exec?action=getMenu');

    if (callCount === 1) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }

    return Promise.resolve({
      ok: true,
      json() {
        return Promise.resolve({ success: true, data: { categories: ['麵食'], items: [] } });
      },
    });
  });

  const menu = await Api.getMenu();

  assert.equal(callCount, 2);
  assert.deepEqual(menu, { categories: ['麵食'], items: [] });
});

test('Api reports invalid non-JSON GAS deployments clearly', async () => {
  const Api = createApi(() => Promise.resolve({
    ok: true,
    json() {
      return Promise.reject(new SyntaxError('Unexpected token <'));
    },
  }));

  await assert.rejects(
    () => Api.getMenu(),
    /API 回傳不是 JSON/,
  );
});
