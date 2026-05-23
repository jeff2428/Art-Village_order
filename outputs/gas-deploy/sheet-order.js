/**
 * sheet-order.js
 * 訂單資料存取模組
 * 職責：訂單資料寫入與查詢（預約資訊、餐點明細、客製化細節）
 */

/**
 * 訂單 Sheet 欄位定義
 * A: 訂單編號 (orderId)
 * B: 時間戳記 (timestamp)
 * C: 訂位人姓名 (customerName)
 * D: 聯絡電話 (phone)
 * E: 人數 (guestCount)
 * F: 用餐日期 (diningDate)
 * G: 用餐時間 (diningTime)
 * H: 餐點明細 (orderItems) - JSON 格式
 * I: 客製化細節 (customizationDetails) - 可讀字串
 * J: LIFF userId (liffUserId)
 * K: 訂單狀態 (status) - pending/confirmed/cancelled
 */

/**
 * 產生訂單編號
 * 格式：YYYYMMDD-HHMMSS-隨機4碼
 * @returns {string} 訂單編號
 */
function generateOrderId() {
  var now = new Date();
  var dateStr = Utilities.formatDate(now, 'Asia/Taipei', 'yyyyMMdd-HHmmss');
  var random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return dateStr + '-' + random;
}

/**
 * 將訂單資料寫入 Google Sheets
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {Object} orderData - 訂單資料物件
 * @param {string} sheetName - 工作表名稱（預設為 "訂單"）
 * @returns {Object} { success: boolean, orderId: string, message: string }
 */
function writeOrder(spreadsheetId, orderData, sheetName) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    if (!sheetName) {
      return writeNormalizedOrder(ss, orderData);
    }

    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error('找不到工作表: ' + sheetName);
    }
    
    var orderId = generateOrderId();
    var timestamp = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
    
    var orderItemsStr = JSON.stringify(orderData.items || []);
    var customizationStr = formatCustomizationDetails(orderData.items || []);
    
    var rowData = [
      orderId,
      timestamp,
      orderData.customerName || '',
      orderData.phone || '',
      orderData.guestCount || 0,
      orderData.diningDate || '',
      orderData.diningTime || '',
      orderItemsStr,
      customizationStr,
      orderData.liffUserId || '',
      'pending'
    ];
    
    appendRows(sheet, [rowData]);
    
    return {
      success: true,
      orderId: orderId,
      timestamp: timestamp,
      message: '訂單已成功建立'
    };
    
  } catch (e) {
    Logger.log('writeOrder 錯誤: ' + e.toString());
    return {
      success: false,
      orderId: '',
      message: '訂單寫入失敗: ' + e.toString()
    };
  }
}

function writeNormalizedOrder(ss, orderData) {
  var ordersSheet = ensureSheet(ss, 'Orders', [
    'orderId', 'timestamp', 'liffUserId', 'customerName', 'phone',
    'guestCount', 'diningDate', 'diningTime', 'totalAmount', 'status'
  ]);
  var orderItemsSheet = ensureSheet(ss, 'OrderItems', [
    'orderId', 'itemName', 'quantity', 'unitPrice', 'customizationText', 'lineTotal'
  ]);
  var orderId = generateOrderId();
  var timestamp = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyy-MM-dd HH:mm:ss');
  var items = orderData.items || [];
  var totalAmount = orderData.totalAmount;

  if (totalAmount === undefined) {
    totalAmount = 0;
    for (var i = 0; i < items.length; i++) {
      totalAmount += (parseFloat(items[i].price) || 0) * (parseInt(items[i].quantity) || 1);
    }
  }

  appendRows(ordersSheet, [[
    orderId,
    timestamp,
    orderData.liffUserId || '',
    orderData.customerName || '',
    orderData.phone || '',
    orderData.guestCount || 0,
    orderData.diningDate || '',
    orderData.diningTime || '',
    totalAmount,
    'pending'
  ]]);

  var itemRows = [];
  for (var j = 0; j < items.length; j++) {
    var item = items[j];
    var quantity = parseInt(item.quantity) || 1;
    var unitPrice = parseFloat(item.price) || 0;
    var lineTotal = item.lineTotal !== undefined ? item.lineTotal : quantity * unitPrice;
    itemRows.push([
      orderId,
      item.name || '',
      quantity,
      unitPrice,
      formatItemCustomizations(item.customizations || []),
      lineTotal
    ]);
  }
  appendRows(orderItemsSheet, itemRows);

  return {
    success: true,
    orderId: orderId,
    timestamp: timestamp,
    message: '訂單已成功建立'
  };
}

function ensureSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }

  var data = sheet.getDataRange().getValues();
  if (data.length === 0 || !data[0] || !data[0][0]) {
    appendRows(sheet, [headers]);
  }

  return sheet;
}

function appendRows(sheet, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

/**
 * 格式化客製化細節為可讀字串
 * @param {Array<Object>} items - 餐點項目陣列
 * @returns {string} 格式化後的字串
 */
function formatCustomizationDetails(items) {
  var details = [];
  
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.customizations && item.customizations.length > 0) {
      var itemDetail = item.name + ': ';
      var opts = [];
      
      for (var j = 0; j < item.customizations.length; j++) {
        var opt = item.customizations[j];
        opts.push(opt.optionName + '=' + opt.selectedValue);
      }
      
      details.push(itemDetail + opts.join(' / '));
    }
  }
  
  return details.join('; ');
}

function formatItemCustomizations(customizations) {
  var values = [];

  for (var i = 0; i < customizations.length; i++) {
    values.push(customizations[i].optionName + ': ' + customizations[i].selectedValue);
  }

  return values.join(' / ');
}

/**
 * 讀取所有訂單紀錄
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} sheetName - 工作表名稱
 * @returns {Array<Object>} 訂單資料陣列
 */
function readAllOrders(spreadsheetId, sheetName) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    if (!sheetName && ss.getSheetByName('Orders')) {
      return readNormalizedOrders(ss);
    }

    sheetName = sheetName || '訂單';
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error('找不到工作表: ' + sheetName);
    }
    
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    var orders = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      orders.push({
        orderId: row[0],
        timestamp: row[1],
        customerName: row[2],
        phone: row[3],
        guestCount: row[4],
        diningDate: row[5],
        diningTime: row[6],
        orderItems: parseOrderItems(row[7]),
        customizationDetails: row[8],
        liffUserId: row[9],
        status: row[10]
      });
    }
    
    return orders;
    
  } catch (e) {
    Logger.log('readAllOrders 錯誤: ' + e.toString());
    throw new Error('讀取訂單失敗: ' + e.toString());
  }
}

function readNormalizedOrders(ss) {
  var ordersSheet = ss.getSheetByName('Orders');
  var orderItemsSheet = ss.getSheetByName('OrderItems');
  var orderRows = ordersSheet.getDataRange().getValues();
  var itemRows = orderItemsSheet ? orderItemsSheet.getDataRange().getValues() : [];
  var itemsByOrderId = {};
  var orders = [];

  for (var i = 1; i < itemRows.length; i++) {
    var itemRow = itemRows[i];
    var orderId = itemRow[0];
    if (!itemsByOrderId[orderId]) itemsByOrderId[orderId] = [];
    itemsByOrderId[orderId].push({
      name: itemRow[1],
      quantity: itemRow[2],
      price: itemRow[3],
      customizationDetails: itemRow[4],
      lineTotal: itemRow[5]
    });
  }

  for (var j = 1; j < orderRows.length; j++) {
    var row = orderRows[j];
    orders.push({
      orderId: row[0],
      timestamp: row[1],
      liffUserId: row[2],
      customerName: row[3],
      phone: row[4],
      guestCount: row[5],
      diningDate: row[6],
      diningTime: row[7],
      totalAmount: row[8],
      status: row[9],
      orderItems: itemsByOrderId[row[0]] || []
    });
  }

  return orders;
}

/**
 * 依日期範圍過濾訂單
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} startDate - 開始日期 (yyyy-MM-dd)
 * @param {string} endDate - 結束日期 (yyyy-MM-dd)
 * @param {string} sheetName - 工作表名稱
 * @returns {Array<Object>} 過濾後的訂單
 */
