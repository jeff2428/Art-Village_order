const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createSheet(rows) {
  return {
    rows,
    getDataRange() {
      return {
        getValues() {
          return rows;
        },
      };
    },
    clear() {
      rows.length = 0;
    },
    appendRow(row) {
      rows.push(row);
    },
    getLastRow() {
      return rows.length;
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
      };
    },
  };
}

function createMenuContext(sheetRows) {
  const context = {
    Logger: { log() {} },
    clearMenuCache() {},
    SpreadsheetApp: {
      openById() {
        return {
          getSheetByName(name) {
            return sheetRows[name] ? createSheet(sheetRows[name]) : null;
          },
          insertSheet(name) {
            sheetRows[name] = [];
            return createSheet(sheetRows[name]);
          },
        };
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'sheet-menu.js'), 'utf8');
  vm.runInContext(source, context);

  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const menuSheets = {
  Categories: [
    ['categoryId', 'name', 'sortOrder', 'enabled'],
    ['cat-noodle', '麵食', 20, true],
    ['cat-rice', '飯食', 10, true],
    ['cat-hidden', '隱藏分類', 30, false],
  ],
  Products: [
    ['productId', 'categoryId', 'name', 'description', 'price', 'soldOut', 'sortOrder', 'enabled', 'imageUrl'],
    ['p-noodle', 'cat-noodle', '紅燒麵', '湯麵', 120, false, 20, true, 'https://example.com/noodle.jpg'],
    ['p-dry', 'cat-noodle', '乾拌麵', '乾麵', 100, false, 10, true, ''],
    ['p-rice', 'cat-rice', '炒飯', '香炒', 100, true, 10, true, ''],
    ['p-hidden-product', 'cat-noodle', '停用餐點', '', 80, false, 30, false, ''],
    ['p-hidden-category', 'cat-hidden', '隱藏分類餐點', '', 90, false, 10, true, ''],
  ],
  OptionGroups: [
    ['groupId', 'name', 'type', 'required', 'sortOrder', 'enabled'],
    ['g-noodle', '麵條', 'single', true, 10, true],
    ['g-spicy', '辣度', 'single', false, 20, true],
    ['g-hidden', '隱藏選項', 'single', false, 30, false],
  ],
  OptionItems: [
    ['optionItemId', 'groupId', 'name', 'sortOrder', 'enabled'],
    ['i-ramen', 'g-noodle', '拉麵', 20, true],
    ['i-thin', 'g-noodle', '細麵', 10, true],
    ['i-mild', 'g-spicy', '小辣', 10, true],
    ['i-hot', 'g-spicy', '大辣', 20, true],
    ['i-hidden', 'g-spicy', '不顯示', 30, false],
  ],
  ProductOptions: [
    ['productId', 'groupId', 'sortOrder', 'enabled'],
    ['p-noodle', 'g-spicy', 20, true],
    ['p-noodle', 'g-noodle', 10, true],
    ['p-dry', 'g-noodle', 10, true],
    ['p-dry', 'g-hidden', 20, true],
  ],
};

test('getFullMenu reads normalized sheets into frontend-ready menu JSON', () => {
  const context = createMenuContext(menuSheets);

  const result = context.getFullMenu('SHEET_ID');

  assert.deepEqual(plain(result.categories), ['飯食', '麵食']);
  assert.deepEqual(
    plain(result.items.map((item) => item.name)),
    ['乾拌麵', '紅燒麵'],
  );
  assert.deepEqual(plain(result.items[1]), {
    id: 'p-noodle',
    category: '麵食',
    categoryId: 'cat-noodle',
    name: '紅燒麵',
    description: '湯麵',
    price: 120,
    sortOrder: 20,
    soldOut: false,
    inStock: true,
    imageUrl: 'https://example.com/noodle.jpg',
    customizationOptions: [
      { name: '麵條', type: 'single', required: true, choices: ['細麵', '拉麵'] },
      { name: '辣度', type: 'single', required: false, choices: ['小辣', '大辣'] },
    ],
  });
});

test('getFullMenu deduplicates repeated option item names', () => {
  const duplicateSheets = JSON.parse(JSON.stringify(menuSheets));
  duplicateSheets.OptionItems.splice(
    4,
    0,
    ['i-mild-dup', 'g-spicy', '小辣', 15, true],
    ['i-hot-dup', 'g-spicy', ' 大辣 ', 25, true],
  );
  const context = createMenuContext(duplicateSheets);

  const result = context.getFullMenu('SHEET_ID');
  const spicy = result.items.find((item) => item.name === '紅燒麵').customizationOptions.find((option) => option.name === '辣度');

  assert.deepEqual(plain(spicy.choices), ['小辣', '大辣']);
});

test('readMenuItems filters disabled categories, disabled products, and sold out products', () => {
  const context = createMenuContext(menuSheets);

  const items = context.readMenuItems('SHEET_ID');

  assert.deepEqual(
    plain(items.map((item) => item.name)),
    ['乾拌麵', '紅燒麵'],
  );
});

test('getFullMenu falls back to legacy single menu sheet when normalized sheets are absent', () => {
  const context = createMenuContext({
    '菜單': [
      ['分類', '品名', '價格', '描述', '客製化選項', '庫存狀態', '啟用狀態'],
      ['麵食', '紅燒麵', 120, '湯麵', '[{"name":"辣度","choices":["小辣"]}]', true, true],
    ],
  });

  const result = context.getFullMenu('SHEET_ID');

  assert.deepEqual(plain(result.categories), ['麵食']);
  assert.equal(result.items[0].name, '紅燒麵');
  assert.deepEqual(plain(result.items[0].customizationOptions), [{ name: '辣度', choices: ['小辣'] }]);
});

test('legacy customization JSON choices are deduplicated', () => {
  const context = createMenuContext({
    '菜單': [
      ['分類', '品名', '價格', '描述', '客製化選項', '庫存狀態', '啟用狀態'],
      ['麵食', '紅燒麵', 120, '湯麵', '[{"name":"辣度","choices":["不辣","不辣"," 小辣 ","小辣"]}]', true, true],
    ],
  });

  const result = context.getFullMenu('SHEET_ID');

  assert.deepEqual(plain(result.items[0].customizationOptions[0].choices), ['不辣', '小辣']);
});

test('getFullMenuState reads normalized sheets for admin menu management', () => {
  const context = createMenuContext(menuSheets);

  const state = context.getFullMenuState('SHEET_ID');

  assert.deepEqual(
    plain(state.categories.map((category) => category.name)),
    ['飯食', '麵食', '隱藏分類'],
  );
  assert.deepEqual(
    plain(state.options.map((option) => option.name)),
    ['麵條', '辣度', '隱藏選項'],
  );
  assert.equal(state.items.length, 5);
  assert.equal(state.items.find((item) => item.name === '炒飯').soldOut, true);
  assert.equal(state.items.find((item) => item.name === '紅燒麵').imageUrl, 'https://example.com/noodle.jpg');
});

test('updateFullMenuState writes normalized menu sheets', () => {
  const sheetRows = JSON.parse(JSON.stringify(menuSheets));
  const context = createMenuContext(sheetRows);

  const result = context.updateFullMenuState('SHEET_ID', {
    categories: [
      { id: 'cat-side', name: '小菜', sortOrder: 10, enabled: true },
    ],
    options: [
      { id: 'g-addon', name: '加料', type: 'multiple', required: false, choices: ['豆皮', '青菜'] },
    ],
    items: [
      {
        id: 'p-tofu',
        category: '小菜',
        name: '滷豆腐',
        description: '手工豆腐',
        price: 60,
        imageUrl: 'https://example.com/tofu.jpg',
        inStock: true,
        enabled: true,
        customizationOptions: [{ id: 'g-addon', name: '加料' }],
      },
    ],
  });

  assert.equal(result.success, true);
  assert.deepEqual(plain(sheetRows.Categories), [
    ['categoryId', 'name', 'sortOrder', 'enabled'],
    ['cat-side', '小菜', 10, true],
  ]);
  assert.deepEqual(plain(sheetRows.Products), [
    ['productId', 'categoryId', 'name', 'description', 'price', 'soldOut', 'sortOrder', 'enabled', 'imageUrl'],
    ['p-tofu', 'cat-side', '滷豆腐', '手工豆腐', 60, false, 10, true, 'https://example.com/tofu.jpg'],
  ]);
  assert.deepEqual(plain(sheetRows.OptionItems), [
    ['optionItemId', 'groupId', 'name', 'sortOrder', 'enabled'],
    ['choice-g-addon-豆皮-1', 'g-addon', '豆皮', 10, true],
    ['choice-g-addon-青菜-2', 'g-addon', '青菜', 20, true],
  ]);
  assert.deepEqual(plain(sheetRows.ProductOptions), [
    ['productId', 'groupId', 'sortOrder', 'enabled'],
    ['p-tofu', 'g-addon', 10, true],
  ]);
});
