const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createMenu({ storage } = {}) {
  const context = {};
  if (storage) {
    context.localStorage = storage;
  }
  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'menu.js'), 'utf8');
  vm.runInContext(source, context);
  return context.Menu;
}

test('Menu initializes current category from first category', () => {
  const Menu = createMenu();

  Menu.init({ categories: ['麵食', '飯食'], items: [] });

  assert.equal(Menu.getCurrentCategory(), '麵食');
});

test('Menu initializes current category as null when categories are empty', () => {
  const Menu = createMenu();

  Menu.init({ categories: [], items: [] });

  assert.equal(Menu.getCurrentCategory(), null);
});

test('Menu returns available items for selected category sorted by sortOrder', () => {
  const Menu = createMenu();
  const items = Menu.getItemsByCategory(
    {
      items: [
        { name: '紅燒麵', category: '麵食', sortOrder: 20, price: 120 },
        { name: '乾拌麵', category: '麵食', sortOrder: 10, price: 100 },
        { name: '炒飯', category: '飯食', sortOrder: 10, price: 100 },
      ],
    },
    '麵食',
  );

  assert.deepEqual(
    items.map((item) => item.name),
    ['乾拌麵', '紅燒麵'],
  );
});

test('Menu returns all items regardless of inventory status', () => {
  const Menu = createMenu();
  const items = Menu.getItemsByCategory(
    {
      items: [
        { name: '可售餐點', category: '麵食', price: 100 },
        { name: '完售餐點', category: '麵食', soldOut: true, price: 100 },
        { name: '無庫存餐點', category: '麵食', inStock: false, price: 100 },
      ],
    },
    '麵食',
  );

  assert.deepEqual(
    items.map((item) => item.name),
    ['可售餐點', '完售餐點', '無庫存餐點'],
  );
});

test('Menu keeps cart items with different customizations separate', () => {
  const Menu = createMenu();

  Menu.addToCart({ name: '紅燒麵', price: 120 }, [{ optionName: '辣度', selectedValue: '不辣' }]);
  Menu.addToCart({ name: '紅燒麵', price: 120 }, [{ optionName: '辣度', selectedValue: '小辣' }]);

  const items = Menu.getCartItems();

  assert.equal(items.length, 2);
  assert.equal(Menu.getCartCount(), 2);
  assert.equal(Menu.getCartTotal(), 240);
});

test('Menu combines cart items with same customizations and supports quantity changes', () => {
  const Menu = createMenu();

  Menu.addToCart({ name: '紅燒麵', price: 120 }, [{ optionName: '辣度', selectedValue: '不辣' }]);
  Menu.addToCart({ name: '紅燒麵', price: 120 }, [{ optionName: '辣度', selectedValue: '不辣' }]);

  let item = Menu.getCartItems()[0];
  assert.equal(item.quantity, 2);
  assert.equal(Menu.getCartTotal(), 240);

  Menu.removeFromCart(item.key);
  item = Menu.getCartItems()[0];

  assert.equal(item.quantity, 1);
  assert.equal(Menu.getCartTotal(), 120);
});

test('Menu removes cart item and clears cart', () => {
  const Menu = createMenu();

  Menu.addToCart({ name: '紅燒麵', price: 120 }, []);
  const item = Menu.getCartItems()[0];

  Menu.removeCartItem(item.key);
  assert.equal(Menu.getCartCount(), 0);

  Menu.addToCart({ name: '乾拌麵', price: 100 }, []);
  Menu.clearCart();

  assert.deepEqual(JSON.parse(JSON.stringify(Menu.getCartItems())), []);
});

test('Menu persists and restores cart items from localStorage', () => {
  const store = {};
  const storage = {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = value;
    },
  };
  const FirstMenu = createMenu({ storage });

  FirstMenu.init({ categories: ['麵食'], items: [] });
  FirstMenu.addToCart({ name: '紅燒麵', price: 120 }, []);

  const SecondMenu = createMenu({ storage });
  SecondMenu.init({ categories: ['麵食'], items: [] });

  assert.equal(SecondMenu.getCartCount(), 1);
  assert.equal(SecondMenu.getCartItems()[0].item.name, '紅燒麵');
});
