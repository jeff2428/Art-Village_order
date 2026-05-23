const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createClassList() {
  return {
    values: new Set(),
    add(...values) {
      values.forEach((value) => this.values.add(value));
    },
    remove(...values) {
      values.forEach((value) => this.values.delete(value));
    },
    contains(value) {
      return this.values.has(value);
    },
  };
}

function createButton() {
  return {
    className: '',
    textContent: '',
    dataset: {},
    disabled: true,
    classList: createClassList(),
    onclick: null,
  };
}

function createElement(tag) {
  const element = {
    tag,
    className: '',
    textContent: '',
    dataset: {},
    disabled: false,
    children: [],
    classList: createClassList(),
    appendChild(child) {
      this.children.push(child);
    },
    querySelectorAll(selector) {
      if (selector !== '.customization-btn') {
        return [];
      }
      return this.children.filter((child) => child.className.includes('customization-btn'));
    },
  };
  return element;
}

function createContext() {
  const elements = {
    customizationModal: createElement('div'),
    customizationTitle: createElement('h2'),
    customizationOptions: createElement('div'),
    confirmCustomization: createButton(),
  };
  elements.customizationModal.classList.add('hidden');

  const context = {
    document: {
      createElement,
      getElementById(id) {
        return elements[id];
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'customization.js'), 'utf8');
  vm.runInContext(source, context);

  return { context, elements };
}

test('Customization disables confirm until required option is selected', () => {
  const { context, elements } = createContext();

  context.Customization.open({
    name: '紅燒麵',
    customizationOptions: [{ name: '辣度', required: true, type: 'single', choices: ['不辣', '小辣'] }],
  });

  assert.equal(elements.confirmCustomization.disabled, true);

  const group = elements.customizationOptions.children[0].children[1];
  group.children[0].onclick();

  assert.equal(elements.confirmCustomization.disabled, false);
});

test('Customization supports multiple selected values', () => {
  const { context, elements } = createContext();

  context.Customization.open({
    name: '紅燒麵',
    customizationOptions: [{ name: '加料', required: false, type: 'multiple', choices: ['豆皮', '青菜'] }],
  });

  const group = elements.customizationOptions.children[0].children[1];
  group.children[0].onclick();
  group.children[1].onclick();

  const result = context.Customization.confirm();

  assert.deepEqual(JSON.parse(JSON.stringify(result.customizations)), [
    { optionName: '加料', selectedValue: '豆皮' },
    { optionName: '加料', selectedValue: '青菜' },
  ]);
});

test('Customization renders duplicate choices only once', () => {
  const { context, elements } = createContext();

  context.Customization.open({
    name: '紅燒麵',
    customizationOptions: [{ name: '辣度', required: false, type: 'single', choices: ['不辣', '不辣', ' 小辣 ', '小辣'] }],
  });

  const group = elements.customizationOptions.children[0].children[1];

  assert.deepEqual(
    group.children.map((child) => child.textContent),
    ['不辣', '小辣'],
  );
});
