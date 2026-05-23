const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createSheet(rows = []) {
  return {
    rows,
    getDataRange() {
      return {
        getValues: () => rows,
      };
    },
    appendRow(row) {
      rows.push(row);
    },
    getRange(rowIndex, columnIndex, rowCount, columnCount) {
      return {
        setValues(values) {
          for (let i = 0; i < values.length; i += 1) {
            const targetRow = rowIndex - 1 + i;
            if (!rows[targetRow]) rows[targetRow] = [];
            for (let j = 0; j < values[i].length; j += 1) {
              rows[targetRow][columnIndex - 1 + j] = values[i][j];
            }
          }
        },
        setValue(value) {
          rows[rowIndex - 1][columnIndex - 1] = value;
        },
      };
    },
    getLastRow() {
      return rows.length;
    },
  };
}

function createOrderContext(initialSheets = {}) {
  const sheets = {};
  Object.keys(initialSheets).forEach((name) => {
    sheets[name] = createSheet(initialSheets[name]);
  });

  const context = {
    Logger: { log() {} },
    Utilities: {
      formatDate(_date, _timezone, format) {
        if (format === 'yyyyMMdd-HHmmss') return '20260518-103000';
        if (format === 'yyyy-MM-dd HH:mm:ss') return '2026-05-18 10:30:00';
        return '2026-05-18';
      },
    },
    Math: Object.create(Math),
    SpreadsheetApp: {
      openById() {
        return {
          getSheetByName(name) {
            return sheets[name] || null;
          },
          insertSheet(name) {
            sheets[name] = createSheet([]);
            return sheets[name];
          },
        };
      },
    },
  };
  context.Math.random = () => 0.1234;

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'sheet-order.js'), 'utf8');
  vm.runInContext(source, context);

  return { context, sheets };
}

test('writeOrder writes master order and item detail rows to normalized sheets', () => {
  const { context, sheets } = createOrderContext();

  const result = context.writeOrder('SHEET_ID', {
    customerName: '王小明',
    phone: '0912345678',
    guestCount: 2,
    diningDate: '2026-05-19',
    diningTime: '11:30',
    liffUserId: 'U123',
    totalAmount: 240,
    items: [
      {
        name: '紅燒麵',
        quantity: 2,
        price: 120,
        customizations: [{ optionName: '辣度', selectedValue: '小辣' }],
      },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(result.orderId, '20260518-103000-1234');
  assert.equal(sheets.Orders.rows.length, 2);
  assert.equal(sheets.OrderItems.rows.length, 2);
  assert.equal(sheets.Orders.rows[1][0], result.orderId);
  assert.equal(sheets.Orders.rows[1][8], 240);
  assert.equal(sheets.OrderItems.rows[1][0], result.orderId);
  assert.equal(sheets.OrderItems.rows[1][4], '辣度: 小辣');
});

test('writeOrder batch writes normalized order item rows', () => {
  const { context, sheets } = createOrderContext();

  const result = context.writeOrder('SHEET_ID', {
    customerName: '王小明',
    phone: '0912345678',
    guestCount: 2,
    diningDate: '2026-05-19',
    diningTime: '11:30',
    liffUserId: 'U123',
    items: [
      { name: '紅燒麵', quantity: 1, price: 120 },
      { name: '乾拌麵', quantity: 2, price: 90 },
    ],
  });

  assert.equal(result.success, true);
  assert.equal(sheets.Orders.rows.length, 2);
  assert.equal(sheets.OrderItems.rows.length, 3);
  assert.deepEqual(sheets.OrderItems.rows.slice(1).map((row) => row[1]), ['紅燒麵', '乾拌麵']);
});

test('readAllOrders reads normalized Orders and OrderItems sheets', () => {
  const { context } = createOrderContext({
    Orders: [
      ['orderId', 'timestamp', 'liffUserId', 'customerName', 'phone', 'guestCount', 'diningDate', 'diningTime', 'totalAmount', 'status'],
      ['ORD-1', '2026-05-18 10:30:00', 'U123', '王小明', '0912345678', 2, '2026-05-19', '11:30', 240, 'pending'],
    ],
    OrderItems: [
      ['orderId', 'itemName', 'quantity', 'unitPrice', 'customizationText', 'lineTotal'],
      ['ORD-1', '紅燒麵', 2, 120, '辣度: 小辣', 240],
    ],
  });

  const orders = context.readAllOrders('SHEET_ID');

  assert.equal(orders.length, 1);
  assert.equal(orders[0].orderItems[0].name, '紅燒麵');
  assert.equal(orders[0].totalAmount, 240);
});
