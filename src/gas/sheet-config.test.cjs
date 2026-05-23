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
        setValue(value) {
          rows[rowIndex - 1][columnIndex - 1] = value;
        },
      };
    },
    deleteRow(rowIndex) {
      if (rowIndex >= 1 && rowIndex <= rows.length) {
        rows.splice(rowIndex - 1, 1);
      }
    },
  };
}

function createConfigContext(sheetRows) {
  const context = {
    Logger: { log() {} },
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
    clearScheduleCache() {},
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'sheet-config.js'), 'utf8');
  vm.runInContext(source, context);

  return context;
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

test('getAnnouncements reads Announcements sheet into three announcement slots', () => {
  const context = createConfigContext({
    Announcements: [
      ['position', 'content', 'enabled'],
      ['header', '今日正常營業', true],
      ['popup', '尖峰時段請稍候', 'TRUE'],
      ['checkout', '送出後請來電修改或取消', false],
    ],
  });

  const announcements = context.getAnnouncements('SHEET_ID');

  assert.deepEqual(plain(announcements), {
    header: { content: '今日正常營業', enabled: true },
    popup: { content: '尖峰時段請稍候', enabled: true },
    checkout: { content: '送出後請來電修改或取消', enabled: false },
  });
});

test('getAnnouncements fills missing slots with defaults', () => {
  const context = createConfigContext({
    Announcements: [
      ['position', 'content', 'enabled'],
      ['header', '今日正常營業', true],
    ],
  });

  const announcements = context.getAnnouncements('SHEET_ID');

  assert.equal(announcements.header.content, '今日正常營業');
  assert.deepEqual(plain(Object.keys(announcements)), ['header', 'popup', 'checkout']);
  assert.deepEqual(plain(announcements.popup), { content: '', enabled: false });
  assert.equal(announcements.checkout.enabled, true);
});

test('getAnnouncements falls back to legacy announcement sheet', () => {
  const context = createConfigContext({
    '公告設定': [
      ['版位', '內容', '顯示開關'],
      ['popup', '今日候位時間較長', true],
    ],
  });

  const announcements = context.getAnnouncements('SHEET_ID');

  assert.equal(announcements.popup.content, '今日候位時間較長');
  assert.equal(announcements.popup.enabled, true);
  assert.equal(announcements.header.enabled, false);
  assert.equal(announcements.checkout.enabled, true);
});

test('getAnnouncements returns defaults when no announcement sheet exists', () => {
  const context = createConfigContext({});

  const announcements = context.getAnnouncements('SHEET_ID');

  assert.deepEqual(plain(Object.keys(announcements)), ['header', 'popup', 'checkout']);
  assert.deepEqual(plain(announcements.header), { content: '', enabled: false });
  assert.deepEqual(plain(announcements.popup), { content: '', enabled: false });
  assert.equal(announcements.checkout.enabled, true);
});

function defaultWeeklySchedule() {
  const schedule = {};
  for (let day = 0; day < 7; day += 1) {
    schedule[String(day)] = { enabled: true, slots: ['11:00-21:00'] };
  }
  return schedule;
}

test('getBusinessHours reads weekly BusinessHours rows', () => {
  const context = createConfigContext({
    BusinessHours: [
      ['day', 'enabled', 'slots'],
      ['1', true, '11:30-14:00,17:00-20:30'],
      ['2', false, ''],
    ],
  });

  const expected = defaultWeeklySchedule();
  expected['1'] = { enabled: true, slots: ['11:30-14:00', '17:00-20:30'] };
  expected['2'] = { enabled: false, slots: [] };

  assert.deepEqual(plain(context.getBusinessHours('SHEET_ID')), expected);
});

test('getBusinessHours falls back to defaults when no sheet exists', () => {
  const context = createConfigContext({});

  assert.deepEqual(plain(context.getBusinessHours('SHEET_ID')), defaultWeeklySchedule());
});

