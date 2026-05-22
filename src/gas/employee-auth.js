/**
 * employee-auth.js
 * 員工權限管理模組
 * 職責：員工登入驗證、權限檢查、操作紀錄
 */

var EMPLOYEE_HEADERS = [
  'employeeId', 'name', 'role', 'pinCode', 'pinHash', 'pinSalt',
  'failedAttempts', 'lockedUntil', 'phone', 'lineUserId', 'enabled',
  'createdAt', 'updatedAt', 'lastLogin'
];

var EMPLOYEE_MAX_FAILED_ATTEMPTS = 5;
var EMPLOYEE_LOCK_MINUTES = 15;

function loginEmployee(spreadsheetId, pinCode) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ensureEmployeeSheet(ss);
    var data = sheet.getDataRange().getValues();
    var headers = ensureEmployeeHeaders(sheet, data[0] || []);
    var pin = String(pinCode || '');

    if (!isValidPinCode(pin)) {
      return {
        success: false,
        message: 'PIN 碼格式錯誤'
      };
    }

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!employeeCell(row, headers, 'employeeId')) continue;

      if (!isEmployeeEnabled(row, headers)) {
        continue;
      }

      if (isEmployeeLocked(row, headers)) {
        continue;
      }

      if (verifyEmployeePin(row, headers, pin)) {
        var now = formatEmployeeTimestamp();
        setEmployeeCell(sheet, i + 1, headers, 'failedAttempts', 0);
        setEmployeeCell(sheet, i + 1, headers, 'lockedUntil', '');
        setEmployeeCell(sheet, i + 1, headers, 'lastLogin', now);
        setEmployeeCell(sheet, i + 1, headers, 'updatedAt', now);
        migratePlainPinIfNeeded(sheet, i + 1, row, headers, pin);

        return {
          success: true,
          employee: {
            employeeId: employeeCell(row, headers, 'employeeId'),
            name: employeeCell(row, headers, 'name'),
            role: parseEmployeeRole(employeeCell(row, headers, 'role')),
            lastLogin: now
          },
          message: '登入成功'
        };
      }

      recordFailedLogin(sheet, i + 1, row, headers);
    }

    return {
      success: false,
      message: 'PIN 碼錯誤或帳號已停用'
    };

  } catch (e) {
    Logger.log('loginEmployee 錯誤: ' + e.toString());
    return {
      success: false,
      message: '登入失敗'
    };
  }
}

function checkPermission(spreadsheetId, employeeId, requiredRole) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('Employees');

    if (!sheet) {
      return { hasPermission: false, employeeRole: 0 };
    }

    var data = sheet.getDataRange().getValues();
    var headers = getEmployeeHeaderMap(data[0] || []);

    for (var i = 1; i < data.length; i++) {
      if (employeeCell(data[i], headers, 'employeeId') === employeeId) {
        var employeeRole = parseEmployeeRole(employeeCell(data[i], headers, 'role'));
        return {
          hasPermission: isEmployeeEnabled(data[i], headers) && employeeRole <= requiredRole,
          employeeRole: employeeRole
        };
      }
    }

    return { hasPermission: false, employeeRole: 0 };

  } catch (e) {
    Logger.log('checkPermission 錯誤: ' + e.toString());
    return { hasPermission: false, employeeRole: 0 };
  }
}

function logAction(spreadsheetId, employeeId, action, target, details) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ensureSheet(ss, 'AuditLog', [
      'logId', 'timestamp', 'actorId', 'actorName', 'action', 'targetType',
      'targetId', 'beforeJson', 'afterJson', 'ipAddress', 'userAgent'
    ]);

    var logId = 'LOG-' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    var timestamp = formatEmployeeTimestamp();
    var detailObject = details || {};

    appendEmployeeRows(sheet, [[
      logId,
      timestamp,
      employeeId || 'system',
      detailObject.actorName || '',
      action,
      detailObject.targetType || target || '',
      detailObject.targetId || '',
      detailObject.beforeJson ? JSON.stringify(detailObject.beforeJson) : '',
      detailObject.afterJson ? JSON.stringify(detailObject.afterJson) : '',
      detailObject.ipAddress || '',
      detailObject.userAgent || ''
    ]]);

    return true;

  } catch (e) {
    Logger.log('logAction 錯誤: ' + e.toString());
    return false;
  }
}

