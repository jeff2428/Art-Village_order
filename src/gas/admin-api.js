/**
 * admin-api.js
 * 管理後台 API 端點模組
 * 職責：提供管理後台 CRUD 端點（菜單、設定、公告）
 */

/**
 * GAS Web App POST 端點（管理操作）
 * 處理管理後台的所有寫入請求
 * 
 * 請求格式：
 * {
 *   "action": "addMenuItem" | "updateMenuItem" | "deleteMenuItem" | ...
 *   "data": { ... }
 *   "adminToken": "管理員驗證 token"
 * }
 */
function handleAdminPost(e) {
  try {
    var requestData = parsePostData(e);
    
    if (!validateAdminToken(requestData.adminToken)) {
      return createJsonResponse({
        success: false,
        message: '權限驗證失敗'
      }, 401);
    }
    
    var action = requestData.action;
    var data = requestData.data || {};
    var spreadsheetId = getSpreadsheetId();
    var result;
    
    switch (action) {
      case 'getMenuItems':
        result = { success: true, data: readMenuItems(spreadsheetId) };
        break;
      case 'getFullMenuState':
        result = { success: true, data: getFullMenuState(spreadsheetId) };
        break;
      case 'updateFullMenuState':
        result = updateFullMenuState(spreadsheetId, data.menuState);
        break;
      case 'addMenuItem':
        result = addMenuItem(spreadsheetId, data);
        break;
      case 'updateMenuItem':
        result = updateMenuItem(spreadsheetId, data);
        break;
      case 'deleteMenuItem':
        result = deleteMenuItem(spreadsheetId, data);
        break;
      case 'getBusinessHours':
        result = { success: true, data: getBusinessHours(spreadsheetId) };
        break;
      case 'updateBusinessHours':
        result = updateBusinessHours(spreadsheetId, data.scheduleData);
        break;
      case 'getHolidays':
        result = { success: true, data: getHolidays(spreadsheetId) };
        break;
      case 'addHoliday':
        result = addHoliday(spreadsheetId, data.date, data.reason);
        break;
      case 'removeHoliday':
        result = removeHoliday(spreadsheetId, data.date);
        break;
      case 'getAnnouncements':
        result = { success: true, data: getAnnouncements(spreadsheetId) };
        break;
      case 'updateAnnouncement':
        result = updateAnnouncement(spreadsheetId, data.position, data.content, data.enabled);
        break;
      case 'getOrders':
        result = { success: true, data: readAllOrders(spreadsheetId) };
        break;
      case 'getOrdersByDateRange':
        result = { success: true, data: getOrdersByDateRange(spreadsheetId, data.startDate, data.endDate) };
        break;
      case 'updateOrderStatus':
        result = updateOrderStatus(spreadsheetId, data.orderId, data.status);
        break;
      case 'getOrdersByStatus':
        result = { success: true, data: getOrdersByStatus(spreadsheetId, data.status) };
        break;
      case 'getDiscounts':
        result = { success: true, data: getDiscounts(spreadsheetId) };
        break;
      case 'addDiscount':
        result = addDiscount(spreadsheetId, data);
        break;
      case 'updateDiscount':
        result = updateDiscount(spreadsheetId, data);
        break;
      case 'deleteDiscount':
        result = deleteDiscount(spreadsheetId, data);
        break;
      case 'loginEmployee':
        result = loginEmployee(spreadsheetId, data.pinCode);
        break;
      case 'getEmployees':
        result = { success: true, data: getEmployees(spreadsheetId) };
        break;
      case 'addEmployee':
        result = addEmployee(spreadsheetId, data);
        break;
      case 'updateEmployee':
        result = updateEmployee(spreadsheetId, data);
        break;
      case 'resetEmployeePin':
        result = resetEmployeePin(spreadsheetId, data);
        break;
      case 'changeEmployeePin':
        result = changeEmployeePin(spreadsheetId, data);
        break;
      case 'getAuditLog':
        result = { success: true, data: getAuditLog(spreadsheetId, data.limit || 100) };
        break;
      default:
        result = {
          success: false,
          message: '無效的 action: ' + action
        };
    }
    
    Logger.log('Admin API: ' + action + ' - ' + (result.success ? '成功' : '失敗'));
    
    return createJsonResponse(result);
    
  } catch (err) {
    Logger.log('admin-api doPost 錯誤: ' + err.toString());
    return createJsonResponse({
      success: false,
      message: '伺服器錯誤: ' + err.toString()
    }, 500);
  }
}

