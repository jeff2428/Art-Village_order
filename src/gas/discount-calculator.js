/**
 * discount-calculator.js
 * 折扣計算模組
 * 職責：讀取折扣設定、計算符合條件的折扣、回傳折扣明細
 */

/**
 * 讀取所有啟用的折扣設定
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @returns {Array<Object>} 折扣設定陣列
 */
function getDiscounts(spreadsheetId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('Discounts');
    
    if (!sheet) {
      return [];
    }
    
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    var discounts = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (row[10] === true || row[10] === 'TRUE') {
        discounts.push({
          discountId: row[0],
          name: row[1],
          type: row[2],
          value: row[3],
          minAmount: row[4] || 0,
          applicableItems: parseJsonSafe(row[5]),
          timeStart: row[6],
          timeEnd: row[7],
          dateStart: row[8],
          dateEnd: row[9],
          enabled: true,
          priority: row[11] || 999
        });
      }
    }
    
    discounts.sort(function(a, b) { return a.priority - b.priority; });
    
    return discounts;
    
  } catch (e) {
    Logger.log('getDiscounts 錯誤: ' + e.toString());
    return [];
  }
}

/**
 * 計算訂單折扣
 * @param {Object} orderData - 訂單資料
 * @param {Array<Object>} discounts - 折扣設定陣列
 * @returns {Object} 折扣結果 { appliedDiscounts: [], originalTotal: number, discountTotal: number, finalTotal: number }
 */
function calculateOrderDiscount(orderData, discounts) {
  var items = orderData.items || [];
  var originalTotal = 0;
  
  for (var i = 0; i < items.length; i++) {
    originalTotal += (parseFloat(items[i].price) || 0) * (parseInt(items[i].quantity) || 1);
  }
  
  var now = new Date();
  var currentTime = Utilities.formatDate(now, 'Asia/Taipei', 'HH:mm');
  var currentDate = Utilities.formatDate(now, 'Asia/Taipei', 'yyyy-MM-dd');
  
  var appliedDiscounts = [];
  var discountTotal = 0;
  
  for (var j = 0; j < discounts.length; j++) {
    var discount = discounts[j];
    
    if (!isDiscountApplicable(discount, orderData, items, currentTime, currentDate)) {
      continue;
    }
    
    var discountAmount = calculateDiscountAmount(discount, orderData, items, originalTotal);
    
    if (discountAmount > 0) {
      appliedDiscounts.push({
        discountId: discount.discountId,
        name: discount.name,
        type: discount.type,
        amount: discountAmount
      });
      discountTotal += discountAmount;
      
      if (discount.type === 'order_percent' || discount.type === 'order_fixed' || discount.type === 'min_amount') {
        break;
      }
    }
  }
  
  var finalTotal = Math.max(0, originalTotal - discountTotal);
  
  return {
    appliedDiscounts: appliedDiscounts,
    originalTotal: originalTotal,
    discountTotal: discountTotal,
    finalTotal: finalTotal
  };
}

/**
 * 判斷折扣是否適用
 * @param {Object} discount - 折扣設定
 * @param {Object} orderData - 訂單資料
 * @param {Array} items - 訂單品項
 * @param {string} currentTime - 目前時間 HH:mm
 * @param {string} currentDate - 目前日期 yyyy-MM-dd
 * @returns {boolean} 是否適用
 */
function isDiscountApplicable(discount, orderData, items, currentTime, currentDate) {
  if (discount.minAmount > 0) {
    var orderTotal = 0;
    for (var i = 0; i < items.length; i++) {
      orderTotal += (parseFloat(items[i].price) || 0) * (parseInt(items[i].quantity) || 1);
    }
    if (orderTotal < discount.minAmount) {
      return false;
    }
  }
  
  if (discount.timeStart && currentTime < discount.timeStart) {
    return false;
  }
  if (discount.timeEnd && currentTime > discount.timeEnd) {
    return false;
  }
  
  if (discount.dateStart && currentDate < discount.dateStart) {
    return false;
  }
  if (discount.dateEnd && currentDate > discount.dateEnd) {
    return false;
  }
  
  if (discount.applicableItems && discount.applicableItems !== '*' && Array.isArray(discount.applicableItems)) {
    var itemNames = items.map(function(item) { return item.name; });
    var hasApplicableItem = false;
    for (var j = 0; j < discount.applicableItems.length; j++) {
      if (itemNames.indexOf(discount.applicableItems[j]) !== -1) {
        hasApplicableItem = true;
        break;
      }
    }
    if (!hasApplicableItem) {
      return false;
    }
  }
  
  return true;
}

/**
 * 計算折扣金額
 * @param {Object} discount - 折扣設定
 * @param {Object} orderData - 訂單資料
 * @param {Array} items - 訂單品項
 * @param {number} originalTotal - 原始總額
 * @returns {number} 折扣金額
 */
function calculateDiscountAmount(discount, orderData, items, originalTotal) {
  switch (discount.type) {
    case 'order_percent':
      return Math.round(originalTotal * (discount.value / 100));
      
    case 'order_fixed':
      return Math.min(discount.value, originalTotal);
      
    case 'item_percent':
      var itemDiscount = 0;
      for (var i = 0; i < items.length; i++) {
        if (discount.applicableItems === '*' || discount.applicableItems.indexOf(items[i].name) !== -1) {
          itemDiscount += (parseFloat(items[i].price) || 0) * (parseInt(items[i].quantity) || 1) * (discount.value / 100);
        }
      }
      return Math.round(itemDiscount);
      
    case 'item_fixed':
      var fixedDiscount = 0;
      for (var j = 0; j < items.length; j++) {
        if (discount.applicableItems === '*' || discount.applicableItems.indexOf(items[j].name) !== -1) {
          fixedDiscount += discount.value * (parseInt(items[j].quantity) || 1);
        }
      }
      return Math.min(fixedDiscount, originalTotal);
      
    case 'min_amount':
      return discount.value;
      
    case 'time_period':
      return Math.round(originalTotal * (discount.value / 100));
      
    default:
      return 0;
  }
}

