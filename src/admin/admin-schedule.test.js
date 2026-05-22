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
  const elements = {
    scheduleLoading: createElement('scheduleLoading'),
    scheduleContent: createElement('scheduleContent'),
    scheduleMessage: createElement('scheduleMessage'),
    weeklySchedule: createElement('weeklySchedule'),
    holidayList: createElement('holidayList'),
  };
  const context = {
    AdminApi: {
      getBusinessHours() {
        return Promise.resolve({ data: scheduleData });
      },
      getHolidays() {
        return Promise.resolve({ data: [] });
      },
    },
    document: {
      getElementById(id) {
        if (!elements[id]) elements[id] = createElement(id);
        return elements[id];
      },
      createElement,
      body: createElement('body'),
    },
  };

  vm.createContext(context);
  const utils = fs.readFileSync(path.join(__dirname, 'admin-utils.js'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, 'admin-schedule.js'), 'utf8');
  vm.runInContext(utils, context);
  vm.runInContext(source, context);

  return { context, elements };
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
