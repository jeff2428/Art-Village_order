/**
 * sheet-config.js
 * 系統設定存取模組
 * 職責：系統設定讀寫（營業時間、休假、公告）
 */

/**
 * 設定 Sheet 分頁定義
 * - "營業時間"：開始時間、結束時間
 * - "休假日期"：日期、原因

 * - "公告設定"：版位、內容、顯示開關
 */

/**
 * 讀取營業時間設定 (支援一週七天、多段時段)
 * 回傳格式: { "1": { enabled: true, slots: ["11:00-14:00", "17:00-21:00"] }, ... "0": {...} } (0是週日)
 */
function getBusinessHours(spreadsheetId, sheetName) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = getBusinessHoursSheet(ss, sheetName);
    
    // 預設一週七天的設定 (0=週日, 1=週一 ... 6=週六)
    var defaultSchedule = {};
    for (var i = 0; i < 7; i++) {
      defaultSchedule[i.toString()] = { enabled: true, slots: ["11:00-21:00"] };
    }
    
    if (!sheet) {
      return defaultSchedule;
    }
    
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return defaultSchedule;
    }

    var schedule = {};
    // 假設表頭: [星期(0-6), 是否營業(TRUE/FALSE), 時段(逗號分隔)]
    for (var i = 1; i < data.length; i++) {
      var dayStr = String(data[i][0]).trim();
      if (dayStr !== "") {
        var enabled = isConfigTruthy(data[i][1]);
        var slotsStr = String(data[i][2] || "").trim();
        var slots = slotsStr ? slotsStr.split(',').map(function(s){return s.trim();}) : [];
        schedule[dayStr] = { enabled: enabled, slots: slots };
      }
    }
    
    // 補齊沒設定的天數
    for (var i = 0; i < 7; i++) {
      if (!schedule[i.toString()]) {
        schedule[i.toString()] = defaultSchedule[i.toString()];
      }
    }
    
    return schedule;
    
  } catch (e) {
    Logger.log('getBusinessHours 錯誤: ' + e.toString());
    throw new Error('讀取營業時間失敗: ' + e.toString());
  }
}

function getBusinessHoursSheet(ss, sheetName) {
  if (sheetName) return ss.getSheetByName(sheetName);
  return ss.getSheetByName('BusinessHours') || ss.getSheetByName('營業時間');
}

/**
 * 更新營業時間設定 (一週七天)
 * @param {Object} scheduleData - 格式如上 getBusinessHours 回傳
 */
function updateBusinessHours(spreadsheetId, scheduleData, sheetName) {
  sheetName = sheetName || '營業時間';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    
    // 清空並重寫
    sheet.clear();
    var rows = [['星期(0=日,1=一...)', '是否營業', '營業時段(範例: 11:00-14:00,17:00-21:00)']];
    
    for (var i = 0; i < 7; i++) {
      var dayData = scheduleData[i.toString()] || { enabled: false, slots: [] };
      var slotsStr = dayData.slots.join(',');
      rows.push([i.toString(), dayData.enabled, slotsStr]);
    }
    appendConfigRows(sheet, rows);
    
    clearScheduleCache();
    
    return {
      success: true,
      message: '營業排程已更新'
    };
    
  } catch (e) {
    Logger.log('updateBusinessHours 錯誤: ' + e.toString());
    return {
      success: false,
      message: '更新營業時間失敗: ' + e.toString()
    };
  }
}

/**
 * 讀取所有休假日期
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} sheetName - 工作表名稱（預設為 "休假日期"）
 * @returns {Array<Object>} 休假日期陣列 [{ date: string, reason: string }]
 */
function getHolidays(spreadsheetId, sheetName) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = getHolidaysSheet(ss, sheetName);
    
    if (!sheet) {
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    var holidays = [];
    
    for (var i = 1; i < data.length; i++) {
      var enabled = data[i][2] === undefined || isConfigTruthy(data[i][2]);
      if (data[i][0] && enabled) {
        holidays.push({
          date: formatDate(data[i][0]),
          reason: data[i][1] || ''
        });
      }
    }
    
    return holidays;
    
  } catch (e) {
    Logger.log('getHolidays 錯誤: ' + e.toString());
    throw new Error('讀取休假日期失敗: ' + e.toString());
  }
}

function getHolidaysSheet(ss, sheetName) {
  if (sheetName) {
    return ss.getSheetByName(sheetName);
  }

  return ss.getSheetByName('Holidays') || ss.getSheetByName('休假日期');
}

/**
 * 新增休假日期
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} date - 日期 (yyyy-MM-dd)
 * @param {string} reason - 原因
 * @param {string} sheetName - 工作表名稱
 * @returns {Object} { success: boolean, message: string }
 */
function addHoliday(spreadsheetId, date, reason, sheetName) {
  sheetName = sheetName || '休假日期';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(['日期', '原因']);
    }
    
    sheet.appendRow([date, reason || '']);
    
    clearScheduleCache();
    
    return {
      success: true,
      message: '已新增休假日期: ' + date
    };
    
  } catch (e) {
    Logger.log('addHoliday 錯誤: ' + e.toString());
    return {
      success: false,
      message: '新增休假日期失敗: ' + e.toString()
    };
  }
}

