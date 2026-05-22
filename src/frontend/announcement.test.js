const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createElement() {
  return {
    textContent: '',
    classList: {
      values: new Set(['hidden']),
      add(value) {
        this.values.add(value);
      },
      remove(value) {
        this.values.delete(value);
      },
      contains(value) {
        return this.values.has(value);
      },
    },
    querySelector() {
      return this.child;
    },
    child: {
      textContent: '',
    },
  };
}

function createContext(announcements) {
  const elements = {
    headerAnnouncement: createElement(),
    popupAnnouncement: createElement(),
    popupContent: createElement(),
    checkoutAnnouncement: createElement(),
    checkoutAnnouncementContent: createElement(),
  };
  const context = {
    window: {},
    Api: {
      getAnnouncements() {
        return Promise.resolve(announcements);
      },
    },
    document: {
      getElementById(id) {
        return elements[id];
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'announcement.js'), 'utf8');
  vm.runInContext(source, context);

  return { context, elements };
}

test('Announcement shows header announcement when enabled with content', async () => {
  const { context, elements } = createContext({
    header: { enabled: true, content: '今日正常營業' },
    popup: { enabled: false, content: '' },
    checkout: { enabled: false, content: '' },
  });

  await context.Announcement.load();

  assert.equal(elements.headerAnnouncement.child.textContent, '今日正常營業');
  assert.equal(elements.headerAnnouncement.classList.contains('hidden'), false);
});

test('Announcement hides header announcement when disabled', async () => {
  const { context, elements } = createContext({
    header: { enabled: false, content: '不應顯示' },
    popup: { enabled: false, content: '' },
    checkout: { enabled: false, content: '' },
  });

  await context.Announcement.load();

  assert.equal(elements.headerAnnouncement.classList.contains('hidden'), true);
});

test('Announcement hides header announcement when content is empty', async () => {
  const { context, elements } = createContext({
    header: { enabled: true, content: '' },
    popup: { enabled: false, content: '' },
    checkout: { enabled: false, content: '' },
  });

  await context.Announcement.load();

  assert.equal(elements.headerAnnouncement.classList.contains('hidden'), true);
});

test('Announcement shows popup announcement when enabled with content', async () => {
  const { context, elements } = createContext({
    header: { enabled: false, content: '' },
    popup: { enabled: true, content: '今日候位時間較長' },
    checkout: { enabled: false, content: '' },
  });

  await context.Announcement.load();

  assert.equal(elements.popupContent.textContent, '今日候位時間較長');
  assert.equal(elements.popupAnnouncement.classList.contains('hidden'), false);
});

test('Announcement closes popup announcement', async () => {
  const { context, elements } = createContext({
    header: { enabled: false, content: '' },
    popup: { enabled: true, content: '今日候位時間較長' },
    checkout: { enabled: false, content: '' },
  });

  await context.Announcement.load();
  context.Announcement.closePopup();

  assert.equal(elements.popupAnnouncement.classList.contains('hidden'), true);
});

test('Announcement hides popup announcement when disabled', async () => {
  const { context, elements } = createContext({
    header: { enabled: false, content: '' },
    popup: { enabled: false, content: '不應顯示' },
    checkout: { enabled: false, content: '' },
  });

  await context.Announcement.load();

  assert.equal(elements.popupAnnouncement.classList.contains('hidden'), true);
});

test('Announcement shows checkout reminder and waits for confirmation', async () => {
  const { context, elements } = createContext({
    header: { enabled: false, content: '' },
    popup: { enabled: false, content: '' },
    checkout: { enabled: true, content: '送出後請來電修改或取消' },
  });
  let confirmed = false;

  await context.Announcement.load();
  context.Announcement.showCheckoutAnnouncement(() => {
    confirmed = true;
  });

  assert.equal(elements.checkoutAnnouncementContent.textContent, '送出後請來電修改或取消');
  assert.equal(elements.checkoutAnnouncement.classList.contains('hidden'), false);
  assert.equal(confirmed, false);

  context.Announcement.confirmCheckout();

  assert.equal(elements.checkoutAnnouncement.classList.contains('hidden'), true);
  assert.equal(confirmed, true);
});

test('Announcement immediately continues checkout when reminder is disabled', async () => {
  const { context, elements } = createContext({
    header: { enabled: false, content: '' },
    popup: { enabled: false, content: '' },
    checkout: { enabled: false, content: '不應顯示' },
  });
  let confirmed = false;

  await context.Announcement.load();
  context.Announcement.showCheckoutAnnouncement(() => {
    confirmed = true;
  });

  assert.equal(elements.checkoutAnnouncement.classList.contains('hidden'), true);
  assert.equal(confirmed, true);
});
