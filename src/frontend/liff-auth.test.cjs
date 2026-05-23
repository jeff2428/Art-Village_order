const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createContext() {
  const storageWrites = [];
  const storageRemovals = [];
  const context = {
    console,
    localStorage: {
      getItem(key) {
        throw new Error(`Unexpected localStorage read: ${key}`);
      },
      setItem(key, value) {
        storageWrites.push([key, value]);
      },
      removeItem(key) {
        storageRemovals.push(key);
      },
    },
    liff: {
      isLoggedIn() {
        return true;
      },
      init() {
        return Promise.resolve();
      },
      login() {},
      logout() {},
      getProfile() {
        return Promise.resolve({
          userId: 'U123',
          displayName: '測試顧客',
          pictureUrl: 'https://example.com/avatar.png',
        });
      },
      getIDToken() {
        return 'sensitive-id-token';
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'liff-auth.js'), 'utf8');
  vm.runInContext(source, context);

  return { context, storageWrites, storageRemovals };
}

test('LiffAuth keeps profile and token out of localStorage', async () => {
  const { context, storageWrites } = createContext();

  await context.LiffAuth.init('test-liff-id');
  const token = context.LiffAuth.getIdToken();

  assert.equal(token, 'sensitive-id-token');
  assert.deepEqual(storageWrites, []);
});

test('LiffAuth attaches identity without idToken', async () => {
  const { context } = createContext();

  await context.LiffAuth.init('test-liff-id');
  const payload = context.LiffAuth.attachLiffInfo({ orderId: 'order-1' });

  assert.deepEqual(payload, {
    orderId: 'order-1',
    liffUserId: 'U123',
    displayName: '測試顧客',
  });
});

test('LiffAuth logout removes legacy cached keys', async () => {
  const { context, storageRemovals } = createContext();

  await context.LiffAuth.init('test-liff-id');
  context.LiffAuth.logout();

  assert.deepEqual(storageRemovals, ['liff_profile', 'liff_token']);
});
