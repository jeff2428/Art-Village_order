const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createElement(id) {
  return {
    id,
    value: '',
    textContent: '',
    innerHTML: '',
    className: '',
    checked: false,
    classList: {
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
    },
    appendChild(child) {
      this.children = this.children || [];
      this.children.push(child);
    },
    focus() {},
  };
}

function createScheduleContext(scheduleData) {
  var apiCalls = [];
  var timeoutIds = 0;
  var pendingTimeouts = {};

  const elements = {
    scheduleLoading: createElement('scheduleLoading'),
    scheduleContent: createElement('scheduleContent'),
    scheduleMessage: createElement('scheduleMessage'),
    weeklySchedule: createElement('weeklySchedule'),
    holidayList: createElement('holidayList'),
    holidayDate: createElement('holidayDate'),
    holidayReason: createElement('holidayReason'),
    holidayRemoveModal: createElement('holidayRemoveModal'),
    scheduleBatchModal: createElement('scheduleBatchModal'),
  };
  const context = {
    AdminApi: {
      getBusinessHours() {
        return Promise.resolve({ data: scheduleData });
      },
      getHolidays() {
        return Promise.resolve({ data: [] });
      },
      addHoliday: function(data) {
        apiCalls.push({ name: 'addHoliday', args: [JSON.parse(JSON.stringify(data))] });
        return Promise.resolve();
      },
      removeHoliday: function(data) {
        apiCalls.push({ name: 'removeHoliday', args: [JSON.parse(JSON.stringify(data))] });
        return Promise.resolve();
      },
      call: function(action, data) {
        apiCalls.push({ name: 'call', args: [action, JSON.parse(JSON.stringify(data))] });
        return Promise.resolve();
      },
    },
    setTimeout: function(fn, ms) {
      var id = ++timeoutIds;
      pendingTimeouts[id] = fn;
      return id;
    },
    clearTimeout: function(id) {
      delete pendingTimeouts[id];
    },
    document: {
      getElementById: function(id) {
        if (!elements[id]) elements[id] = createElement(id);
        return elements[id];
      },
      createElement: createElement,
      body: createElement('body'),
      addEventListener: function() {},
    },
  };

  vm.createContext(context);
  const utils = fs.readFileSync(path.join(__dirname, 'admin-utils.js'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, 'admin-schedule.js'), 'utf8');
  vm.runInContext(utils, context);
  vm.runInContext(source, context);

  return { context, elements, apiCalls: apiCalls, pendingTimeouts: pendingTimeouts };
}

test('AdminSchedule validates that each enabled time slot starts before it ends', async () => {
  const { context, elements } = createScheduleContext({
    1: { enabled: true, slots: ['18:00-17:00'] },
  });

  await context.AdminSchedule.load();

  assert.equal(context.AdminSchedule.validateSchedule(), false);
  assert.match(elements.scheduleMessage.textContent, /需早於結束時間/);
});

test('AdminSchedule accepts valid enabled time slots', async () => {
  const { context } = createScheduleContext({
    1: { enabled: true, slots: ['11:00-14:00', '17:00-20:00'] },
  });

  await context.AdminSchedule.load();

  assert.equal(context.AdminSchedule.validateSchedule(), true);
});

test('AdminSchedule batch applies hours to selected weekdays', async () => {
  const { context } = createScheduleContext({});

  await context.AdminSchedule.load();

  const schedule = {};
  const result = context.AdminSchedule._test.applyBatchHours(schedule, [1, 2, 3], {
    enabled: true,
    slots: ['11:00-14:00', '17:00-21:00'],
  });

  assert.equal(result.success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(schedule['1'])), { enabled: true, slots: ['11:00-14:00', '17:00-21:00'] });
  assert.deepEqual(JSON.parse(JSON.stringify(schedule['2'])), { enabled: true, slots: ['11:00-14:00', '17:00-21:00'] });
  assert.deepEqual(JSON.parse(JSON.stringify(schedule['3'])), { enabled: true, slots: ['11:00-14:00', '17:00-21:00'] });
});

test('AdminSchedule batch can set selected weekdays as closed', async () => {
  const { context } = createScheduleContext({});

  await context.AdminSchedule.load();

  const schedule = { 1: { enabled: true, slots: ['11:00-21:00'] } };
  const result = context.AdminSchedule._test.applyBatchHours(schedule, [1], {
    enabled: false,
    slots: ['11:00-21:00'],
  });

  assert.equal(result.success, true);
  assert.deepEqual(JSON.parse(JSON.stringify(schedule['1'])), { enabled: false, slots: [] });
});

test('AdminSchedule batch rejects empty days and invalid ranges', async () => {
  const { context } = createScheduleContext({});

  await context.AdminSchedule.load();

  assert.deepEqual(
    JSON.parse(JSON.stringify(context.AdminSchedule._test.applyBatchHours({}, [], { enabled: true, slots: ['11:00-21:00'] }))),
    { success: false, message: '請至少選擇一個星期' },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.AdminSchedule._test.applyBatchHours({}, [1], { enabled: true, slots: ['18:00-17:00'] }))),
    { success: false, message: '營業時段需早於結束時間' },
  );
});

function flushMicrotasks() {
  return new Promise(function(resolve) { setTimeout(resolve, 0); });
}

