/**
 * order-processor.js
 * 訂單處理模組
 * 職責：訂單資料格式化、寫入 Google Sheets、觸發推播
 */

/**
 * 處理訂單（主要入口函式）
 * @param {Object} orderData - 前端傳送的訂單資料
 * @returns {Object} 處理結果
 */
function processOrder(orderData) {
  try {
    var validationResult = validateOrder(orderData);
    
    if (!validationResult.valid) {
      return {
        success: false,
        message: validationResult.message
      };
    }
    
    var spreadsheetId = getSpreadsheetId();
    
    var discountResult = getOrderDiscountResult(spreadsheetId, orderData);
    
    var formattedOrder = formatOrder(orderData, discountResult);
    
    var writeResult = writeOrder(spreadsheetId, formattedOrder);
    
    if (!writeResult.success) {
      Logger.log('訂單寫入失敗: ' + writeResult.message);
      return {
        success: false,
        message: '訂單儲存失敗'
      };
    }
    
    try {
      sendOrderNotification(formattedOrder, writeResult.orderId, writeResult.timestamp);
    } catch (notifyErr) {
      Logger.log('LINE 推播失敗（訂單已成功儲存）: ' + notifyErr.toString());
    }
    
    return {
      success: true,
      orderId: writeResult.orderId,
      timestamp: writeResult.timestamp,
      message: '訂單已成功建立',
      discount: discountResult.appliedDiscounts.length > 0 ? discountResult : null
    };
    
  } catch (e) {
    Logger.log('processOrder 錯誤: ' + e.toString());
    return {
      success: false,
      message: '訂單處理失敗，請稍後再試'
    };
  }
}

function getOrderDiscountResult(spreadsheetId, orderData) {
  if (typeof getDiscounts !== 'function' || typeof calculateOrderDiscount !== 'function') {
    return {
      originalTotal: 0,
      discountTotal: 0,
      finalTotal: 0,
      appliedDiscounts: []
    };
  }

  var discounts = getDiscounts(spreadsheetId);
  return calculateOrderDiscount(orderData, discounts);
}

/**
 * 格式化訂單項目
 * @param {Array<Object>} items - 原始訂單項目
 * @returns {Array<Object>} 格式化後的訂單項目
 */
function formatOrderItems(items) {
  var formatted = [];
  
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var quantity = parseInt(item.quantity) || 1;
    var price = parseFloat(item.price) || 0;
    formatted.push({
      name: sanitizeOrderText(item.name, 120),
      quantity: quantity,
      price: price,
      lineTotal: quantity * price,
      customizations: sanitizeOrderCustomizations(item.customizations || [])
    });
  }
  
  return formatted;
}

function formatOrder(orderData, discountResult) {
  var items = formatOrderItems(orderData.items || []);
  var totalAmount = 0;

  for (var i = 0; i < items.length; i++) {
    totalAmount += items[i].lineTotal;
  }

  var finalAmount = totalAmount;
  var discountInfo = null;

  if (discountResult && discountResult.discountTotal > 0) {
    finalAmount = discountResult.finalTotal;
    discountInfo = {
      appliedDiscounts: discountResult.appliedDiscounts,
      originalTotal: discountResult.originalTotal,
      discountTotal: discountResult.discountTotal
    };
  }

  return {
    customerName: sanitizeOrderText(orderData.customerName, 80),
    phone: String(orderData.phone || '').replace(/-/g, ''),
    guestCount: parseInt(orderData.guestCount) || 0,
    diningDate: sanitizeOrderText(orderData.diningDate, 10),
    diningTime: sanitizeOrderText(orderData.diningTime, 5),
    items: items,
    totalAmount: finalAmount,
    discountInfo: discountInfo,
    liffUserId: sanitizeOrderText(orderData.liffUserId, 128)
  };
}

function sanitizeOrderText(value, maxLength) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, maxLength || 255);
}

function sanitizeOrderCustomizations(customizations) {
  var sanitized = [];
  for (var i = 0; i < customizations.length; i++) {
    sanitized.push({
      optionName: sanitizeOrderText(customizations[i].optionName, 80),
      selectedValue: sanitizeOrderText(customizations[i].selectedValue, 120)
    });
  }
  return sanitized;
}

/**
 * 發送訂單通知至 LINE 群組
 * @param {Object} orderData - 訂單資料
 * @param {string} orderId - 訂單編號
 * @param {string} timestamp - 時間戳記
 */
function sendOrderNotification(orderData, orderId, timestamp) {
  var message = buildOrderMessage(orderData, orderId, timestamp);
  sendLineMessage(message);
}

/**
 * 組裝訂單訊息
 * @param {Object} orderData - 訂單資料
 * @param {string} orderId - 訂單編號
 * @param {string} timestamp - 時間戳記
 * @returns {string} 格式化訊息
 */
function buildOrderMessage(orderData, orderId, timestamp) {
  var lines = [];
  lines.push('🆕 新訂單通知');
  lines.push('━━━━━━━━━━━━━━━');
  lines.push('📋 訂單編號: ' + orderId);
  lines.push('⏰ 訂單時間: ' + timestamp);
  lines.push('');
  lines.push('👤 預約資訊');
  lines.push('姓名: ' + orderData.customerName);
  lines.push('電話: ' + orderData.phone);
  lines.push('人數: ' + orderData.guestCount + ' 人');
  lines.push('用餐時間: ' + orderData.diningDate + ' ' + orderData.diningTime);
  lines.push('');
  lines.push('🍽️ 餐點明細');
  lines.push('───────────────');
  
  var items = orderData.items;
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    lines.push('• ' + item.name + ' x' + item.quantity + ' ($' + item.price + ')');
    
    if (item.customizations && item.customizations.length > 0) {
      for (var j = 0; j < item.customizations.length; j++) {
        var opt = item.customizations[j];
        lines.push('  └ ' + opt.optionName + ': ' + opt.selectedValue);
      }
    }
  }
  
  lines.push('━━━━━━━━━━━━━━━');
  
  if (orderData.discountInfo) {
    lines.push('💰 折扣明細');
    lines.push('───────────────');
    lines.push('原價: $' + orderData.discountInfo.originalTotal);
    
    var discounts = orderData.discountInfo.appliedDiscounts;
    for (var k = 0; k < discounts.length; k++) {
      lines.push('- ' + discounts[k].name + ': -$' + discounts[k].amount);
    }
    
    lines.push('折扣後: $' + orderData.totalAmount);
    lines.push('━━━━━━━━━━━━━━━');
  } else {
    lines.push('總金額: $' + orderData.totalAmount);
  }
  
  lines.push('※ 現場結帳');
  
  return lines.join('\n');
}
