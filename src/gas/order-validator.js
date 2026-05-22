/**
 * order-validator.js
 * 訂單驗證模組
 * 職責：驗證訂單時限（營業結束前 1 小時截止）、營業日檢查
 */

/**
 * 驗證訂單資料
 * @param {Object} orderData - 訂單資料
 * @returns {Object} { valid: boolean, message: string }
 */
function validateOrder(orderData) {
  try {
    var spreadsheetId = getSpreadsheetId();
    
    var requiredFields = ['liffUserId', 'customerName', 'phone', 'guestCount', 'diningDate', 'diningTime', 'items'];
    
    for (var i = 0; i < requiredFields.length; i++) {
      var field = requiredFields[i];
      if (!orderData[field] || (typeof orderData[field] === 'string' && orderData[field].trim() === '') || (Array.isArray(orderData[field]) && orderData[field].length === 0)) {
        return {
          valid: false,
          message: '缺少必要欄位: ' + field
        };
      }
    }
    
    var phoneRegex = /^09\d{8}$/;
    if (!phoneRegex.test(orderData.phone.replace(/-/g, ''))) {
      return {
        valid: false,
        message: '電話號碼格式無效，請使用 09xxxxxxxx 格式'
      };
    }
    
    if (parseInt(orderData.guestCount) < 1) {
      return {
        valid: false,
        message: '人數必須至少為 1 人'
      };
    }

    var itemValidation = validateOrderItems(orderData.items);
    if (!itemValidation.valid) {
      return itemValidation;
    }

    if (!isValidDateString(orderData.diningDate)) {
      return {
        valid: false,
        message: '用餐日期格式無效'
      };
    }

    if (!isValidTimeString(orderData.diningTime)) {
      return {
        valid: false,
        message: '用餐時間格式無效'
      };
    }
    
    var diningDate = new Date(orderData.diningDate);
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (diningDate < today) {
      return {
        valid: false,
        message: '用餐日期不可為過去日期'
      };
    }
    
    var isBusinessDay = checkBusinessDay(spreadsheetId, orderData.diningDate);
    if (!isBusinessDay.valid) {
      return isBusinessDay;
    }
    
    var isWithinOrderTime = checkOrderTimeLimit(spreadsheetId, orderData.diningDate, orderData.diningTime);
    if (!isWithinOrderTime.valid) {
      return isWithinOrderTime;
    }
    
    return {
      valid: true,
      message: '訂單驗證通過'
    };
    
  } catch (e) {
    Logger.log('validateOrder 錯誤: ' + e.toString());
    return {
      valid: false,
      message: '訂單驗證失敗: ' + e.toString()
    };
  }
}

/**
 * 檢查指定日期是否為營業日
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {string} dateStr - 日期字串 (yyyy-MM-dd)
 * @returns {Object} { valid: boolean, message: string }
 */
function checkBusinessDay(spreadsheetId, dateStr) {
  try {
    var holidays = getHolidays(spreadsheetId);
    
    for (var i = 0; i < holidays.length; i++) {
      if (holidays[i].date === dateStr) {
        return {
          valid: false,
          message: '該日期為休假日: ' + dateStr + (holidays[i].reason ? '（' + holidays[i].reason + '）' : '')
        };
      }
    }
    
    return {
      valid: true,
      message: '該日期為營業日'
    };
    
  } catch (e) {
    Logger.log('checkBusinessDay 錯誤: ' + e.toString());
    return {
      valid: false,
      message: '檢查營業日失敗: ' + e.toString()
    };
  }
}

/**
 * 檢查是否在可點餐時間範圍內
 * 規則：當日訂單需在營業結束前 1 小時前送出
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {string} dateStr - 用餐日期 (yyyy-MM-dd)
 * @param {string} timeStr - 用餐時間 (HH:mm)
 * @returns {Object} { valid: boolean, message: string }
 */