/**
 * 解析 POST 請求資料
 * @param {Object} e - GAS event 物件
 * @returns {Object} 解析後的請求資料
 */
function parsePostData(e) {
  if (e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }
  
  return e.parameter || {};
}

/**
 * 驗證管理員 token
 * @param {string} token - 管理員 token
 * @returns {boolean} 是否有效
 */
function validateAdminToken(token) {
  if (!token) return false;
  
  var storedToken = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  
  if (!storedToken) {
    Logger.log('ADMIN_TOKEN 未設定，拒絕管理後台請求');
    return false;
  }
  
  return token === storedToken;
}

/**
 * 新增餐點
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - 餐點資料
 * @returns {Object} 操作結果
 */
function addMenuItem(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('菜單');
    
    if (!sheet) {
      sheet = ss.insertSheet('菜單');
      sheet.appendRow(['分類', '品名', '價格', '描述', '客製化選項', '庫存狀態', '啟用狀態']);
    }
    
    var customizationJson = Array.isArray(data.customizationOptions) 
      ? JSON.stringify(data.customizationOptions) 
      : '';
    
    sheet.appendRow([
      data.category || '',
      data.name || '',
      data.price || 0,
      data.description || '',
      customizationJson,
      true,
      true
    ]);
    
    clearMenuCache();
    
    return {
      success: true,
      message: '已新增餐點: ' + data.name
    };
    
  } catch (e) {
    Logger.log('addMenuItem 錯誤: ' + e.toString());
    return {
      success: false,
      message: '新增餐點失敗: ' + e.toString()
    };
  }
}

/**
 * 更新餐點
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - 餐點資料（需包含原始品名用於查找）
 * @returns {Object} 操作結果
 */
function updateMenuItem(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('菜單');
    
    if (!sheet) {
      return {
        success: false,
        message: '找不到菜單工作表'
      };
    }
    
    var sheetData = sheet.getDataRange().getValues();
    
    for (var i = 1; i < sheetData.length; i++) {
      if (sheetData[i][1] === data.originalName) {
        var customizationJson = Array.isArray(data.customizationOptions) 
          ? JSON.stringify(data.customizationOptions) 
          : sheetData[i][4];
        
        sheet.getRange(i + 1, 1).setValue(data.category || sheetData[i][0]);
        sheet.getRange(i + 1, 2).setValue(data.name || sheetData[i][1]);
        sheet.getRange(i + 1, 3).setValue(data.price !== undefined ? data.price : sheetData[i][2]);
        sheet.getRange(i + 1, 4).setValue(data.description !== undefined ? data.description : sheetData[i][3]);
        sheet.getRange(i + 1, 5).setValue(customizationJson);
        
        clearMenuCache();
        
        return {
          success: true,
          message: '已更新餐點: ' + data.name
        };
      }
    }
    
    return {
      success: false,
      message: '找不到餐點: ' + data.originalName
    };
    
  } catch (e) {
    Logger.log('updateMenuItem 錯誤: ' + e.toString());
    return {
      success: false,
      message: '更新餐點失敗: ' + e.toString()
    };
  }
}

/**
 * 刪除/停用餐點
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - { itemName: string }
 * @returns {Object} 操作結果
 */
function deleteMenuItem(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ss.getSheetByName('菜單');
    
    if (!sheet) {
      return {
        success: false,
        message: '找不到菜單工作表'
      };
    }
    
    var sheetData = sheet.getDataRange().getValues();
    
    for (var i = 1; i < sheetData.length; i++) {
      if (sheetData[i][1] === data.itemName) {
        sheet.getRange(i + 1, 7).setValue(false);
        
        clearMenuCache();
        
        return {
          success: true,
          message: '已停用餐點: ' + data.itemName
        };
      }
    }
    
    return {
      success: false,
      message: '找不到餐點: ' + data.itemName
    };
    
  } catch (e) {
    Logger.log('deleteMenuItem 錯誤: ' + e.toString());
    return {
      success: false,
      message: '刪除餐點失敗: ' + e.toString()
    };
  }
}