test('AdminSchedule addHoliday calls AdminApi with date and reason', async () => {
  const { context, elements, apiCalls } = createScheduleContext({});

  await context.AdminSchedule.load();

  elements.holidayDate.value = '2026-06-19';
  elements.holidayReason.value = '端午節';
  context.AdminSchedule.addHoliday();

  await flushMicrotasks();

  assert.equal(apiCalls.length, 1);
  assert.deepEqual(apiCalls[0], { name: 'addHoliday', args: [{ date: '2026-06-19', reason: '端午節' }] });
  assert.equal(elements.holidayDate.value, '');
  assert.equal(elements.holidayReason.value, '');
  assert.match(elements.scheduleMessage.textContent, /已新增/);
});

test('AdminSchedule addHoliday rejects empty date', () => {
  const { context, elements, apiCalls } = createScheduleContext({});

  elements.holidayDate.value = '';
  context.AdminSchedule.addHoliday();

  assert.equal(apiCalls.length, 0);
  assert.match(elements.scheduleMessage.textContent, /請選擇日期/);
});

test('AdminSchedule addHoliday shows error on API failure', async () => {
  const { context, elements, apiCalls } = createScheduleContext({});

  context.AdminApi.addHoliday = function(data) {
    apiCalls.push({ name: 'addHoliday', args: [JSON.parse(JSON.stringify(data))] });
    return Promise.reject(new Error('網路錯誤'));
  };

  elements.holidayDate.value = '2026-06-19';
  context.AdminSchedule.addHoliday();

  await flushMicrotasks();

  assert.match(elements.scheduleMessage.textContent, /新增失敗/);
  assert.match(elements.scheduleMessage.textContent, /網路錯誤/);
});

test('AdminSchedule removeHoliday shows modal then confirms', async () => {
  const { context, elements, apiCalls } = createScheduleContext({});

  context.AdminSchedule.removeHoliday('2026-06-19');

  var modal = elements.holidayRemoveModal;
  assert.equal(modal.className.includes('hidden'), false);

  var confirmBtn = elements.holidayModalConfirm;
  assert.equal(confirmBtn.disabled, false);
  assert.equal(confirmBtn.textContent, '確認刪除');

  context.AdminSchedule.confirmRemoveHoliday();
  await flushMicrotasks();

  assert.equal(apiCalls.length, 1);
  assert.deepEqual(apiCalls[0], { name: 'removeHoliday', args: [{ date: '2026-06-19' }] });
  assert.match(elements.scheduleMessage.textContent, /已刪除/);
});

test('AdminSchedule saveHours calls AdminApi with current schedule', async () => {
  var initialData = {
    1: { enabled: true, slots: ['11:00-14:00', '17:00-21:00'] },
  };
  const { context, apiCalls } = createScheduleContext(initialData);

  await context.AdminSchedule.load();

  apiCalls.length = 0;
  await context.AdminSchedule.saveHours();

  assert.ok(apiCalls.length >= 1);
  assert.equal(apiCalls[0].name, 'call');
  assert.equal(apiCalls[0].args[0], 'updateBusinessHours');
  assert.deepEqual(apiCalls[0].args[1].scheduleData, initialData);
  assert.match(context.document.getElementById('scheduleMessage').textContent, /已成功更新/);
});

test('AdminSchedule saveHours rejects overlapping time slots', async () => {
  const { context, elements, apiCalls } = createScheduleContext({
    1: { enabled: true, slots: ['11:00-14:00', '13:00-17:00'] },
  });

  await context.AdminSchedule.load();

  apiCalls.length = 0;
  context.AdminSchedule.saveHours();

  assert.equal(apiCalls.length, 0);
  assert.match(elements.scheduleMessage.textContent, /重疊/);
});

test('AdminSchedule saveHours rejects enabled day with no slots', async () => {
  const { context, elements, apiCalls } = createScheduleContext({
    1: { enabled: true, slots: [] },
  });

  await context.AdminSchedule.load();

  apiCalls.length = 0;
  context.AdminSchedule.saveHours();

  assert.equal(apiCalls.length, 0);
  assert.match(elements.scheduleMessage.textContent, /無任何時段/);
});

test('AdminSchedule batch rejects overlapping slots', () => {
  const { context } = createScheduleContext({});

  var result = context.AdminSchedule._test.applyBatchHours({}, [1], {
    enabled: true,
    slots: ['11:00-14:00', '13:00-17:00'],
  });

  assert.equal(result.success, false);
  assert.match(result.message, /重疊/);
});

test('AdminSchedule scheduleAutoSave triggers saveHours after timeout', async () => {
  var initialData = {
    1: { enabled: true, slots: ['11:00-14:00'] },
  };
  const { context, apiCalls, pendingTimeouts } = createScheduleContext(initialData);

  await context.AdminSchedule.load();

  apiCalls.length = 0;

  context.AdminSchedule.toggleDay(1, true);

  var timeoutKeys = Object.keys(pendingTimeouts);
  assert.ok(timeoutKeys.length > 0);

  var timeoutFn = pendingTimeouts[timeoutKeys[0]];
  assert.ok(timeoutFn);

  timeoutFn();

  await new Promise(function(resolve) { setTimeout(resolve, 10); });

  assert.ok(apiCalls.length >= 1);
  assert.equal(apiCalls[0].name, 'call');
  assert.equal(apiCalls[0].args[0], 'updateBusinessHours');
});

test('AdminSchedule source auto-saves weekly hour changes', () => {
  const source = fs.readFileSync(path.join(__dirname, 'admin-schedule.js'), 'utf8');

  assert.match(source, /function scheduleAutoSave/);
  assert.match(source, /saveHours\(\{ auto: true \}\)/);
  assert.match(source, /營業排程已自動儲存/);
  assert.doesNotMatch(source, /請記得儲存設定/);
});
