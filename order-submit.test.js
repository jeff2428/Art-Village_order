const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createClassList() {
  return {
    values: new Set(),
    add(value) {
      this.values.add(value);
    },
    remove(value) {
      this.values.delete(value);
    },
    contains(value) {
      return this.values.has(value);
    },
  };
}

function createContext({ reservation, cart, liffUserId = 'U123', submitOrder }) {
  const alerts = [];
  function createElement(tagName) {
    return {
      tagName,
      textContent: '',
      children: [],
      appendChild(child) {
        this.children.push(child);
      },
    };
  }
  function createContainer() {
    const element = createElement('div');
    Object.defineProperty(element, 'textContent', {
      get() {
        return this.children.map((child) => child.textContent).join('');
      },
      set(value) {
        this.children.length = 0;
        this._textContent = value;
      },
    });
    return element;
  }
  const elements = {
    mainScreen: { classList: createClassList() },
    successScreen: { classList: createClassList() },
    orderIdDisplay: { textContent: '' },
    orderSummaryDisplay: createContainer(),
    checkoutBtn: { disabled: false, textContent: '前往結帳' },
  };

  const context = {
    alert(message) {
      alerts.push(message);
    },
    updateCartBar() {},
    document: {
      getElementById(id) {
        return elements[id];
      },
      createElement,
    },
    Reservation: {
      getData() {
        return reservation;
      },
      reset() {},
    },
    Menu: {
      getCart() {
        return cart || {};
      },
      clearCart() {},
    },
    LiffAuth: {
      getUserId() {
        return liffUserId;
      },
    },
    Api: {
      submitOrder: submitOrder || ((payload) => Promise.resolve({ orderId: 'ORD-1', payload })),
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'order-submit.js'), 'utf8');
  vm.runInContext(source, context);

  return { context, elements, alerts };
}

test('OrderSubmit prepares order payload with reservation, cart, and LIFF user id', () => {
  const { context } = createContext({
    reservation: {
      customerName: '王小明',
      phone: '0912345678',
      guestCount: 2,
      diningDate: '2026-05-18',
      diningTime: '11:30',
    },
    cart: {
      '紅燒麵::辣度:小辣': {
        item: { name: '紅燒麵', price: 120 },
        quantity: 1,
        customizations: [{ optionName: '辣度', selectedValue: '小辣' }],
      },
    },
  });

  const payload = context.OrderSubmit.prepareOrderData();

  assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
    customerName: '王小明',
    phone: '0912345678',
    guestCount: 2,
    diningDate: '2026-05-18',
    diningTime: '11:30',
    items: [
      {
        name: '紅燒麵',
        quantity: 1,
        price: 120,
        customizations: [{ optionName: '辣度', selectedValue: '小辣' }],
      },
    ],
    liffUserId: 'U123',
  });
});

test('OrderSubmit submits order and shows success screen', async () => {
  let submittedPayload = null;
  const { context, elements } = createContext({
    reservation: {
      customerName: '王小明',
      phone: '0912345678',
      guestCount: 2,
      diningDate: '2026-05-18',
      diningTime: '11:30',
    },
    cart: {
      '紅燒麵::': {
        item: { name: '紅燒麵', price: 120 },
        quantity: 1,
        customizations: [],
      },
    },
    submitOrder(payload) {
      submittedPayload = payload;
      return Promise.resolve({ orderId: 'ORD-20260518' });
    },
  });

  await context.OrderSubmit.submit();

  assert.equal(submittedPayload.customerName, '王小明');
  assert.equal(elements.orderIdDisplay.textContent, 'ORD-20260518');
  assert.match(elements.orderSummaryDisplay.textContent, /訂位人：王小明/);
  assert.match(elements.orderSummaryDisplay.textContent, /用餐時間：2026-05-18 11:30/);
  assert.equal(elements.checkoutBtn.disabled, false);
  assert.equal(elements.checkoutBtn.textContent, '前往結帳');
});

test('OrderSubmit renders reservation data as text in success summary', () => {
  const { context, elements } = createContext({
    reservation: {
      customerName: '<img src=x onerror=alert(1)>',
      phone: '0912345678',
      guestCount: 2,
      diningDate: '2026-05-18',
      diningTime: '11:30',
    },
    cart: {},
  });

  context.OrderSubmit.showSuccess('ORD-1');

  assert.equal(elements.orderSummaryDisplay.children[0].textContent, '訂位人：<img src=x onerror=alert(1)>');
  assert.equal(elements.orderSummaryDisplay.children[0].children.length, 0);
});

test('OrderSubmit reports validation errors with readable message', async () => {
  const { context, alerts } = createContext({
    reservation: null,
    cart: {},
  });

  await assert.rejects(() => context.OrderSubmit.submit(), /請先填寫預約資訊/);

  assert.equal(alerts[0], '訂單送出失敗: 請先填寫預約資訊');
});

test('OrderSubmit rejects duplicate submissions while a request is in flight', async () => {
  let resolveSubmit;
  const { context } = createContext({
    reservation: {
      customerName: '王小明',
      phone: '0912345678',
      guestCount: 2,
      diningDate: '2026-05-18',
      diningTime: '11:30',
    },
    cart: {
      '紅燒麵::': {
        item: { name: '紅燒麵', price: 120 },
        quantity: 1,
        customizations: [],
      },
    },
    submitOrder() {
      return new Promise((resolve) => {
        resolveSubmit = resolve;
      });
    },
  });

  const firstSubmit = context.OrderSubmit.submit();
  await assert.rejects(() => context.OrderSubmit.submit(), /請勿重複點擊/);
  resolveSubmit({ orderId: 'ORD-1' });
  await firstSubmit;
});
