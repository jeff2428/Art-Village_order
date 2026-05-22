const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createProcessorContext({ validation = { valid: true }, writeResult, notifyResult } = {}) {
  const calls = [];
  const context = {
    Logger: { log() {} },
    getSpreadsheetId() {
      return 'SHEET_ID';
    },
    validateOrder(orderData) {
      calls.push(['validateOrder', orderData]);
      return validation;
    },
    writeOrder(spreadsheetId, orderData) {
      calls.push(['writeOrder', spreadsheetId, orderData]);
      return writeResult || { success: true, orderId: 'ORD-1', timestamp: '2026-05-18 10:30:00' };
    },
    sendOrderNotification(orderData, orderId, timestamp) {
      calls.push(['sendOrderNotification', orderData, orderId, timestamp]);
      if (notifyResult instanceof Error) throw notifyResult;
      return notifyResult || { success: true };
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'order-processor.js'), 'utf8');
  vm.runInContext(source, context);

  return { context, calls };
}

const orderData = {
  liffUserId: 'U123',
  customerName: ' 王小明 ',
  phone: '0912-345-678',
  guestCount: '2',
  diningDate: '2026-05-19',
  diningTime: '11:30',
  items: [
    {
      name: '紅燒麵',
      quantity: '2',
      price: '120',
      customizations: [{ optionName: '辣度', selectedValue: '小辣' }],
    },
  ],
};

test('processOrder formats order, calculates total, writes, and notifies', () => {
  const { context, calls } = createProcessorContext();

  const result = context.processOrder(orderData);

  assert.equal(result.success, true);
  assert.equal(result.orderId, 'ORD-1');
  const writeCall = calls.find((call) => call[0] === 'writeOrder');
  assert.equal(writeCall[2].customerName, '王小明');
  assert.equal(writeCall[2].phone, '0912345678');
  assert.equal(writeCall[2].totalAmount, 240);
  assert.equal(writeCall[2].items[0].lineTotal, 240);
});

test('processOrder returns success even when LINE notification fails after write', () => {
  const { context } = createProcessorContext({
    notifyResult: new Error('LINE unavailable'),
  });

  const result = context.processOrder(orderData);

  assert.equal(result.success, true);
  assert.equal(result.orderId, 'ORD-1');
});

test('buildOrderMessage includes customer, reservation, total, and customizations', () => {
  const { context } = createProcessorContext();
  const formatted = context.formatOrder(orderData);

  const message = context.buildOrderMessage(formatted, 'ORD-1', '2026-05-18 10:30:00');

  assert.match(message, /王小明/);
  assert.match(message, /0912345678/);
  assert.match(message, /2026-05-19 11:30/);
  assert.match(message, /辣度: 小辣/);
  assert.match(message, /總金額: \$240/);
});
