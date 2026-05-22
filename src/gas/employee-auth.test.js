const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function createSheet(rows = []) {
  return {
    rows,
    getDataRange() {
      return {
        getValues: () => rows,
      };
    },
    getLastRow() {
      return rows.length;
    },
    getRange(rowIndex, columnIndex) {
      return {
        setValue(value) {
          if (!rows[rowIndex - 1]) rows[rowIndex - 1] = [];
          rows[rowIndex - 1][columnIndex - 1] = value;
        },
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

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest();
}

function createEmployeeContext(initialSheets = {}, scriptProperties = {}) {
  const sheets = {};
  Object.keys(initialSheets).forEach((name) => {
    sheets[name] = createSheet(initialSheets[name]);
  });

  const context = {
    Logger: { log() {} },
    PropertiesService: {
      getScriptProperties() {
        return {
          getProperty(key) {
            return scriptProperties[key] || null;
          },
        };
      },
    },
    Math,
    Date,
    Utilities: {
      DigestAlgorithm: { SHA_256: 'SHA_256' },
      computeDigest(_algorithm, value) {
        return Array.from(sha256(value)).map((byte) => (byte > 127 ? byte - 256 : byte));
      },
      getUuid() {
        return 'salt-1';
      },
      formatDate(_date, _timezone, format) {
        if (format === 'yyyyMMdd-HHmmss') return '20260518-103000';
        if (format === 'yyyy-MM-dd HH:mm:ss') return '2026-05-18 10:30:00';
        return '2026-05-18';
      },
    },
    SpreadsheetApp: {
      openById() {
        return {
          getSheetByName(name) {
            return sheets[name] || null;
          },
          insertSheet(name) {
            sheets[name] = createSheet([]);
            return sheets[name];
          },
        };
      },
    },
  };

  vm.createContext(context);
  const source = fs.readFileSync(path.join(__dirname, 'employee-auth.js'), 'utf8');
  vm.runInContext(source, context);

  return { context, sheets };
}

test('addEmployee stores a salted hash instead of plaintext PIN', () => {
  const { context, sheets } = createEmployeeContext();

  const result = context.addEmployee('SHEET_ID', {
    name: '店長',
    pinCode: '1234',
    role: 1,
  });

  assert.equal(result.success, true);
  const headers = sheets.Employees.rows[0];
  const row = sheets.Employees.rows[1];
  assert.equal(row[headers.indexOf('pinCode')], '');
  assert.equal(row[headers.indexOf('pinSalt')], 'salt-1');
  assert.equal(row[headers.indexOf('pinHash')], context.hashPinCode('1234', 'salt-1'));
});

test('loginEmployee accepts hashed PIN and clears failed attempts', () => {
  const hash = crypto.createHash('sha256').update('salt-1:1234').digest('hex');
  const { context, sheets } = createEmployeeContext({
    Employees: [
      ['employeeId', 'name', 'role', 'pinCode', 'pinHash', 'pinSalt', 'failedAttempts', 'lockedUntil', 'enabled', 'lastLogin'],
      ['EMP-1', '店長', 1, '', hash, 'salt-1', 2, '', true, ''],
    ],
  });

  const result = context.loginEmployee('SHEET_ID', '1234');
  const headers = sheets.Employees.rows[0];
  const row = sheets.Employees.rows[1];

  assert.equal(result.success, true);
  assert.equal(row[headers.indexOf('failedAttempts')], 0);
  assert.equal(row[headers.indexOf('lockedUntil')], '');
  assert.equal(row[headers.indexOf('lastLogin')], '2026-05-18 10:30:00');
});

test('loginEmployee locks an enabled employee after repeated failures', () => {
  const { context, sheets } = createEmployeeContext({
    Employees: [
      ['employeeId', 'name', 'role', 'pinCode', 'failedAttempts', 'lockedUntil', 'enabled'],
      ['EMP-1', '店長', 1, '1234', 4, '', true],
    ],
  });

  const result = context.loginEmployee('SHEET_ID', '9999');
  const headers = sheets.Employees.rows[0];
  const row = sheets.Employees.rows[1];

  assert.equal(result.success, false);
  assert.equal(row[headers.indexOf('failedAttempts')], 5);
  assert.equal(row[headers.indexOf('lockedUntil')], '2026-05-18 10:30:00');
});

test('resetEmployeePin requires the configured reset token', () => {
  const { context } = createEmployeeContext({
    Employees: [
      ['employeeId', 'name', 'role', 'pinCode', 'enabled'],
      ['EMP-1', '店長', 1, '1234', true],
    ],
  }, { PIN_RESET_TOKEN: 'reset-secret' });

  const result = context.resetEmployeePin('SHEET_ID', {
    employeeId: 'EMP-1',
    resetToken: 'wrong-token',
    pinCode: '5678',
  });

  assert.equal(result.success, false);
  assert.equal(result.message, '重設代碼錯誤');
});

test('resetEmployeePin stores a new salted hash and clears lockout state', () => {
  const { context, sheets } = createEmployeeContext({
    Employees: [
      ['employeeId', 'name', 'role', 'pinCode', 'pinHash', 'pinSalt', 'failedAttempts', 'lockedUntil', 'enabled', 'updatedAt'],
      ['EMP-1', '店長', 1, '1234', '', '', 5, '2026-05-18 11:00:00', true, ''],
    ],
  }, { PIN_RESET_TOKEN: 'reset-secret' });

  const result = context.resetEmployeePin('SHEET_ID', {
    employeeId: 'EMP-1',
    resetToken: 'reset-secret',
    pinCode: '5678',
  });
  const headers = sheets.Employees.rows[0];
  const row = sheets.Employees.rows[1];

  assert.equal(result.success, true);
  assert.equal(row[headers.indexOf('pinCode')], '');
  assert.equal(row[headers.indexOf('pinSalt')], 'salt-1');
  assert.equal(row[headers.indexOf('pinHash')], context.hashPinCode('5678', 'salt-1'));
  assert.equal(row[headers.indexOf('failedAttempts')], 0);
  assert.equal(row[headers.indexOf('lockedUntil')], '');
  assert.equal(row[headers.indexOf('updatedAt')], '2026-05-18 10:30:00');

  const loginResult = context.loginEmployee('SHEET_ID', '5678');
  assert.equal(loginResult.success, true);
});

test('changeEmployeePin rejects an incorrect current PIN', () => {
  const hash = crypto.createHash('sha256').update('salt-1:1234').digest('hex');
  const { context, sheets } = createEmployeeContext({
    Employees: [
      ['employeeId', 'name', 'role', 'pinCode', 'pinHash', 'pinSalt', 'failedAttempts', 'lockedUntil', 'enabled'],
      ['EMP-1', '店長', 1, '', hash, 'salt-1', 0, '', true],
    ],
  });

  const result = context.changeEmployeePin('SHEET_ID', {
    employeeId: 'EMP-1',
    currentPin: '9999',
    newPin: '5678',
  });
  const headers = sheets.Employees.rows[0];
  const row = sheets.Employees.rows[1];

  assert.equal(result.success, false);
  assert.equal(result.message, '目前 PIN 錯誤');
  assert.equal(row[headers.indexOf('failedAttempts')], 1);
});

test('changeEmployeePin updates the hash after verifying the current PIN', () => {
  const hash = crypto.createHash('sha256').update('salt-old:1234').digest('hex');
  const { context, sheets } = createEmployeeContext({
    Employees: [
      ['employeeId', 'name', 'role', 'pinCode', 'pinHash', 'pinSalt', 'failedAttempts', 'lockedUntil', 'enabled', 'updatedAt'],
      ['EMP-1', '店長', 1, '', hash, 'salt-old', 2, '', true, ''],
    ],
  });

  const result = context.changeEmployeePin('SHEET_ID', {
    employeeId: 'EMP-1',
    currentPin: '1234',
    newPin: '5678',
  });
  const headers = sheets.Employees.rows[0];
  const row = sheets.Employees.rows[1];

  assert.equal(result.success, true);
  assert.equal(row[headers.indexOf('pinCode')], '');
  assert.equal(row[headers.indexOf('pinSalt')], 'salt-1');
  assert.equal(row[headers.indexOf('pinHash')], context.hashPinCode('5678', 'salt-1'));
  assert.equal(row[headers.indexOf('failedAttempts')], 0);
  assert.equal(row[headers.indexOf('updatedAt')], '2026-05-18 10:30:00');

  assert.equal(context.loginEmployee('SHEET_ID', '1234').success, false);
  assert.equal(context.loginEmployee('SHEET_ID', '5678').success, true);
});
