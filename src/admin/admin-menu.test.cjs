const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createAdminMenu() {
  const context = {
    console,
    confirm() {
      return true;
    },
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
  const source = fs.readFileSync(path.join(__dirname, 'admin-menu.js'), 'utf8');
  vm.runInContext(source, context);

  return context.AdminMenu;
}

function createAdminMenuWithDom() {
  const elements = {};

  function createElement(id) {
    return {
      id,
      value: '',
      checked: false,
    disabled: false,
      textContent: '',
      className: '',
      focused: false,
      selected: false,
      onclick: null,
      oninput: null,
      focus() {
        this.focused = true;
      },
      select() {
        this.selected = true;
      },
      getAttribute(name) {
        return this[name] || '';
      },
    };
  }

  const host = createElement('menuDialogHost');
  Object.defineProperty(host, 'innerHTML', {
    get() {
      return this._innerHTML || '';
    },
    set(value) {
      this._innerHTML = value;
      const idPattern = /id="([^"]+)"/g;
      let match;
      while ((match = idPattern.exec(value))) {
        if (!elements[match[1]]) elements[match[1]] = createElement(match[1]);
      }
      if (elements.menuDialogSubmit) {
        const submitText = value.match(/id="menuDialogSubmit"[^>]*>([^<]+)/);
        elements.menuDialogSubmit.textContent = submitText ? submitText[1] : '';
      }
      if (elements.menuFormNameCount) {
        const countText = value.match(/id="menuFormNameCount">([^<]+)/);
        elements.menuFormNameCount.textContent = countText ? countText[1] : '';
      }
      const nameValue = value.match(/id="menuFormName"[^>]*value="([^"]*)"/);
      if (elements.menuFormName && nameValue) elements.menuFormName.value = nameValue[1];
      const choicesValue = value.match(/id="menuFormChoices"[^>]*>([\s\S]*?)<\/textarea>/);
      if (elements.menuFormChoices && choicesValue) elements.menuFormChoices.value = choicesValue[1];
    },
  });
  elements.menuDialogHost = host;

  const context = {
    console,
    confirm() {
      return true;
    },
    setTimeout(callback) {
      callback();
    },
    document: {
      onkeydown: null,
      getElementById(id) {
        return elements[id] || null;
      },
      querySelector() {
        return elements.menuFormName || null;
      },
      querySelectorAll() {
        return [];
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'admin-menu.js'), 'utf8');
  vm.runInContext(source, context);

  return { AdminMenu: context.AdminMenu, context, elements };
}

function sampleState() {
  return {
    categories: [
      { id: 'cat-hotpot', name: '火鍋', sortOrder: 10, enabled: true },
      { id: 'cat-rice', name: '飯', sortOrder: 20, enabled: true },
    ],
    options: [
      { id: 'g-spicy', name: '辣度', type: 'single', required: false, sortOrder: 10, enabled: true, choices: ['不辣', '小辣'] },
    ],
    items: [
      {
        id: 'p-tomato',
        categoryId: 'cat-hotpot',
        category: '火鍋',
        name: '義式番茄鍋',
        description: '番茄湯底',
        price: 249,
        soldOut: false,
        inStock: true,
        sortOrder: 10,
        enabled: true,
        imageUrl: '',
        customizationOptions: [{ id: 'g-spicy', name: '辣度' }],
      },
      {
        id: 'p-rice',
        categoryId: 'cat-rice',
        category: '飯',
        name: '香菇炒飯',
        description: '鍋氣香',
        price: 130,
        soldOut: true,
        inStock: false,
        sortOrder: 20,
        enabled: true,
        imageUrl: '',
        customizationOptions: [],
      },
      {
        id: 'p-disabled',
        categoryId: 'cat-hotpot',
        category: '火鍋',
        name: '停用鍋',
        description: '',
        price: 199,
        soldOut: false,
        inStock: true,
        sortOrder: 30,
        enabled: false,
        imageUrl: '',
        customizationOptions: [],
      },
    ],
  };
}

