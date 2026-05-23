const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createAdminApi(fetchImpl) {
  const context = {
    fetch: fetchImpl,
    setTimeout(callback) {
      callback();
    },
    window: {
      ART_VILLAGE_ADMIN_CONFIG: {
        GAS_API_URL: 'https://example.com/exec',
        ADMIN_TOKEN: 'test-token',
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'admin-api.js'), 'utf8');
  vm.runInContext(source, context);

  return context.AdminApi;
}

test('AdminApi retries transient network failures before surfacing an error', async () => {
  let callCount = 0;
  const AdminApi = createAdminApi((url, options) => {
    callCount += 1;
    assert.equal(url, 'https://example.com/exec');
    assert.equal(options.method, 'POST');

    if (callCount === 1) {
      return Promise.reject(new TypeError('Failed to fetch'));
    }

    return Promise.resolve({
      ok: true,
      json() {
        return Promise.resolve({ success: true, data: [] });
      },
    });
  });

  const result = await AdminApi.getMenuItems();

  assert.equal(callCount, 2);
  assert.deepEqual(result, { success: true, data: [] });
});

test('AdminApi gives a deploy-oriented message when fetch keeps failing', async () => {
  const AdminApi = createAdminApi(() => Promise.reject(new TypeError('Failed to fetch')));

  await assert.rejects(
    () => AdminApi.getMenuItems(),
    /GAS Web App URL 已重新部署/,
  );
});
