const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createClassList() {
  return {
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
  };
}

function createInput(value = '') {
  return {
    value,
    attributes: {},
    listeners: {},
    setAttribute(name, attrValue) {
      this.attributes[name] = attrValue;
    },
    addEventListener(eventName, callback) {
      this.listeners[eventName] = callback;
    },
  };
}

function createSelect() {
  return {
    _innerHTML: '',
    children: [],
    value: '',
    set innerHTML(value) {
      this._innerHTML = value;
      this.children = [];
    },
    get innerHTML() {
      return this._innerHTML;
    },
    appendChild(child) {
      this.children.push(child);
    },
  };
}

function createContext() {
  const formListeners = {};
  const elements = {
    reservationModal: { classList: createClassList() },
    reservationForm: {
      dataset: {},
      resetCalled: false,
      addEventListener(eventName, callback) {
        formListeners[eventName] = callback;
      },
      reset() {
        this.resetCalled = true;
      },
    },
    customerName: createInput(),
    customerPhone: createInput(),
    guestCount: createInput(),
    diningDate: createInput(),
    diningTime: createSelect(),
  };
  const alerts = [];
  var flatpickrConfig = null;
  var context = {
    alert: function(message) {
      alerts.push(message);
    },
    flatpickr: function(el, config) {
      flatpickrConfig = config;
    },
    document: {
      createElement: function(tagName) {
        return { tagName: tagName, value: '', textContent: '' };
      },
      getElementById: function(id) {
        return elements[id];
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'reservation.js'), 'utf8');
  vm.runInContext(source, context);

  return { context, elements, formListeners, alerts };
}

test('Reservation initializes time options from business hours', () => {
  const { context, elements } = createContext();

  context.Reservation.init({
    businessHours: { 1: { enabled: true, slots: ['11:00-12:00'] } },
    holidays: [],
  });
  elements.diningDate.listeners.change({ target: { value: '2026-05-18' } });

  assert.deepEqual(
    elements.diningTime.children.map((option) => option.value),
    ['11:00', '11:30', '12:00'],
  );
});

test('Reservation blocks submit when required fields are missing', () => {
  const { context, formListeners, alerts } = createContext();
  let submitted = false;

  context.Reservation.init({ businessHours: { 1: { enabled: true, slots: ['11:00-12:00'] } }, holidays: [] }, () => {
    submitted = true;
  });
  formListeners.submit({ preventDefault() {} });

  assert.equal(submitted, false);
  assert.equal(alerts[0], '請輸入姓名');
});

test('Reservation stores valid form data and calls submit callback', () => {
  const { context, elements, formListeners } = createContext();
  let submittedData = null;

  elements.customerName.value = '王小明';
  elements.customerPhone.value = '0912345678';
  elements.guestCount.value = '3';
  elements.diningDate.value = '2026-05-18';
  elements.diningTime.value = '11:30';

  context.Reservation.init({ businessHours: { 1: { enabled: true, slots: ['11:00-12:00'] } }, holidays: [] }, (data) => {
    submittedData = data;
  });
  formListeners.submit({ preventDefault() {} });

  assert.deepEqual(JSON.parse(JSON.stringify(submittedData)), {
    customerName: '王小明',
    phone: '0912345678',
    guestCount: 3,
    diningDate: '2026-05-18',
    diningTime: '11:30',
  });
  assert.equal(context.Reservation.getData().phone, '0912345678');
  assert.equal(elements.reservationModal.classList.contains('hidden'), true);
});