test('AdminMenu filters products by search, category, and status', () => {
  const AdminMenu = createAdminMenu();
  const state = AdminMenu._test.normalizeMenuState(sampleState());

  assert.deepEqual(
    AdminMenu._test.filterProducts(state.items, state.categories, { search: '番茄', categoryId: 'all', status: 'all' }).map((item) => item.id),
    ['p-tomato'],
  );
  assert.deepEqual(
    AdminMenu._test.filterProducts(state.items, state.categories, { search: '', categoryId: 'cat-rice', status: 'all' }).map((item) => item.id),
    ['p-rice'],
  );
  assert.deepEqual(
    AdminMenu._test.filterProducts(state.items, state.categories, { search: '', categoryId: 'all', status: 'soldOut' }).map((item) => item.id),
    ['p-rice'],
  );
  assert.deepEqual(
    AdminMenu._test.filterProducts(state.items, state.categories, { search: '', categoryId: 'all', status: 'disabled' }).map((item) => item.id),
    ['p-disabled'],
  );
});

test('AdminMenu validates product form input', () => {
  const AdminMenu = createAdminMenu();
  const state = AdminMenu._test.normalizeMenuState(sampleState());

  const invalid = AdminMenu._test.validateProductInput({ name: '', categoryId: '', price: -1 }, state, '');
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(','), /請輸入餐點名稱/);
  assert.match(invalid.errors.join(','), /請選擇分類/);
  assert.match(invalid.errors.join(','), /價格需為非負數/);

  const duplicate = AdminMenu._test.validateProductInput({ name: '義式番茄鍋', categoryId: 'cat-hotpot', price: 249 }, state, '');
  assert.equal(duplicate.valid, false);
  assert.match(duplicate.errors.join(','), /餐點名稱不可重複/);
});

test('AdminMenu normalizes duplicate customization choices', () => {
  const AdminMenu = createAdminMenu();
  const state = AdminMenu._test.normalizeMenuState({
    categories: [],
    options: [
      { id: 'g-spicy', name: '辣度', type: 'single', choices: ['不辣', '不辣', ' 小辣 ', '小辣', ''] },
    ],
    items: [
      {
        id: 'p-noodle',
        name: '紅燒麵',
        customizationOptions: [{ id: 'g-spicy', name: '辣度' }],
      },
    ],
  });

  assert.deepEqual(JSON.parse(JSON.stringify(state.options[0].choices)), ['不辣', '小辣']);
  assert.deepEqual(JSON.parse(JSON.stringify(state.items[0].customizationOptions[0].choices)), ['不辣', '小辣']);
});

test('AdminMenu import preview deduplicates option item names', () => {
  const AdminMenu = createAdminMenu();
  const preview = AdminMenu._test.previewImportRows({
    categories: [{ categoryId: 'cat-noodle', name: '麵', sortOrder: 10, enabled: true }],
    products: [{ productId: 'p-noodle', categoryId: 'cat-noodle', name: '紅燒麵', description: '', price: 120, soldOut: false, sortOrder: 10, enabled: true, imageUrl: '' }],
    optionGroups: [{ groupId: 'g-spicy', name: '辣度', type: 'single', required: false, sortOrder: 10, enabled: true }],
    optionItems: [
      { optionItemId: 'i-none-1', groupId: 'g-spicy', name: '不辣', sortOrder: 10, enabled: true },
      { optionItemId: 'i-none-2', groupId: 'g-spicy', name: '不辣', sortOrder: 20, enabled: true },
      { optionItemId: 'i-mild', groupId: 'g-spicy', name: ' 小辣 ', sortOrder: 30, enabled: true },
      { optionItemId: 'i-mild-2', groupId: 'g-spicy', name: '小辣', sortOrder: 40, enabled: true },
    ],
    productOptions: [{ productId: 'p-noodle', groupId: 'g-spicy', sortOrder: 10, enabled: true }],
  }, sampleState());

  assert.equal(preview.errors.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.options[0].choices)), ['不辣', '小辣']);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.items[0].customizationOptions[0].choices)), ['不辣', '小辣']);
});

test('AdminMenu previews and applies full Excel import rows', () => {
  const AdminMenu = createAdminMenu();
  const preview = AdminMenu._test.previewImportRows({
    categories: [{ categoryId: 'cat-noodle', name: '麵', sortOrder: 10, enabled: true }],
    products: [{ productId: 'p-noodle', categoryId: 'cat-noodle', name: '紅燒麵', description: '湯麵', price: 120, soldOut: false, sortOrder: 10, enabled: true, imageUrl: '' }],
    optionGroups: [{ groupId: 'g-spicy', name: '辣度', type: 'single', required: false, sortOrder: 10, enabled: true }],
    optionItems: [
      { optionItemId: 'i-none', groupId: 'g-spicy', name: '不辣', sortOrder: 10, enabled: true },
      { optionItemId: 'i-hot', groupId: 'g-spicy', name: '小辣', sortOrder: 20, enabled: true },
    ],
    productOptions: [{ productId: 'p-noodle', groupId: 'g-spicy', sortOrder: 10, enabled: true }],
  }, sampleState());

  assert.equal(preview.errors.length, 0);
  assert.equal(preview.summary.categories, 1);
  assert.equal(preview.summary.items, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(preview.items[0].customizationOptions[0].choices)), ['不辣', '小辣']);

  const applied = AdminMenu._test.applyImportPreview(sampleState(), preview);
  assert.deepEqual(JSON.parse(JSON.stringify(applied.categories.map((category) => category.name))), ['麵']);
  assert.deepEqual(JSON.parse(JSON.stringify(applied.items.map((item) => item.name))), ['紅燒麵']);
});