test('updateBusinessHours batch writes weekly rows', () => {
  const sheetRows = {
    '營業時間': [['old']],
  };
  const context = createConfigContext(sheetRows);
  const schedule = defaultWeeklySchedule();
  schedule['1'] = { enabled: true, slots: ['11:00-14:00', '17:00-21:00'] };
  schedule['2'] = { enabled: false, slots: [] };

  const result = context.updateBusinessHours('SHEET_ID', schedule);

  assert.equal(result.success, true);
  assert.equal(sheetRows['營業時間'].length, 8);
  assert.deepEqual(sheetRows['營業時間'][1], ['0', true, '11:00-21:00']);
  assert.deepEqual(sheetRows['營業時間'][2], ['1', true, '11:00-14:00,17:00-21:00']);
  assert.deepEqual(sheetRows['營業時間'][3], ['2', false, '']);
});

test('getHolidays reads enabled Holidays rows and ignores disabled rows', () => {
  const context = createConfigContext({
    Holidays: [
      ['date', 'reason', 'enabled'],
      ['2026-05-19', '公休', true],
      ['2026-05-20', '已恢復營業', false],
    ],
  });

  assert.deepEqual(plain(context.getHolidays('SHEET_ID')), [
    { date: '2026-05-19', reason: '公休' },
  ]);
});

test('addHoliday appends row to existing Holidays sheet', () => {
  const sheetRows = {
    '休假日期': [['日期', '原因']],
  };
  const context = createConfigContext(sheetRows);

  const result = context.addHoliday('SHEET_ID', '2026-06-01', '端午節');

  assert.equal(result.success, true);
  assert.match(result.message, /2026-06-01/);
  assert.equal(sheetRows['休假日期'].length, 2);
  assert.deepEqual(plain(sheetRows['休假日期'][1]), ['2026-06-01', '端午節']);
});

test('addHoliday creates sheet if missing', () => {
  const sheetRows = {};
  const context = createConfigContext(sheetRows);

  const result = context.addHoliday('SHEET_ID', '2026-06-01', '補假');

  assert.equal(result.success, true);
  assert.ok(sheetRows['休假日期']);
  assert.equal(sheetRows['休假日期'].length, 2);
  assert.deepEqual(plain(sheetRows['休假日期'][0]), ['日期', '原因']);
  assert.deepEqual(plain(sheetRows['休假日期'][1]), ['2026-06-01', '補假']);
});

test('addHoliday defaults reason to empty string', () => {
  const sheetRows = {
    '休假日期': [['日期', '原因']],
  };
  const context = createConfigContext(sheetRows);

  context.addHoliday('SHEET_ID', '2026-06-01');

  assert.equal(sheetRows['休假日期'].length, 2);
  assert.deepEqual(plain(sheetRows['休假日期'][1]), ['2026-06-01', '']);
});

test('removeHoliday deletes matching row from Holidays sheet', () => {
  const sheetRows = {
    '休假日期': [
      ['日期', '原因'],
      ['2026-05-19', '公休'],
      ['2026-05-20', '補假'],
    ],
  };
  const context = createConfigContext(sheetRows);

  const result = context.removeHoliday('SHEET_ID', '2026-05-19');

  assert.equal(result.success, true);
  assert.equal(sheetRows['休假日期'].length, 2);
  assert.equal(plain(sheetRows['休假日期'][1][0]), '2026-05-20');
});

test('removeHoliday returns error for non-existent date', () => {
  const sheetRows = {
    '休假日期': [
      ['日期', '原因'],
      ['2026-05-19', '公休'],
    ],
  };
  const context = createConfigContext(sheetRows);

  const result = context.removeHoliday('SHEET_ID', '2026-06-01');

  assert.equal(result.success, false);
  assert.match(result.message, /找不到/);
});

test('removeHoliday returns error when Holidays sheet missing', () => {
  const context = createConfigContext({});

  const result = context.removeHoliday('SHEET_ID', '2026-06-01');

  assert.equal(result.success, false);
  assert.match(result.message, /找不到工作表/);
});