function getOrdersByDateRange(spreadsheetId, startDate, endDate, sheetName) {
  sheetName = sheetName || '訂單';
  
  try {
    var orders = readAllOrders(spreadsheetId, sheetName);
    var filtered = [];
    
    var start = new Date(startDate);
    var end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    
    for (var i = 0; i < orders.length; i++) {
      var orderDate = new Date(orders[i].diningDate);
      if (orderDate >= start && orderDate <= end) {
        filtered.push(orders[i]);
      }
    }
    
    return filtered;
    
  } catch (e) {
    Logger.log('getOrdersByDateRange 錯誤: ' + e.toString());
    throw new Error('依日期過濾訂單失敗: ' + e.toString());
  }
}

/**
 * 依訂單編號查詢訂單
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} orderId - 訂單編號
 * @param {string} sheetName - 工作表名稱
 * @returns {Object|null} 訂單資料或 null
 */
function getOrderByOrderId(spreadsheetId, orderId, sheetName) {
  sheetName = sheetName || '訂單';
  
  try {
    var orders = readAllOrders(spreadsheetId, sheetName);
    
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].orderId === orderId) {
        return orders[i];
      }
    }
    
    return null;
    
  } catch (e) {
    Logger.log('getOrderByOrderId 錯誤: ' + e.toString());
    throw new Error('查詢訂單失敗: ' + e.toString());
  }
}

/**
 * 解析訂單項目 JSON
 * @param {string} jsonStr - JSON 字串
 * @returns {Array<Object>} 訂單項目陣列
 */
function parseOrderItems(jsonStr) {
  if (!jsonStr || jsonStr === '') {
    return [];
  }
  
  try {
    var parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (e) {
    Logger.log('parseOrderItems 解析失敗: ' + jsonStr);
    return [];
  }
}

/**
 * 更新訂單狀態（支援狀態轉換驗證 + LINE 推播）
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} orderId - 訂單編號
 * @param {string} newStatus - 新狀態
 * @param {string} sheetName - 工作表名稱
 * @returns {Object} { success: boolean, message: string }
 */
function updateOrderStatus(spreadsheetId, orderId, newStatus, sheetName) {
  sheetName = sheetName || 'Orders';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error('找不到工作表: ' + sheetName);
    }
    
    var data = sheet.getDataRange().getValues();
    var headerRow = data[0];
    var statusColIndex = findColumnIndex(headerRow, 'status');
    var customerNameColIndex = findColumnIndex(headerRow, 'customerName');
    var diningDateColIndex = findColumnIndex(headerRow, 'diningDate');
    var diningTimeColIndex = findColumnIndex(headerRow, 'diningTime');
    
    if (statusColIndex === -1) {
      throw new Error('找不到 status 欄位');
    }
    
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === orderId) {
        var currentStatus = data[i][statusColIndex];
        
        if (!isValidStatusTransition(currentStatus, newStatus)) {
          return {
            success: false,
            message: '不允許的狀態轉換: ' + currentStatus + ' → ' + newStatus
          };
        }
        
        sheet.getRange(i + 1, statusColIndex + 1).setValue(newStatus);
        
        var customerName = customerNameColIndex !== -1 ? data[i][customerNameColIndex] : '';
        var diningDate = diningDateColIndex !== -1 ? data[i][diningDateColIndex] : '';
        var diningTime = diningTimeColIndex !== -1 ? data[i][diningTimeColIndex] : '';
        
        try {
          sendOrderStatusNotification(orderId, customerName, diningDate, diningTime, currentStatus, newStatus);
        } catch (notifyErr) {
          Logger.log('LINE 狀態推播失敗（狀態已更新）: ' + notifyErr.toString());
        }
        
        return {
          success: true,
          message: '訂單狀態已更新為: ' + getStatusLabel(newStatus)
        };
      }
    }
    
    return {
      success: false,
      message: '找不到訂單: ' + orderId
    };
    
  } catch (e) {
    Logger.log('updateOrderStatus 錯誤: ' + e.toString());
    return {
      success: false,
      message: '更新訂單狀態失敗: ' + e.toString()
    };
  }
}