function getAuditLog(spreadsheetId, limit) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('AuditLog');

    if (!sheet) {
      return [];
    }

    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    var logs = [];
    var headers = getEmployeeHeaderMap(data[0] || []);
    var startIndex = Math.max(1, data.length - (limit || 100));

    for (var i = data.length - 1; i >= startIndex; i--) {
      var row = data[i];
      logs.push({
        logId: employeeCell(row, headers, 'logId') || row[0],
        timestamp: employeeCell(row, headers, 'timestamp') || row[1],
        employeeId: employeeCell(row, headers, 'actorId') || employeeCell(row, headers, 'employeeId') || row[2],
        action: employeeCell(row, headers, 'action') || row[3],
        target: employeeCell(row, headers, 'targetId') || employeeCell(row, headers, 'target') || row[4],
        details: employeeCell(row, headers, 'afterJson') || employeeCell(row, headers, 'details') || row[5],
        ipAddress: employeeCell(row, headers, 'ipAddress') || row[6]
      });
    }

    return logs;

  } catch (e) {
    Logger.log('getAuditLog 錯誤: ' + e.toString());
    return [];
  }
}

function addEmployee(spreadsheetId, data) {
  try {
    var validation = validateEmployeeInput(data, true);
    if (!validation.valid) return validation;

    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ensureEmployeeSheet(ss);
    var existingData = sheet.getDataRange().getValues();
    var headers = ensureEmployeeHeaders(sheet, existingData[0] || []);
    var employeeId = 'EMP-' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd-HHmmss');
    var now = formatEmployeeTimestamp();
    var salt = createPinSalt();
    var row = buildEmployeeRow(headers, {
      employeeId: employeeId,
      name: sanitizeEmployeeText(data.name, 80),
      role: parseEmployeeRole(data.role) || 3,
      pinCode: '',
      pinHash: hashPinCode(String(data.pinCode), salt),
      pinSalt: salt,
      failedAttempts: 0,
      lockedUntil: '',
      phone: sanitizeEmployeeText(data.phone || '', 30),
      lineUserId: sanitizeEmployeeText(data.lineUserId || '', 80),
      enabled: data.enabled !== false,
      createdAt: now,
      updatedAt: now,
      lastLogin: ''
    });

    appendEmployeeRows(sheet, [row]);

    return {
      success: true,
      message: '已新增員工: ' + sanitizeEmployeeText(data.name, 80),
      employeeId: employeeId
    };

  } catch (e) {
    Logger.log('addEmployee 錯誤: ' + e.toString());
    return {
      success: false,
      message: '新增員工失敗'
    };
  }
}

function updateEmployee(spreadsheetId, data) {
  try {
    var validation = validateEmployeeInput(data, false);
    if (!validation.valid) return validation;

    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ensureEmployeeSheet(ss);
    var sheetData = sheet.getDataRange().getValues();
    var headers = ensureEmployeeHeaders(sheet, sheetData[0] || []);

    for (var i = 1; i < sheetData.length; i++) {
      if (employeeCell(sheetData[i], headers, 'employeeId') === data.employeeId) {
        var now = formatEmployeeTimestamp();

        if (data.pinCode) {
          var salt = createPinSalt();
          setEmployeeCell(sheet, i + 1, headers, 'pinCode', '');
          setEmployeeCell(sheet, i + 1, headers, 'pinHash', hashPinCode(String(data.pinCode), salt));
          setEmployeeCell(sheet, i + 1, headers, 'pinSalt', salt);
          setEmployeeCell(sheet, i + 1, headers, 'failedAttempts', 0);
          setEmployeeCell(sheet, i + 1, headers, 'lockedUntil', '');
        }

        if (data.name !== undefined) setEmployeeCell(sheet, i + 1, headers, 'name', sanitizeEmployeeText(data.name, 80));
        if (data.role !== undefined) setEmployeeCell(sheet, i + 1, headers, 'role', parseEmployeeRole(data.role));
        if (data.enabled !== undefined) setEmployeeCell(sheet, i + 1, headers, 'enabled', data.enabled === true);
        if (data.phone !== undefined) setEmployeeCell(sheet, i + 1, headers, 'phone', sanitizeEmployeeText(data.phone, 30));
        if (data.lineUserId !== undefined) setEmployeeCell(sheet, i + 1, headers, 'lineUserId', sanitizeEmployeeText(data.lineUserId, 80));
        setEmployeeCell(sheet, i + 1, headers, 'updatedAt', now);

        return {
          success: true,
          message: '已更新員工: ' + sanitizeEmployeeText(data.name || employeeCell(sheetData[i], headers, 'name'), 80)
        };
      }
    }

    return {
      success: false,
      message: '找不到員工: ' + sanitizeEmployeeText(data.employeeId, 80)
    };

  } catch (e) {
    Logger.log('updateEmployee 錯誤: ' + e.toString());
    return {
      success: false,
      message: '更新員工失敗'
    };
  }
}

