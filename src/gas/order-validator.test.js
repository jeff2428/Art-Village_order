const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createValidatorContext({ businessHours, holidays, nowDate = '2026-05-18', nowTime = '10:00' } = {}) {
  const context = {
    Logger: { log() {} },
    getSpreadsheetId() {
      return 'SHEET_ID';
    },
    getBusinessHours() {
      return businessHours || {
        0: { enabled: true, slots: ['11:00-21:00'] },
        1: { enabled: true, slots: ['11:00-21:00'] },
        2: { enabled: true, slots: ['11:00-21:00'] },
        3: { enabled: true, slots: ['11:00-21:00'] },
        4: { enabled: true, slots: ['11:00-21:00'] },
        5: { enabled: true, slots: ['11:00-21:00'] },
        6: { enabled: true, slots: ['11:00-21:00'] },
      };
    },
    getHolidays() {
      return holidays || [];
    },
    Utilities: {
      formatDate(_date, _timezone, format) {
        if (format === 'yyyy-MM-dd') return nowDate;
        if (format === 'HH:mm') return nowTime;
        return nowDate + ' ' + nowTime;
      },
    },
    Date,
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'order-validator.js'), 'utf8');
  vm.runInContext(source, context);

  return context;
}

function validOrder(overrides = {}) {
  return Object.assign({
    liffUserId: 'U123',
    customerName: '王小明',
    phone: '0912345678',
    guestCount: 2,
    diningDate: '2026-05-19',
    diningTime: '11:30',
    items: [{ name: '紅燒麵', quantity: 1, price: 120 }],
  }, overrides);
}

test('validateOrder requires LINE user id', () => {
  const context = createValidatorContext();

  const result = context.validateOrder(validOrder({ liffUserId: '' }));

  assert.equal(result.valid, false);
  assert.match(result.message, /liffUserId/);
});

test('validateOrder accepts large guest counts without capacity limit', () => {
  const context = createValidatorContext();

  const result = context.validateOrder(validOrder({ guestCount: 99 }));

  assert.equal(result.valid, true);
});

test('validateOrder rejects holidays', () => {
  const context = createValidatorContext({
    holidays: [{ date: '2026-05-19', reason: '公休' }],
  });

  const result = context.validateOrder(validOrder());

  assert.equal(result.valid, false);
  assert.match(result.message, /休假日/);
});

test('validateOrder rejects same-day orders after cutoff time', () => {
  const context = createValidatorContext({ nowDate: '2026-05-18', nowTime: '20:01' });

  const result = context.validateOrder(validOrder({ diningDate: '2026-05-18' }));

  assert.equal(result.valid, false);
  assert.match(result.message, /截止時間/);
});

test('validateOrder uses the selected business slot cutoff for same-day orders', () => {
  const context = createValidatorContext({
    nowDate: '2026-05-19',
    nowTime: '15:00',
    businessHours: {
      2: { enabled: true, slots: ['11:00-14:00', '17:00-21:00'] },
    },
  });

  const result = context.validateOrder(validOrder({
    diningDate: '2026-05-19',
    diningTime: '13:00',
  }));

  assert.equal(result.valid, false);
  assert.match(result.message, /截止時間/);
  assert.match(result.message, /13:00/);
});

test('validateOrder rejects invalid dining dates and times', () => {
  const context = createValidatorContext();

  assert.equal(context.validateOrder(validOrder({ diningDate: '2026-99-99' })).valid, false);
  assert.equal(context.validateOrder(validOrder({ diningTime: '25:00' })).valid, false);
});

test('validateOrder rejects orders outside weekly business slots', () => {
  const context = createValidatorContext({
    businessHours: {
      2: { enabled: true, slots: ['11:00-14:00', '17:00-21:00'] },
    },
  });

  const result = context.validateOrder(validOrder({
    diningDate: '2026-05-19',
    diningTime: '15:00',
  }));

  assert.equal(result.valid, false);
  assert.match(result.message, /營業時間/);
});

test('validateOrder rejects closed weekdays', () => {
  const context = createValidatorContext({
    businessHours: {
      2: { enabled: false, slots: [] },
    },
  });

  const result = context.validateOrder(validOrder({ diningDate: '2026-05-19' }));

  assert.equal(result.valid, false);
  assert.match(result.message, /未營業/);
});

test('validateOrder rejects invalid order items', () => {
  const context = createValidatorContext();

  const result = context.validateOrder(validOrder({
    items: [{ name: '紅燒麵', quantity: 0, price: 120 }],
  }));

  assert.equal(result.valid, false);
  assert.match(result.message, /餐點數量/);
});