/**
 * 刪除休假日期
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} date - 日期 (yyyy-MM-dd)
 * @param {string} sheetName - 工作表名稱
 * @returns {Object} { success: boolean, message: string }
 */
function removeHoliday(spreadsheetId, date, sheetName) {
  sheetName = sheetName || '休假日期';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return {
        success: false,
        message: '找不到工作表: ' + sheetName
      };
    }
    
    var data = sheet.getDataRange().getValues();
    
    for (var i = 1; i < data.length; i++) {
      if (formatDate(data[i][0]) === date) {
        sheet.deleteRow(i + 1);
        clearScheduleCache();
        return {
          success: true,
          message: '已刪除休假日期: ' + date
        };
      }
    }
    
    return {
      success: false,
      message: '找不到該休假日期: ' + date
    };
    
  } catch (e) {
    Logger.log('removeHoliday 錯誤: ' + e.toString());
    return {
      success: false,
      message: '刪除休假日期失敗: ' + e.toString()
    };
  }
}

/**
 * 讀取公告設定
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} sheetName - 工作表名稱（預設優先讀 "Announcements"，缺表時回退 "公告設定"）
 * @returns {Object} { header: { content, enabled }, popup: { content, enabled }, checkout: { content, enabled } }
 */
function getAnnouncements(spreadsheetId, sheetName) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = getAnnouncementSheet(ss, sheetName);
    
    if (!sheet) {
      return getDefaultAnnouncements();
    }
    
    var data = sheet.getDataRange().getValues();
    var announcements = getDefaultAnnouncements();
    
    for (var i = 1; i < data.length; i++) {
      var position = data[i][0];
      if (announcements[position]) {
        announcements[position].content = data[i][1] || '';
        announcements[position].enabled = data[i][2] === true || data[i][2] === 'TRUE';
      }
    }
    
    return announcements;
    
  } catch (e) {
    Logger.log('getAnnouncements 錯誤: ' + e.toString());
    throw new Error('讀取公告設定失敗: ' + e.toString());
  }
}

function getAnnouncementSheet(ss, sheetName) {
  if (sheetName) {
    return ss.getSheetByName(sheetName);
  }

  return ss.getSheetByName('Announcements') || ss.getSheetByName('公告設定');
}

function updateAnnouncement(spreadsheetId, position, content, enabled, sheetName) {
  try {
    var validPositions = ['header', 'popup', 'checkout'];
    if (validPositions.indexOf(position) === -1) {
      return {
        success: false,
        message: '無效的版位: ' + position + '（有效值: header, popup, checkout）'
      };
    }
    
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = getAnnouncementSheet(ss, sheetName);
    
    if (!sheet) {
      var defaultName = sheetName || '公告設定';
      // 如果插入失敗可能是因為名稱有空白等問題，先嘗試找出所有 sheet 名稱比對
      var allSheets = ss.getSheets();
      for (var i=0; i<allSheets.length; i++) {
         if (allSheets[i].getName().trim() === defaultName) {
             sheet = allSheets[i];
             break;
         }
      }
      
      if (!sheet) {
        sheet = ss.insertSheet(defaultName);
        sheet.appendRow(['版位', '內容', '顯示開關']);
      }
    }
    
    var data = sheet.getDataRange().getValues();
    var found = false;
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === position) {
        sheet.getRange(i + 1, 2).setValue(content);
        sheet.getRange(i + 1, 3).setValue(enabled);
        found = true;
        break;
      }
    }
    
    if (!found) {
      sheet.appendRow([position, content, enabled]);
    }
    
    clearAnnouncementCache();
    
    return {
      success: true,
      message: '已更新公告: ' + position
    };
    
  } catch (e) {
    Logger.log('updateAnnouncement 錯誤: ' + e.toString());
    return {
      success: false,
      message: '更新公告失敗: ' + e.toString()
    };
  }
}

/**
 * 取得預設公告設定
 * @returns {Object} 預設公告物件
 */
function getDefaultAnnouncements() {
  return {
    header: { content: '', enabled: false },
    popup: { content: '', enabled: false },
    checkout: { content: '訂單送出後不可修改或取消，如需調整請致電或透過官方 LINE 聯繫。', enabled: true }
  };
}

function isConfigTruthy(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
}

/**
 * 驗證時間格式 (HH:mm)
 * @param {string} timeStr - 時間字串
 * @returns {boolean} 是否有效
 */
function isValidTimeFormat(timeStr) {
  if (!timeStr) return false;
  var regex = /^([01]\d|2[0-3]):[0-5]\d$/;
  return regex.test(timeStr);
}

/**
 * 格式化日期為 yyyy-MM-dd
 * @param {Date|string} date - 日期物件或字串
 * @returns {string} 格式化後的日期字串
 */
function formatDate(date) {
  if (!date) return '';
  
  if (typeof date === 'string') {
    return date;
  }
  
  return Utilities.formatDate(date, 'Asia/Taipei', 'yyyy-MM-dd');
}

function appendConfigRows(sheet, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}