function resetEmployeePin(spreadsheetId, data) {
  try {
    data = data || {};
    var employeeId = sanitizeEmployeeText(data.employeeId, 80);
    var newPin = String(data.pinCode || '');

    if (!employeeId) {
      return { success: false, message: '請輸入員工 ID' };
    }

    if (!isValidPinCode(newPin)) {
      return { success: false, message: 'PIN 碼必須為 4-6 位數字' };
    }

    if (!isValidEmployeeResetToken(data.resetToken)) {
      return { success: false, message: '重設代碼錯誤' };
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ensureEmployeeSheet(ss);
    var sheetData = sheet.getDataRange().getValues();
    var headers = ensureEmployeeHeaders(sheet, sheetData[0] || []);

    for (var i = 1; i < sheetData.length; i++) {
      if (employeeCell(sheetData[i], headers, 'employeeId') === employeeId) {
        var now = formatEmployeeTimestamp();
        var salt = createPinSalt();
        setEmployeeCell(sheet, i + 1, headers, 'pinCode', '');
        setEmployeeCell(sheet, i + 1, headers, 'pinHash', hashPinCode(newPin, salt));
        setEmployeeCell(sheet, i + 1, headers, 'pinSalt', salt);
        setEmployeeCell(sheet, i + 1, headers, 'failedAttempts', 0);
        setEmployeeCell(sheet, i + 1, headers, 'lockedUntil', '');
        setEmployeeCell(sheet, i + 1, headers, 'updatedAt', now);

        if (typeof logAction === 'function') {
          logAction(spreadsheetId, 'system', 'resetEmployeePin', 'employee', {
            targetType: 'employee',
            targetId: employeeId,
            afterJson: { employeeId: employeeId }
          });
        }

        return {
          success: true,
          message: 'PIN 已重設，請使用新 PIN 登入'
        };
      }
    }

    return {
      success: false,
      message: '找不到員工: ' + employeeId
    };

  } catch (e) {
    Logger.log('resetEmployeePin 錯誤: ' + e.toString());
    return {
      success: false,
      message: '重設 PIN 失敗'
    };
  }
}

function changeEmployeePin(spreadsheetId, data) {
  try {
    data = data || {};
    var employeeId = sanitizeEmployeeText(data.employeeId, 80);
    var currentPin = String(data.currentPin || '');
    var newPin = String(data.newPin || '');

    if (!employeeId) {
      return { success: false, message: '請重新登入後再修改 PIN' };
    }

    if (!isValidPinCode(currentPin)) {
      return { success: false, message: '目前 PIN 格式錯誤' };
    }

    if (!isValidPinCode(newPin)) {
      return { success: false, message: '新 PIN 必須為 4-6 位數字' };
    }

    if (currentPin === newPin) {
      return { success: false, message: '新 PIN 不可與目前 PIN 相同' };
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ensureEmployeeSheet(ss);
    var sheetData = sheet.getDataRange().getValues();
    var headers = ensureEmployeeHeaders(sheet, sheetData[0] || []);

    for (var i = 1; i < sheetData.length; i++) {
      var row = sheetData[i];
      if (employeeCell(row, headers, 'employeeId') !== employeeId) continue;

      if (!isEmployeeEnabled(row, headers)) {
        return { success: false, message: '帳號已停用' };
      }

      if (isEmployeeLocked(row, headers)) {
        return { success: false, message: '帳號暫時鎖定，請稍後再試' };
      }

      if (!verifyEmployeePin(row, headers, currentPin)) {
        recordFailedLogin(sheet, i + 1, row, headers);
        return { success: false, message: '目前 PIN 錯誤' };
      }

      var now = formatEmployeeTimestamp();
      var salt = createPinSalt();
      setEmployeeCell(sheet, i + 1, headers, 'pinCode', '');
      setEmployeeCell(sheet, i + 1, headers, 'pinHash', hashPinCode(newPin, salt));
      setEmployeeCell(sheet, i + 1, headers, 'pinSalt', salt);
      setEmployeeCell(sheet, i + 1, headers, 'failedAttempts', 0);
      setEmployeeCell(sheet, i + 1, headers, 'lockedUntil', '');
      setEmployeeCell(sheet, i + 1, headers, 'updatedAt', now);

      if (typeof logAction === 'function') {
        logAction(spreadsheetId, employeeId, 'changeEmployeePin', 'employee', {
          targetType: 'employee',
          targetId: employeeId,
          afterJson: { employeeId: employeeId }
        });
      }

      return {
        success: true,
        message: 'PIN 已更新，請使用新 PIN 登入'
      };
    }

    return { success: false, message: '找不到員工資料' };

  } catch (e) {
    Logger.log('changeEmployeePin 錯誤: ' + e.toString());
    return {
      success: false,
      message: '修改 PIN 失敗'
    };
  }
}

function getEmployees(spreadsheetId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('Employees');

    if (!sheet) {
      return [];
    }

    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return [];
    }

    var headers = getEmployeeHeaderMap(data[0] || []);
    var employees = [];

    for (var i = 1; i < data.length; i++) {
      employees.push({
        employeeId: employeeCell(data[i], headers, 'employeeId'),
        name: employeeCell(data[i], headers, 'name'),
        role: parseEmployeeRole(employeeCell(data[i], headers, 'role')),
        enabled: isEmployeeEnabled(data[i], headers),
        createdAt: employeeCell(data[i], headers, 'createdAt'),
        updatedAt: employeeCell(data[i], headers, 'updatedAt'),
        lastLogin: employeeCell(data[i], headers, 'lastLogin'),
        lockedUntil: employeeCell(data[i], headers, 'lockedUntil')
      });
    }

    return employees;

  } catch (e) {
    Logger.log('getEmployees 錯誤: ' + e.toString());
    return [];
  }
}