test('AdminMenu import validation rejects missing references and negative prices', () => {
  const AdminMenu = createAdminMenu();
  const preview = AdminMenu._test.previewImportRows({
    categories: [{ categoryId: 'cat-noodle', name: '麵', sortOrder: 10, enabled: true }],
    products: [{ productId: 'p-noodle', categoryId: 'cat-missing', name: '紅燒麵', description: '', price: -1, soldOut: false, sortOrder: 10, enabled: true, imageUrl: '' }],
    optionGroups: [{ groupId: 'g-spicy', name: '辣度', type: 'single', required: false, sortOrder: 10, enabled: true }],
    optionItems: [
      { optionItemId: 'i-hot', groupId: 'g-missing', name: '小辣', sortOrder: 10, enabled: true },
      { optionItemId: 'i-hot', groupId: 'g-spicy', name: '大辣', sortOrder: 20, enabled: true },
    ],
    productOptions: [{ productId: 'p-missing', groupId: 'g-spicy', sortOrder: 10, enabled: true }],
  }, sampleState());

  const errorText = preview.errors.join('\n');
  assert.match(errorText, /categoryId/);
  assert.match(errorText, /價格需為非負數/);
  assert.match(errorText, /groupId/);
  assert.match(errorText, /optionItemId 重複/);
  assert.match(errorText, /productId/);
});

test('AdminMenu template schema does not include online ordering fields', () => {
  const AdminMenu = createAdminMenu();
  const sheets = AdminMenu._test.buildTemplateSheets();
  const serialized = JSON.stringify(sheets);

  assert.doesNotMatch(serialized, /線上點餐/);
  assert.doesNotMatch(serialized, /online/i);
});