/**
 * 驗證狀態轉換是否合法
 * @param {string} currentStatus - 目前狀態
 * @param {string} newStatus - 新狀態
 * @returns {boolean} 是否允許轉換
 */
function isValidStatusTransition(currentStatus, newStatus) {
  var validTransitions = {
    'pending': ['confirmed', 'cancelled'],
    'confirmed': ['completed', 'cancelled'],
    'completed': [],
    'cancelled': []
  };
  
  var allowed = validTransitions[currentStatus] || [];
  return allowed.indexOf(newStatus) !== -1;
}

/**
 * 取得狀態顯示標籤
 * @param {string} status - 狀態代碼
 * @returns {string} 顯示標籤
 */
function getStatusLabel(status) {
  var labels = {
    'pending': '已成立',
    'confirmed': '已接單',
    'completed': '已完成',
    'cancelled': '已取消'
  };
  return labels[status] || status;
}

/**
 * 發送訂單狀態變更通知
 * @param {string} orderId - 訂單編號
 * @param {string} customerName - 顧客姓名
 * @param {string} diningDate - 用餐日期
 * @param {string} diningTime - 用餐時間
 * @param {string} oldStatus - 舊狀態
 * @param {string} newStatus - 新狀態
 */
function sendOrderStatusNotification(orderId, customerName, diningDate, diningTime, oldStatus, newStatus) {
  var emoji = {
    'confirmed': '✅',
    'completed': '🎉',
    'cancelled': '❌'
  };
  
  var emojiChar = emoji[newStatus] || '📢';
  
  var message = emojiChar + ' 訂單狀態更新\n';
  message += '━━━━━━━━━━━━━━━\n';
  message += '📋 訂單編號: ' + orderId + '\n';
  message += '👤 訂位人: ' + customerName + '\n';
  message += '📅 用餐時間: ' + diningDate + ' ' + diningTime + '\n';
  message += '狀態: ' + getStatusLabel(oldStatus) + ' → ' + getStatusLabel(newStatus) + '\n';
  message += '━━━━━━━━━━━━━━━';
  
  sendLineMessage(message);
}

/**
 * 依狀態查詢訂單
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} status - 訂單狀態
 * @param {string} sheetName - 工作表名稱
 * @returns {Array<Object>} 訂單資料陣列
 */
function getOrdersByStatus(spreadsheetId, status, sheetName) {
  sheetName = sheetName || 'Orders';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var orders = readNormalizedOrders(ss);
    var filtered = [];
    
    for (var i = 0; i < orders.length; i++) {
      if (orders[i].status === status) {
        filtered.push(orders[i]);
      }
    }
    
    return filtered;
    
  } catch (e) {
    Logger.log('getOrdersByStatus 錯誤: ' + e.toString());
    throw new Error('依狀態查詢訂單失敗: ' + e.toString());
  }
}

/**
  * 依 LIFF userId 查詢訂單
  * @param {string} spreadsheetId - Google Sheet 的 ID
  * @param {string} liffUserId - LIFF userId
  * @param {string} sheetName - 工作表名稱
  * @returns {Array<Object>} 訂單資料陣列
  */
 function getOrdersByUserId(spreadsheetId, liffUserId, sheetName) {
   var orders = readAllOrders(spreadsheetId, sheetName);
   var filtered = [];
   
   for (var i = 0; i < orders.length; i++) {
     if (orders[i].liffUserId === liffUserId) {
       filtered.push(orders[i]);
     }
   }
   
   return filtered;
 }

 /**
  * 尋找欄位索引
  * @param {Array} headers - 標題列
  * @param {string} columnName - 欄位名稱
  * @returns {number} 欄位索引（-1 表示找不到）
  */
 function findColumnIndex(headers, columnName) {
   for (var i = 0; i < headers.length; i++) {
     if (headers[i] === columnName) {
       return i;
     }
   }
   return -1;
 }