function getRoleName(role) {
  var roles = {
    1: 'admin',
    2: 'manager',
    3: 'staff'
  };
  return roles[role] || 'unknown';
}

function ensureEmployeeSheet(ss) {
  var sheet = ss.getSheetByName('Employees');
  if (!sheet) {
    sheet = ss.insertSheet('Employees');
    appendEmployeeRows(sheet, [EMPLOYEE_HEADERS]);
  }
  return sheet;
}

function ensureEmployeeHeaders(sheet, headerRow) {
  var headers = headerRow && headerRow.length ? headerRow.slice() : [];
  if (!headers[0]) {
    appendEmployeeRows(sheet, [EMPLOYEE_HEADERS]);
    headers = EMPLOYEE_HEADERS.slice();
  }

  for (var i = 0; i < EMPLOYEE_HEADERS.length; i++) {
    if (headers.indexOf(EMPLOYEE_HEADERS[i]) === -1) {
      headers.push(EMPLOYEE_HEADERS[i]);
      sheet.getRange(1, headers.length).setValue(EMPLOYEE_HEADERS[i]);
    }
  }

  return getEmployeeHeaderMap(headers);
}

function getEmployeeHeaderMap(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    map[String(headers[i])] = i;
  }
  return map;
}

function employeeCell(row, headers, columnName) {
  var index = headers[columnName];
  return index === undefined ? '' : row[index];
}

function setEmployeeCell(sheet, rowIndex, headers, columnName, value) {
  var index = headers[columnName];
  if (index === undefined) return;
  sheet.getRange(rowIndex, index + 1).setValue(value);
}

function buildEmployeeRow(headers, values) {
  var row = [];
  Object.keys(headers).forEach(function(columnName) {
    row[headers[columnName]] = values[columnName] === undefined ? '' : values[columnName];
  });
  return row;
}