test('AdminMenu source no longer uses browser prompt', () => {
  const source = fs.readFileSync(path.join(__dirname, 'admin-menu.js'), 'utf8');

  assert.doesNotMatch(source, /prompt\s*\(/);
  assert.doesNotMatch(source, /請輸入新分類名稱/);
});

test('Admin index defaults to menu and removes inventory and discount management', () => {
  const source = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

  assert.match(source, /showSection\('menu'\)/);
  assert.doesNotMatch(source, /庫存管理/);
  assert.doesNotMatch(source, /折扣管理/);
  assert.doesNotMatch(source, /AdminDiscount/);
  assert.doesNotMatch(source, /data-section-link="auditlog"/);
  assert.doesNotMatch(source, /操作紀錄/);
});

test('AdminMenu removes bindings batch tab and dialog helpers', () => {
  const source = fs.readFileSync(path.join(__dirname, 'admin-menu.js'), 'utf8');

  assert.doesNotMatch(source, /id: 'bindings'/);
  assert.doesNotMatch(source, /label: '批量修改'/);
  assert.doesNotMatch(source, /renderBindings/);
  assert.doesNotMatch(source, /openBatchProductSettings/);
  assert.doesNotMatch(source, /applyBatchProductSettings/);
  assert.doesNotMatch(source, /getCheckedBatchOptionIds/);
  assert.doesNotMatch(source, /附加屬性值 \/ 綁定/);
});

test('AdminMenu renders categories and option groups with source after selection checkbox', () => {
  const source = fs.readFileSync(path.join(__dirname, 'admin-menu.js'), 'utf8');

  assert.match(source, /\[renderSelectAllCheckbox\('categories', categoryIds\), '來源', '分類名稱'/);
  assert.match(source, /\[renderSelectAllCheckbox\('options', optionIds\), '來源', '群組名稱'/);
  assert.match(source, /rowActions\('Option', option\.id\)/);
});

test('AdminMenu drag reorder supports moving rows down and to the end', () => {
  const AdminMenu = createAdminMenu();
  const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  AdminMenu._test.moveItemToInsertIndex(rows, 0, 2);
  assert.deepEqual(rows.map((row) => row.id), ['b', 'a', 'c', 'd']);

  AdminMenu._test.moveItemToInsertIndex(rows, 1, rows.length);
  assert.deepEqual(rows.map((row) => row.id), ['b', 'c', 'd', 'a']);

  AdminMenu._test.moveItemToInsertIndex(rows, 2, 0);
  assert.deepEqual(rows.map((row) => row.id), ['d', 'b', 'c', 'a']);
});

test('AdminMenu select-all checkbox reflects current filtered rows', () => {
  const AdminMenu = createAdminMenu();

  assert.doesNotMatch(
    AdminMenu._test.buildSelectAllCheckbox('products', ['p-a', 'p-b'], { 'p-a': true }),
    /checked /,
  );
  assert.match(
    AdminMenu._test.buildSelectAllCheckbox('products', ['p-a', 'p-b'], { 'p-a': true, 'p-b': true, 'p-hidden': true }),
    /checked /,
  );
  assert.doesNotMatch(
    AdminMenu._test.buildSelectAllCheckbox('products', [], {}),
    /checked /,
  );
});

test('AdminMenu schedules auto-save after local changes', () => {
  const source = fs.readFileSync(path.join(__dirname, 'admin-menu.js'), 'utf8');

  assert.match(source, /function scheduleAutoSave/);
  assert.match(source, /saveAll\(\{ auto: true \}\)/);
  assert.doesNotMatch(source, /請按「儲存所有變更」寫入雲端/);
  assert.match(source, /立即儲存/);
});

test('AdminMenu hides sort fields in product and category management', () => {
  const source = fs.readFileSync(path.join(__dirname, 'admin-menu.js'), 'utf8');

  assert.doesNotMatch(source, /分類名稱', '排序'/);
  assert.doesNotMatch(source, /附加屬性', '排序'/);
  assert.match(source, /<input id="menuFormSort" type="hidden"/);
});

test('AdminMenu opens category modal with validation and character count', () => {
  const { AdminMenu, elements } = createAdminMenuWithDom();

  AdminMenu.openCategoryForm();

  assert.match(elements.menuDialogHost.innerHTML, /新增分類/);
  assert.match(elements.menuDialogHost.innerHTML, /placeholder="例如：火鍋、飯類、飲品"/);
  assert.equal(elements.menuDialogSubmit.textContent, '確認新增');
  assert.equal(elements.menuDialogSubmit.disabled, true);
  assert.equal(elements.menuFormName.focused, true);

  elements.menuFormName.value = '一二三四五六七八九十一二三四五六';
  elements.menuFormName.oninput();

  assert.equal(elements.menuFormName.value, '一二三四五六七八九十一二三四五');
  assert.equal(elements.menuFormNameCount.textContent, '15');
  assert.equal(elements.menuDialogSubmit.disabled, false);
});

test('AdminMenu opens custom group modal with validation and character count', () => {
  const { AdminMenu, elements } = createAdminMenuWithDom();

  AdminMenu.openOptionForm();

  assert.match(elements.menuDialogHost.innerHTML, /新增客製化群組/);
  assert.match(elements.menuDialogHost.innerHTML, /placeholder="例如：甜度、加麵、配料"/);
  assert.equal(elements.menuDialogSubmit.textContent, '確認新增');
  assert.equal(elements.menuDialogSubmit.disabled, true);
  assert.equal(elements.menuFormName.focused, true);

  elements.menuFormName.value = '一二三四五六七八九十一二三四五六';
  elements.menuFormName.oninput();

  assert.equal(elements.menuFormName.value, '一二三四五六七八九十一二三四五');
  assert.equal(elements.menuFormNameCount.textContent, '15');
  assert.equal(elements.menuDialogSubmit.disabled, true);

  elements.menuFormChoices.value = '不辣, 不辣, 小辣';
  elements.menuFormChoices.oninput();

  assert.equal(elements.menuDialogSubmit.disabled, false);

  elements.menuDialogOverlay.onclick({ target: elements.menuDialogOverlay });
  assert.equal(elements.menuDialogHost.innerHTML, '');
});

test('AdminMenu custom group modal closes with Escape', () => {
  const { AdminMenu, context, elements } = createAdminMenuWithDom();

  AdminMenu.openOptionForm();

  assert.match(elements.menuDialogHost.innerHTML, /menuDialogOverlay/);

  context.document.onkeydown({ key: 'Escape' });

  assert.equal(elements.menuDialogHost.innerHTML, '');
});
