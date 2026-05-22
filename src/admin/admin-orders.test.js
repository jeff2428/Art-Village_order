const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createAdminOrders() {
  const context = {
    document: {
      getElementById() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'admin-orders.js'), 'utf8');
  vm.runInContext(source, context);

  return context.AdminOrders;
}

test('AdminOrders filters orders by status', () => {
  const AdminOrders = createAdminOrders();
  const orders = [
    { orderId: 'ORD-1', status: 'pending', customerName: '王小明', orderItems: [] },
    { orderId: 'ORD-2', status: 'confirmed', customerName: '陳小華', orderItems: [] },
  ];

  const filtered = AdminOrders.getFilteredOrders(orders, 'pending', '');

  assert.deepEqual(filtered.map((order) => order.orderId), ['ORD-1']);
});

test('AdminOrders searches order id, customer, phone, and item names', () => {
  const AdminOrders = createAdminOrders();
  const orders = [
    {
      orderId: 'ORD-1',
      status: 'pending',
      customerName: '王小明',
      phone: '0912345678',
      diningDate: '2026-05-19',
      diningTime: '11:30',
      orderItems: [{ name: '紅燒麵', quantity: 2 }],
    },
    {
      orderId: 'ORD-2',
      status: 'confirmed',
      customerName: '陳小華',
      phone: '0987654321',
      diningDate: '2026-05-20',
      diningTime: '12:00',
      orderItems: [{ name: '乾拌麵', quantity: 1 }],
    },
  ];

  assert.deepEqual(AdminOrders.getFilteredOrders(orders, 'all', '紅燒').map((order) => order.orderId), ['ORD-1']);
  assert.deepEqual(AdminOrders.getFilteredOrders(orders, 'all', '0987').map((order) => order.orderId), ['ORD-2']);
  assert.deepEqual(AdminOrders.getFilteredOrders(orders, 'all', '王小明').map((order) => order.orderId), ['ORD-1']);
});

test('AdminOrders returns page-sized slices', () => {
  const AdminOrders = createAdminOrders();
  const orders = [
    { orderId: 'ORD-1' },
    { orderId: 'ORD-2' },
    { orderId: 'ORD-3' },
    { orderId: 'ORD-4' },
  ];

  const page = AdminOrders.getPageItems(orders, 2, 2);

  assert.deepEqual(page.map((order) => order.orderId), ['ORD-3', 'ORD-4']);
});
