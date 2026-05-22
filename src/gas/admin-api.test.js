const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createAdminContext(storedToken) {
  const context = {
    Logger: { log() {} },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            if (key === 'ADMIN_TOKEN') return storedToken;
            return null;
          },
        };
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'admin-api.js'), 'utf8');
  vm.runInContext(source, context);

  return context;
}

test('validateAdminToken fails closed when ADMIN_TOKEN is not configured', () => {
  const context = createAdminContext('');

  assert.equal(context.validateAdminToken('any-non-empty-token'), false);
});

test('validateAdminToken accepts only the configured ADMIN_TOKEN', () => {
  const context = createAdminContext('secret-token');

  assert.equal(context.validateAdminToken('secret-token'), true);
  assert.equal(context.validateAdminToken('wrong-token'), false);
});