/**
 * 安全解析 JSON
 * @param {string} jsonStr - JSON 字串
 * @returns {Array|string} 解析結果
 */
function parseJsonSafe(jsonStr) {
  if (!jsonStr || jsonStr === '') return null;
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    return jsonStr;
  }
}

/**
 * 新增折扣設定
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {Object} data - 折扣資料
 * @returns {Object} 操作結果
 */
function addDiscount(spreadsheetId, data) {
  try {
    if (typeof validateDiscountData === 'function') {
      var validation = validateDiscountData(data);
      if (!validation.valid) {
        return { success: false, message: validation.message };
      }
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ensureSheet(ss, 'Discounts', [
      'discountId', 'name', 'type', 'value', 'minAmount',
      'applicableItems', 'timeStart', 'timeEnd', 'dateStart', 'dateEnd',
      'enabled', 'priority'
    ]);
    
    var discountId = 'DISC-' + Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd-HHmmss');
    
    var applicableItemsJson = Array.isArray(data.applicableItems)
      ? JSON.stringify(data.applicableItems)
      : (data.applicableItems || '*');
    
    sheet.appendRow([
      discountId,
      data.name || '',
      data.type || 'order_percent',
      data.value || 0,
      data.minAmount || 0,
      applicableItemsJson,
      data.timeStart || '',
      data.timeEnd || '',
      data.dateStart || '',
      data.dateEnd || '',
      data.enabled !== false,
      data.priority || 999
    ]);
    
    return {
      success: true,
      message: '已新增折扣: ' + data.name,
      discountId: discountId
    };
    
  } catch (e) {
    Logger.log('addDiscount 錯誤: ' + e.toString());
    return {
      success: false,
      message: '新增折扣失敗'
    };
  }
}

/**
 * 更新折扣設定
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {Object} data - 折扣資料（需包含 discountId）
 * @returns {Object} 操作結果
 */
function updateDiscount(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('Discounts');
    
    if (!sheet) {
      return {
        success: false,
        message: '找不到 Discounts 工作表'
      };
    }
    
    var sheetData = sheet.getDataRange().getValues();
    
    for (var i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] === data.discountId) {
        var applicableItemsJson = Array.isArray(data.applicableItems)
          ? JSON.stringify(data.applicableItems)
          : (data.applicableItems || sheetData[i][5]);
        
        sheet.getRange(i + 1, 2).setValue(data.name !== undefined ? data.name : sheetData[i][1]);
        sheet.getRange(i + 1, 3).setValue(data.type !== undefined ? data.type : sheetData[i][2]);
        sheet.getRange(i + 1, 4).setValue(data.value !== undefined ? data.value : sheetData[i][3]);
        sheet.getRange(i + 1, 5).setValue(data.minAmount !== undefined ? data.minAmount : sheetData[i][4]);
        sheet.getRange(i + 1, 6).setValue(applicableItemsJson);
        sheet.getRange(i + 1, 7).setValue(data.timeStart !== undefined ? data.timeStart : sheetData[i][6]);
        sheet.getRange(i + 1, 8).setValue(data.timeEnd !== undefined ? data.timeEnd : sheetData[i][7]);
        sheet.getRange(i + 1, 9).setValue(data.dateStart !== undefined ? data.dateStart : sheetData[i][8]);
        sheet.getRange(i + 1, 10).setValue(data.dateEnd !== undefined ? data.dateEnd : sheetData[i][9]);
        sheet.getRange(i + 1, 11).setValue(data.enabled !== undefined ? data.enabled : sheetData[i][10]);
        sheet.getRange(i + 1, 12).setValue(data.priority !== undefined ? data.priority : sheetData[i][11]);
        
        return {
          success: true,
          message: '已更新折扣: ' + (data.name || sheetData[i][1])
        };
      }
    }
    
    return {
      success: false,
      message: '找不到折扣: ' + data.discountId
    };
    
  } catch (e) {
    Logger.log('updateDiscount 錯誤: ' + e.toString());
    return {
      success: false,
      message: '更新折扣失敗: ' + e.toString()
    };
  }
}

/**
 * 刪除/停用折扣
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {Object} data - { discountId: string }
 * @returns {Object} 操作結果
 */
function deleteDiscount(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('Discounts');
    
    if (!sheet) {
      return {
        success: false,
        message: '找不到 Discounts 工作表'
      };
    }
    
    var sheetData = sheet.getDataRange().getValues();
    
    for (var i = 1; i < sheetData.length; i++) {
      if (sheetData[i][0] === data.discountId) {
        sheet.getRange(i + 1, 11).setValue(false);
        
        return {
          success: true,
          message: '已停用折扣: ' + sheetData[i][1]
        };
      }
    }
    
    return {
      success: false,
      message: '找不到折扣: ' + data.discountId
    };
    
  } catch (e) {
    Logger.log('deleteDiscount 錯誤: ' + e.toString());
    return {
      success: false,
      message: '停用折扣失敗: ' + e.toString()
    };
  }
}