function checkOrderTimeLimit(spreadsheetId, dateStr, timeStr) {
  try {
    var businessHours = getBusinessHours(spreadsheetId);
    var daySchedule = getScheduleForDate(businessHours, dateStr);

    if (!daySchedule.enabled || daySchedule.slots.length === 0) {
      return {
        valid: false,
        message: '該日期未營業，請選擇其他日期'
      };
    }

    var diningMinutes = timeToMinutes(timeStr);

    if (!isTimeWithinSlots(diningMinutes, daySchedule.slots)) {
      return {
        valid: false,
        message: '用餐時間不在營業時間內'
      };
    }

    var closeMinutes = getCloseMinutesForTime(diningMinutes, daySchedule.slots);
    var cutoffMinutes = closeMinutes - 60;
    var cutoffTime = minutesToTime(cutoffMinutes);
    
    var today = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd');
    
    if (dateStr === today) {
      var currentTime = Utilities.formatDate(new Date(), 'Asia/Taipei', 'HH:mm');
      
      if (timeToMinutes(currentTime) > cutoffMinutes) {
        return {
          valid: false,
          message: '已超過今日點餐截止時間（' + cutoffTime + '），請預約其他日期'
        };
      }
    }
    
    return {
      valid: true,
      message: '點餐時間驗證通過'
    };
    
  } catch (e) {
    Logger.log('checkOrderTimeLimit 錯誤: ' + e.toString());
    return {
      valid: false,
      message: '檢查點餐時間失敗: ' + e.toString()
    };
  }
}

function validateOrderItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return {
      valid: false,
      message: '缺少必要欄位: items'
    };
  }

  for (var i = 0; i < items.length; i++) {
    var item = items[i] || {};
    if (!String(item.name || '').trim()) {
      return {
        valid: false,
        message: '餐點名稱不可空白'
      };
    }

    var quantity = parseInt(item.quantity);
    if (!isFinite(quantity) || quantity < 1) {
      return {
        valid: false,
        message: '餐點數量必須至少為 1'
      };
    }

    var price = parseFloat(item.price);
    if (!isFinite(price) || price < 0) {
      return {
        valid: false,
        message: '餐點價格不可為負數'
      };
    }
  }

  return {
    valid: true,
    message: '餐點驗證通過'
  };
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  var parts = String(value).split('-');
  var year = parseInt(parts[0], 10);
  var month = parseInt(parts[1], 10);
  var day = parseInt(parts[2], 10);
  var date = new Date(year, month - 1, day);

  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

function isValidTimeString(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ''));
}

function getScheduleForDate(businessHours, dateStr) {
  if (businessHours && businessHours.openTime && businessHours.closeTime) {
    return {
      enabled: true,
      slots: [businessHours.openTime + '-' + businessHours.closeTime]
    };
  }

  var dayOfWeek = getDayOfWeek(dateStr).toString();
  var daySchedule = businessHours && businessHours[dayOfWeek];

  if (!daySchedule) {
    return {
      enabled: false,
      slots: []
    };
  }

  return {
    enabled: daySchedule.enabled === true,
    slots: Array.isArray(daySchedule.slots) ? daySchedule.slots : []
  };
}

function getDayOfWeek(dateStr) {
  var parts = String(dateStr).split('-');
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getDay();
}

function timeToMinutes(timeStr) {
  var parts = String(timeStr).split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function minutesToTime(totalMinutes) {
  var safeMinutes = Math.max(0, totalMinutes);
  var hours = Math.floor(safeMinutes / 60);
  var minutes = safeMinutes % 60;
  return hours.toString().padStart(2, '0') + ':' + minutes.toString().padStart(2, '0');
}

function isTimeWithinSlots(targetMinutes, slots) {
  for (var i = 0; i < slots.length; i++) {
    var range = parseSlotRange(slots[i]);
    if (range && targetMinutes >= range.start && targetMinutes <= range.end) {
      return true;
    }
  }
  return false;
}

function getLatestCloseMinutes(slots) {
  var latest = 0;
  for (var i = 0; i < slots.length; i++) {
    var range = parseSlotRange(slots[i]);
    if (range && range.end > latest) {
      latest = range.end;
    }
  }
  return latest;
}

function getCloseMinutesForTime(targetMinutes, slots) {
  for (var i = 0; i < slots.length; i++) {
    var range = parseSlotRange(slots[i]);
    if (range && targetMinutes >= range.start && targetMinutes <= range.end) {
      return range.end;
    }
  }
  return getLatestCloseMinutes(slots);
}

function parseSlotRange(slot) {
  var parts = String(slot || '').split('-');
  if (parts.length !== 2 || !isValidTimeString(parts[0]) || !isValidTimeString(parts[1])) {
    return null;
  }
  return {
    start: timeToMinutes(parts[0]),
    end: timeToMinutes(parts[1])
  };
}