function isEmployeeEnabled(row, headers) {
  var value = employeeCell(row, headers, 'enabled');
  if (value === '') return true;
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
}

function isEmployeeLocked(row, headers) {
  var lockedUntil = employeeCell(row, headers, 'lockedUntil');
  if (!lockedUntil) return false;
  return new Date(lockedUntil).getTime() > new Date().getTime();
}

function recordFailedLogin(sheet, rowIndex, row, headers) {
  var failedAttempts = parseInt(employeeCell(row, headers, 'failedAttempts')) || 0;
  failedAttempts += 1;
  setEmployeeCell(sheet, rowIndex, headers, 'failedAttempts', failedAttempts);

  if (failedAttempts >= EMPLOYEE_MAX_FAILED_ATTEMPTS) {
    var lockedUntil = new Date(new Date().getTime() + EMPLOYEE_LOCK_MINUTES * 60 * 1000);
    setEmployeeCell(sheet, rowIndex, headers, 'lockedUntil', Utilities.formatDate(lockedUntil, 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss'));
  }
}

function verifyEmployeePin(row, headers, pinCode) {
  var pinHash = employeeCell(row, headers, 'pinHash');
  var pinSalt = employeeCell(row, headers, 'pinSalt');
  if (pinHash && pinSalt) {
    return pinHash === hashPinCode(pinCode, pinSalt);
  }
  return String(employeeCell(row, headers, 'pinCode') || '') === pinCode;
}

function migratePlainPinIfNeeded(sheet, rowIndex, row, headers, pinCode) {
  if (employeeCell(row, headers, 'pinHash')) return;
  var salt = createPinSalt();
  setEmployeeCell(sheet, rowIndex, headers, 'pinCode', '');
  setEmployeeCell(sheet, rowIndex, headers, 'pinHash', hashPinCode(pinCode, salt));
  setEmployeeCell(sheet, rowIndex, headers, 'pinSalt', salt);
}

function hashPinCode(pinCode, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pinCode);
  var hex = [];
  for (var i = 0; i < bytes.length; i++) {
    var value = bytes[i];
    if (value < 0) value += 256;
    hex.push(('0' + value.toString(16)).slice(-2));
  }
  return hex.join('');
}

function createPinSalt() {
  return Utilities.getUuid ? Utilities.getUuid() : String(Math.random()).slice(2);
}

function isValidEmployeeResetToken(resetToken) {
  var token = sanitizeEmployeeText(resetToken, 120);
  if (!token) return false;

  try {
    var configuredToken = PropertiesService.getScriptProperties().getProperty('PIN_RESET_TOKEN');
    if (!configuredToken) {
      Logger.log('PIN_RESET_TOKEN 未設定，拒絕 PIN 重設請求');
      return false;
    }
    return token === configuredToken;
  } catch (e) {
    Logger.log('讀取 PIN_RESET_TOKEN 失敗: ' + e.toString());
    return false;
  }
}

function validateEmployeeInput(data, requirePin) {
  data = data || {};
  if ((requirePin || data.name !== undefined) && !sanitizeEmployeeText(data.name, 80)) {
    return { success: false, valid: false, message: '請輸入員工姓名' };
  }
  if (requirePin || data.pinCode) {
    if (!isValidPinCode(String(data.pinCode || ''))) {
      return { success: false, valid: false, message: 'PIN 碼必須為 4-6 位數字' };
    }
  }
  if (data.role !== undefined) {
    var role = parseEmployeeRole(data.role);
    if (role < 1 || role > 3) {
      return { success: false, valid: false, message: '員工角色無效' };
    }
  }
  return { success: true, valid: true };
}

function isValidPinCode(pinCode) {
  return /^\d{4,6}$/.test(String(pinCode || ''));
}

function parseEmployeeRole(role) {
  return parseInt(role, 10) || 3;
}

function sanitizeEmployeeText(value, maxLength) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, maxLength || 255);
}

function formatEmployeeTimestamp() {
  return Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
}

function appendEmployeeRows(sheet, rows) {
  if (typeof appendRows === 'function') {
    appendRows(sheet, rows);
    return;
  }
  var startRow = sheet.getLastRow ? sheet.getLastRow() + 1 : sheet.getDataRange().getValues().length + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}
