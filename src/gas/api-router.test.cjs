const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createRouterContext() {
  const calls = [];
  const context = {
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput(content) {
        return {
          content,
          mimeType: '',
          setMimeType(mimeType) {
            this.mimeType = mimeType;
            return this;
          },
        };
      },
    },
    Logger: { log() {} },
    getSpreadsheetId() {
      calls.push(['getSpreadsheetId']);
      return 'SHEET_ID';
    },
    getFullMenuData(spreadsheetId) {
      calls.push(['getFullMenuData', spreadsheetId]);
      return { success: true, data: { categories: ['麵食'], items: [] } };
    },
    getAnnouncements(spreadsheetId) {
      calls.push(['getAnnouncements', spreadsheetId]);
      return { header: { enabled: true, content: '今日正常營業' } };
    },
    getBusinessHours(spreadsheetId) {
      calls.push(['getBusinessHours', spreadsheetId]);
      return { openTime: '11:00', closeTime: '21:00' };
    },
    getHolidays(spreadsheetId) {
      calls.push(['getHolidays', spreadsheetId]);
      return [{ date: '2026-05-19', reason: '公休' }];
    },
    processOrder(orderData) {
      calls.push(['processOrder', orderData]);
      return { success: true, orderId: 'ORD-1' };
    },
    handleAdminPost(event) {
      calls.push(['handleAdminPost', event]);
      return context.createJsonResponse({ success: true, admin: true });
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'api-router.js'), 'utf8');
  vm.runInContext(source, context);

  return { context, calls };
}

function parseResponse(output) {
  return JSON.parse(output.content);
}

test('doGet routes menu requests to menu API', () => {
  const { context, calls } = createRouterContext();

  const response = context.doGet({ parameter: { action: 'menu' } });

  assert.deepEqual(parseResponse(response), {
    success: true,
    data: { categories: ['麵食'], items: [] },
  });
  assert.deepEqual(calls, [['getSpreadsheetId'], ['getFullMenuData', 'SHEET_ID']]);
});

test('doGet routes announcements requests to announcement API', () => {
  const { context, calls } = createRouterContext();

  const response = context.doGet({ parameter: { action: 'getAnnouncements' } });

  assert.deepEqual(parseResponse(response), {
    success: true,
    data: { header: { enabled: true, content: '今日正常營業' } },
  });
  assert.deepEqual(calls, [['getSpreadsheetId'], ['getAnnouncements', 'SHEET_ID']]);
});

test('doGet routes schedule requests with business hours and holidays', () => {
  const { context } = createRouterContext();

  const response = context.doGet({ parameter: { action: 'schedule' } });

  assert.deepEqual(parseResponse(response), {
    success: true,
    data: {
      businessHours: { openTime: '11:00', closeTime: '21:00' },
      holidays: [{ date: '2026-05-19', reason: '公休' }],
    },
  });
});

test('doGet keeps getBusinessHours response compatible with frontend API', () => {
  const { context } = createRouterContext();

  const response = context.doGet({ parameter: { action: 'getBusinessHours' } });

  assert.deepEqual(parseResponse(response), {
    success: true,
    data: { openTime: '11:00', closeTime: '21:00' },
  });
});

test('doPost routes order requests to order processor', () => {
  const { context, calls } = createRouterContext();
  const orderData = { customerName: '王小明' };

  const response = context.doPost({
    postData: {
      contents: JSON.stringify({ action: 'order', data: orderData }),
    },
  });

  assert.deepEqual(parseResponse(response), { success: true, orderId: 'ORD-1' });
  assert.equal(calls[0][0], 'processOrder');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][1])), orderData);
});

test('doPost keeps admin actions delegated to admin handler', () => {
  const { context, calls } = createRouterContext();
  const event = {
    postData: {
      contents: JSON.stringify({ action: 'getMenuItems', adminToken: 'token' }),
    },
  };

  const response = context.doPost(event);

  assert.deepEqual(parseResponse(response), { success: true, admin: true });
  assert.deepEqual(calls, [['handleAdminPost', event]]);
});

test('getScheduleData returns combined business hours and holidays', () => {
  const { context, calls } = createRouterContext();

  var result = JSON.parse(JSON.stringify(context.getScheduleData('SHEET_ID')));

  assert.deepEqual(result, {
    businessHours: { openTime: '11:00', closeTime: '21:00' },
    holidays: [{ date: '2026-05-19', reason: '公休' }],
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'getBusinessHours');
  assert.equal(calls[1][0], 'getHolidays');
});

test('unknown requests return a clear error', () => {
  const { context } = createRouterContext();

  const response = context.doGet({ parameter: { action: 'unknown' } });

  assert.deepEqual(parseResponse(response), {
    success: false,
    message: '未知的 API action: unknown',
  });
});
