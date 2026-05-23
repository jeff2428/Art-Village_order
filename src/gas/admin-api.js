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
      case 'addCategory':
        result = addCategory(spreadsheetId, data);
        break;
      case 'updateCategory':
        result = updateCategory(spreadsheetId, data);
        break;
      case 'deleteCategory':
        result = deleteCategory(spreadsheetId, data);
        break;
      case 'addOptionGroup':
        result = addOptionGroup(spreadsheetId, data);
        break;
      case 'updateOptionGroup':
        result = updateOptionGroup(spreadsheetId, data);
        break;
      case 'deleteOptionGroup':
        result = deleteOptionGroup(spreadsheetId, data);
        break;
      case 'migrateMenuToNormalized':
        result = migrateMenuToNormalized(spreadsheetId);
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
      case 'deleteEmployee':
        result = deleteEmployee(spreadsheetId, data);
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
      message: '伺服器錯誤，請稍後再試'
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
  
  var props = PropertiesService.getScriptProperties();
  var currentToken = props.getProperty('ADMIN_TOKEN_CURRENT');
  var previousToken = props.getProperty('ADMIN_TOKEN_PREVIOUS');
  
  if (!currentToken) {
    currentToken = props.getProperty('ADMIN_TOKEN');
    if (!currentToken) {
      Logger.log('ADMIN_TOKEN_CURRENT 未設定，拒絕管理後台請求');
      return false;
    }
  }
  
  return token === currentToken || (previousToken && token === previousToken);
}

/**
 * 新增餐點（支援新版正規化格式）
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - 餐點資料
 * @returns {Object} 操作結果
 */
function addMenuItem(spreadsheetId, data) {
  try {
    var validation = validateMenuItemData(data);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (hasNormalizedMenuSheets(ss)) {
      return addMenuItemNormalized(ss, data);
    }
    
    return addMenuItemLegacy(ss, data);
  } catch (e) {
    Logger.log('addMenuItem 錯誤: ' + e.toString());
    return {
      success: false,
      message: '新增餐點失敗'
    };
  }
}

function addMenuItemNormalized(ss, data) {
  var productsSheet = getOrCreateSheet(ss, 'Products', ['productId', 'categoryId', 'name', 'description', 'price', 'soldOut', 'sortOrder', 'enabled', 'imageUrl']);
  var categoriesSheet = ss.getSheetByName('Categories');
  var categoryMap = readSheetAsMap(categoriesSheet, 0, 1);
  
  var categoryId = '';
  if (data.categoryId) {
    categoryId = data.categoryId;
    if (!categoryMap[categoryId]) {
      return { success: false, message: '找不到分類: ' + data.categoryId };
    }
  } else if (data.category) {
    var cats = readSheetRows(categoriesSheet);
    for (var i = 0; i < cats.length; i++) {
      if (cats[i][1] === data.category) {
        categoryId = String(cats[i][0]);
        break;
      }
    }
    if (!categoryId) {
      return { success: false, message: '找不到分類: ' + data.category };
    }
  }
  
  var productId = data.productId || makeMenuId('item', data.name, getLastDataRow(productsSheet));
  var sortOrder = data.sortOrder || (getLastDataRow(productsSheet) + 1) * 10;
  
  var productRow = [
    productId,
    categoryId,
    data.name || '',
    data.description || '',
    data.price || 0,
    false,
    sortOrder,
    true,
    data.imageUrl || ''
  ];
  
  productsSheet.appendRow(productRow);
  
  if (data.customizationOptions && Array.isArray(data.customizationOptions)) {
    var productOptionsSheet = getOrCreateSheet(ss, 'ProductOptions', ['productId', 'groupId', 'sortOrder', 'enabled']);
    for (var j = 0; j < data.customizationOptions.length; j++) {
      var opt = data.customizationOptions[j];
      var groupId = opt.id || '';
      if (!groupId && opt.name) {
        var optionGroupsSheet = ss.getSheetByName('OptionGroups');
        var optionRows = readSheetRows(optionGroupsSheet);
        for (var k = 0; k < optionRows.length; k++) {
          if (optionRows[k][1] === opt.name) {
            groupId = String(optionRows[k][0]);
            break;
          }
        }
      }
      if (groupId) {
        productOptionsSheet.appendRow([productId, groupId, (j + 1) * 10, true]);
      }
    }
  }
  
  clearMenuCache();
  
  return {
    success: true,
    message: '已新增餐點: ' + data.name
  };
}

function addMenuItemLegacy(ss, data) {
  var sheet = ss.getSheetByName('菜單');
  
  if (!sheet) {
    sheet = ss.insertSheet('菜單');
    sheet.appendRow(['分類', '品名', '價格', '描述', '客製化選項', '庫存狀態', '啟用狀態', '圖片網址']);
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
    true,
    data.imageUrl || ''
  ]);
  
  clearMenuCache();
  
  return {
    success: true,
    message: '已新增餐點: ' + data.name
  };
}

/**
 * 更新餐點（支援新版正規化格式，使用 productId 查找）
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - 餐點資料（需包含 productId）
 * @returns {Object} 操作結果
 */
function updateMenuItem(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (hasNormalizedMenuSheets(ss)) {
      return updateMenuItemNormalized(ss, data);
    }
    
    return updateMenuItemLegacy(ss, data);
  } catch (e) {
    Logger.log('updateMenuItem 錯誤: ' + e.toString());
    return {
      success: false,
      message: '更新餐點失敗'
    };
  }
}

function updateMenuItemNormalized(ss, data) {
  if (!data.productId) {
    return { success: false, message: '更新餐點需要 productId' };
  }
  
  var productsSheet = ss.getSheetByName('Products');
  if (!productsSheet) {
    return { success: false, message: '找不到 Products 工作表' };
  }
  
  var rows = readSheetRows(productsSheet);
  var targetRow = 0;
  
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.productId)) {
      targetRow = i + 2; // +1 for header, +1 for 1-based
      break;
    }
  }
  
  if (!targetRow) {
    return { success: false, message: '找不到餐點: ' + data.productId };
  }
  
  var categoriesSheet = ss.getSheetByName('Categories');
  var categoryId = data.categoryId || '';
  if (data.category && !categoryId) {
    var catRows = readSheetRows(categoriesSheet);
    for (var j = 0; j < catRows.length; j++) {
      if (catRows[j][1] === data.category) {
        categoryId = String(catRows[j][0]);
        break;
      }
    }
  }
  
  var soldOut = data.soldOut !== undefined ? data.soldOut : isTruthy(rows[targetRow - 2][5]);
  var enabled = data.enabled !== undefined ? data.enabled : isTruthy(rows[targetRow - 2][7]);
  
  productsSheet.getRange(targetRow, 2).setValue(categoryId);
  productsSheet.getRange(targetRow, 3).setValue(data.name || rows[targetRow - 2][2]);
  productsSheet.getRange(targetRow, 4).setValue(data.description !== undefined ? data.description : rows[targetRow - 2][3]);
  productsSheet.getRange(targetRow, 5).setValue(data.price !== undefined ? data.price : rows[targetRow - 2][4]);
  productsSheet.getRange(targetRow, 6).setValue(soldOut);
  productsSheet.getRange(targetRow, 7).setValue(data.sortOrder !== undefined ? data.sortOrder : rows[targetRow - 2][6]);
  productsSheet.getRange(targetRow, 8).setValue(enabled);
  productsSheet.getRange(targetRow, 9).setValue(data.imageUrl !== undefined ? data.imageUrl : rows[targetRow - 2][8]);
  
  if (data.customizationOptions !== undefined) {
    var productOptionsSheet = getOrCreateSheet(ss, 'ProductOptions', ['productId', 'groupId', 'sortOrder', 'enabled']);
    var poRows = readSheetRows(productOptionsSheet);
    var oldGroupIds = [];
    for (var k = 0; k < poRows.length; k++) {
      if (String(poRows[k][0]) === String(data.productId)) {
        oldGroupIds.push(String(poRows[k][1]));
      }
    }
    
    var newGroupIds = [];
    for (var m = 0; m < data.customizationOptions.length; m++) {
      var opt = data.customizationOptions[m];
      var groupId = opt.id || '';
      if (!groupId && opt.name) {
        var optionGroupsSheet = ss.getSheetByName('OptionGroups');
        var optionRows = readSheetRows(optionGroupsSheet);
        for (var n = 0; n < optionRows.length; n++) {
          if (optionRows[n][1] === opt.name) {
            groupId = String(optionRows[n][0]);
            break;
          }
        }
      }
      if (groupId) {
        newGroupIds.push(String(groupId));
      }
    }
    
    var toRemove = [];
    for (var p = 0; p < poRows.length; p++) {
      if (String(poRows[p][0]) === String(data.productId) && newGroupIds.indexOf(String(poRows[p][1])) === -1) {
        toRemove.push(p + 1);
      }
    }
    for (var q = toRemove.length - 1; q >= 0; q--) {
      productOptionsSheet.deleteRow(toRemove[q] + 1);
    }
    
    for (var r = 0; r < data.customizationOptions.length; r++) {
      var opt = data.customizationOptions[r];
      var groupId = opt.id || '';
      if (!groupId && opt.name) {
        var optionGroupsSheet2 = ss.getSheetByName('OptionGroups');
        var optionRows2 = readSheetRows(optionGroupsSheet2);
        for (var s = 0; s < optionRows2.length; s++) {
          if (optionRows2[s][1] === opt.name) {
            groupId = String(optionRows2[s][0]);
            break;
          }
        }
      }
      if (groupId && newGroupIds.indexOf(String(groupId)) !== -1) {
        productOptionsSheet.appendRow([data.productId, groupId, (r + 1) * 10, true]);
      }
    }
  }
  
  clearMenuCache();
  
  return {
    success: true,
    message: '已更新餐點: ' + data.name
  };
}

function updateMenuItemLegacy(ss, data) {
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
}

/**
 * 刪除餐點（物理刪除列，支援新版正規化格式）
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - { productId: string }
 * @returns {Object} 操作結果
 */
function deleteMenuItem(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (hasNormalizedMenuSheets(ss)) {
      return deleteMenuItemNormalized(ss, data);
    }
    
    return deleteMenuItemLegacy(ss, data);
  } catch (e) {
    Logger.log('deleteMenuItem 錯誤: ' + e.toString());
    return {
      success: false,
      message: '刪除餐點失敗'
    };
  }
}

function deleteMenuItemNormalized(ss, data) {
  if (!data.productId) {
    return { success: false, message: '刪除餐點需要 productId' };
  }
  
  var productsSheet = ss.getSheetByName('Products');
  if (!productsSheet) {
    return { success: false, message: '找不到 Products 工作表' };
  }
  
  var rows = readSheetRows(productsSheet);
  var targetRow = 0;
  
  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][0]) === String(data.productId)) {
      targetRow = i + 2;
      break;
    }
  }
  
  if (!targetRow) {
    return { success: false, message: '找不到餐點: ' + data.productId };
  }
  
  var productName = rows[targetRow - 2][2] || '';
  productsSheet.deleteRow(targetRow);
  
  var productOptionsSheet = ss.getSheetByName('ProductOptions');
  if (productOptionsSheet) {
    var poRows = readSheetRows(productOptionsSheet);
    for (var j = poRows.length - 1; j >= 0; j--) {
      if (String(poRows[j][0]) === String(data.productId)) {
        productOptionsSheet.deleteRow(j + 2);
      }
    }
  }
  
  clearMenuCache();
  
  return {
    success: true,
    message: '已刪除餐點: ' + productName
  };
}

function deleteMenuItemLegacy(ss, data) {
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
      var productName = sheetData[i][1];
      sheet.deleteRow(i + 1);
      
      clearMenuCache();
      
      return {
        success: true,
        message: '已刪除餐點: ' + productName
      };
    }
  }
  
  return {
    success: false,
    message: '找不到餐點: ' + data.itemName
  };
}

/**
 * 新增分類（新版正規化格式）
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - { name: string, sortOrder: number, enabled: boolean }
 * @returns {Object} 操作結果
 */
function addCategory(spreadsheetId, data) {
  try {
    var validation = validateCategoryData(data);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (!hasNormalizedMenuSheets(ss)) {
      return { success: false, message: '請先遷移至新版格式' };
    }
    
    var categoriesSheet = getOrCreateSheet(ss, 'Categories', ['categoryId', 'name', 'sortOrder', 'enabled']);
    var catRows = readSheetRows(categoriesSheet);
    
    for (var i = 0; i < catRows.length; i++) {
      if (String(catRows[i][1]) === String(data.name)) {
        return { success: false, message: '分類名稱不可重複: ' + data.name };
      }
    }
    
    var categoryId = data.categoryId || makeMenuId('cat', data.name, catRows.length);
    var sortOrder = data.sortOrder || (catRows.length + 1) * 10;
    
    categoriesSheet.appendRow([
      categoryId,
      data.name || '',
      sortOrder,
      data.enabled !== false
    ]);
    
    clearMenuCache();
    
    return {
      success: true,
      message: '已新增分類: ' + data.name
    };
  } catch (e) {
    Logger.log('addCategory 錯誤: ' + e.toString());
    return {
      success: false,
      message: '新增分類失敗'
    };
  }
}

/**
 * 更新分類（新版正規化格式）
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - { categoryId: string, name: string, sortOrder: number, enabled: boolean }
 * @returns {Object} 操作結果
 */
function updateCategory(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (!hasNormalizedMenuSheets(ss)) {
      return { success: false, message: '請先遷移至新版格式' };
    }
    
    var categoriesSheet = ss.getSheetByName('Categories');
    if (!categoriesSheet) {
      return { success: false, message: '找不到 Categories 工作表' };
    }
    
    var catRows = readSheetRows(categoriesSheet);
    var targetRow = 0;
    
    for (var i = 0; i < catRows.length; i++) {
      if (String(catRows[i][0]) === String(data.categoryId)) {
        targetRow = i + 2;
        break;
      }
    }
    
    if (!targetRow) {
      return { success: false, message: '找不到分類: ' + data.categoryId };
    }
    
    var oldName = catRows[targetRow - 2][1];
    var nameChanged = String(oldName) !== String(data.name);
    
    if (nameChanged) {
      for (var j = 0; j < catRows.length; j++) {
        if (String(catRows[j][1]) === String(data.name)) {
          return { success: false, message: '分類名稱不可重複: ' + data.name };
        }
      }
    }
    
    categoriesSheet.getRange(targetRow, 2).setValue(data.name || oldName);
    categoriesSheet.getRange(targetRow, 3).setValue(data.sortOrder !== undefined ? data.sortOrder : catRows[targetRow - 2][2]);
    categoriesSheet.getRange(targetRow, 4).setValue(data.enabled !== undefined ? data.enabled : isTruthy(catRows[targetRow - 2][3]));
    
    if (nameChanged) {
      var productsSheet = ss.getSheetByName('Products');
      if (productsSheet) {
        var prodRows = readSheetRows(productsSheet);
        for (var k = 0; k < prodRows.length; k++) {
          if (String(prodRows[k][1]) === String(data.categoryId)) {
            productsSheet.getRange(k + 2, 1).setValue(data.categoryId);
          }
        }
      }
    }
    
    clearMenuCache();
    
    return {
      success: true,
      message: '已更新分類: ' + data.name
    };
  } catch (e) {
    Logger.log('updateCategory 錯誤: ' + e.toString());
    return {
      success: false,
      message: '更新分類失敗'
    };
  }
}

/**
 * 刪除分類（新版正規化格式）
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - { categoryId: string }
 * @returns {Object} 操作結果
 */
function deleteCategory(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (!hasNormalizedMenuSheets(ss)) {
      return { success: false, message: '請先遷移至新版格式' };
    }
    
    var categoriesSheet = ss.getSheetByName('Categories');
    if (!categoriesSheet) {
      return { success: false, message: '找不到 Categories 工作表' };
    }
    
    var catRows = readSheetRows(categoriesSheet);
    var targetRow = 0;
    var categoryName = '';
    
    for (var i = 0; i < catRows.length; i++) {
      if (String(catRows[i][0]) === String(data.categoryId)) {
        targetRow = i + 2;
        categoryName = catRows[i][1];
        break;
      }
    }
    
    if (!targetRow) {
      return { success: false, message: '找不到分類: ' + data.categoryId };
    }
    
    var productsSheet = ss.getSheetByName('Products');
    if (productsSheet) {
      var prodRows = readSheetRows(productsSheet);
      for (var j = prodRows.length - 1; j >= 0; j--) {
        if (String(prodRows[j][1]) === String(data.categoryId)) {
          productsSheet.deleteRow(j + 2);
        }
      }
    }
    
    categoriesSheet.deleteRow(targetRow);
    
    clearMenuCache();
    
    return {
      success: true,
      message: '已刪除分類: ' + categoryName
    };
  } catch (e) {
    Logger.log('deleteCategory 錯誤: ' + e.toString());
    return {
      success: false,
      message: '刪除分類失敗'
    };
  }
}

/**
 * 新增屬性群組（新版正規化格式）
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - { name: string, type: string, required: boolean, choices: Array, sortOrder: number, enabled: boolean }
 * @returns {Object} 操作結果
 */
function addOptionGroup(spreadsheetId, data) {
  try {
    var validation = validateOptionGroupData(data);
    if (!validation.valid) {
      return { success: false, message: validation.message };
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (!hasNormalizedMenuSheets(ss)) {
      return { success: false, message: '請先遷移至新版格式' };
    }
    
    var ogSheet = getOrCreateSheet(ss, 'OptionGroups', ['groupId', 'name', 'type', 'required', 'sortOrder', 'enabled']);
    var ogRows = readSheetRows(ogSheet);
    
    for (var i = 0; i < ogRows.length; i++) {
      if (String(ogRows[i][1]) === String(data.name)) {
        return { success: false, message: '屬性群組名稱不可重複: ' + data.name };
      }
    }
    
    var groupId = data.groupId || makeMenuId('opt', data.name, ogRows.length);
    var sortOrder = data.sortOrder || (ogRows.length + 1) * 10;
    
    ogSheet.appendRow([
      groupId,
      data.name || '',
      data.type || 'single',
      data.required === true,
      sortOrder,
      data.enabled !== false
    ]);
    
    if (data.choices && Array.isArray(data.choices)) {
      var oiSheet = getOrCreateSheet(ss, 'OptionItems', ['optionItemId', 'groupId', 'name', 'sortOrder', 'enabled']);
      var oiRows = readSheetRows(oiSheet);
      var existingNames = {};
      for (var j = 0; j < oiRows.length; j++) {
        existingNames[oiRows[j][2]] = true;
      }
      
      var choices = uniqueStrings(data.choices);
      for (var k = 0; k < choices.length; k++) {
        var choiceName = choices[k];
        var itemExists = false;
        for (var l = 0; l < oiRows.length; l++) {
          if (String(oiRows[l][1]) === String(groupId) && String(oiRows[l][2]) === choiceName) {
            itemExists = true;
            break;
          }
        }
        if (!itemExists) {
          oiSheet.appendRow([
            makeMenuId('choice', groupId + '-' + choiceName, oiRows.length + k),
            groupId,
            choiceName,
            (k + 1) * 10,
            true
          ]);
        }
      }
    }
    
    clearMenuCache();
    
    return {
      success: true,
      message: '已新增屬性群組: ' + data.name
    };
  } catch (e) {
    Logger.log('addOptionGroup 錯誤: ' + e.toString());
    return {
      success: false,
      message: '新增屬性群組失敗'
    };
  }
}

/**
 * 更新屬性群組（新版正規化格式）
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - { groupId: string, name: string, type: string, required: boolean, choices: Array, sortOrder: number, enabled: boolean }
 * @returns {Object} 操作結果
 */
function updateOptionGroup(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (!hasNormalizedMenuSheets(ss)) {
      return { success: false, message: '請先遷移至新版格式' };
    }
    
    var ogSheet = ss.getSheetByName('OptionGroups');
    if (!ogSheet) {
      return { success: false, message: '找不到 OptionGroups 工作表' };
    }
    
    var ogRows = readSheetRows(ogSheet);
    var targetRow = 0;
    
    for (var i = 0; i < ogRows.length; i++) {
      if (String(ogRows[i][0]) === String(data.groupId)) {
        targetRow = i + 2;
        break;
      }
    }
    
    if (!targetRow) {
      return { success: false, message: '找不到屬性群組: ' + data.groupId };
    }
    
    var oldName = ogRows[targetRow - 2][1];
    var nameChanged = String(oldName) !== String(data.name);
    
    if (nameChanged) {
      for (var j = 0; j < ogRows.length; j++) {
        if (String(ogRows[j][1]) === String(data.name)) {
          return { success: false, message: '屬性群組名稱不可重複: ' + data.name };
        }
      }
    }
    
    ogSheet.getRange(targetRow, 2).setValue(data.name || oldName);
    ogSheet.getRange(targetRow, 3).setValue(data.type || oldName);
    ogSheet.getRange(targetRow, 4).setValue(data.type === 'multiple' ? 'multiple' : 'single');
    ogSheet.getRange(targetRow, 5).setValue(data.required !== undefined ? data.required : isTruthy(ogRows[targetRow - 2][3]));
    ogSheet.getRange(targetRow, 6).setValue(data.sortOrder !== undefined ? data.sortOrder : ogRows[targetRow - 2][4]);
    ogSheet.getRange(targetRow, 7).setValue(data.enabled !== undefined ? data.enabled : isTruthy(ogRows[targetRow - 2][5]));
    
    if (data.choices !== undefined) {
      var oiSheet = ss.getSheetByName('OptionItems');
      if (oiSheet) {
        var oiRows = readSheetRows(oiSheet);
        for (var k = oiRows.length - 1; k >= 0; k--) {
          if (String(oiRows[k][1]) === String(data.groupId)) {
            oiSheet.deleteRow(k + 2);
          }
        }
        
        var choices = uniqueStrings(data.choices);
        for (var m = 0; m < choices.length; m++) {
          oiSheet.appendRow([
            makeMenuId('choice', data.groupId + '-' + choices[m], m),
            data.groupId,
            choices[m],
            (m + 1) * 10,
            true
          ]);
        }
      }
    }
    
    clearMenuCache();
    
    return {
      success: true,
      message: '已更新屬性群組: ' + data.name
    };
  } catch (e) {
    Logger.log('updateOptionGroup 錯誤: ' + e.toString());
    return {
      success: false,
      message: '更新屬性群組失敗: ' + e.toString()
    };
  }
}

/**
 * 刪除屬性群組（新版正規化格式）
 * @param {string} spreadsheetId - Google Sheet ID
 * @param {Object} data - { groupId: string }
 * @returns {Object} 操作結果
 */
function deleteOptionGroup(spreadsheetId, data) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (!hasNormalizedMenuSheets(ss)) {
      return { success: false, message: '請先遷移至新版格式' };
    }
    
    var ogSheet = ss.getSheetByName('OptionGroups');
    if (!ogSheet) {
      return { success: false, message: '找不到 OptionGroups 工作表' };
    }
    
    var ogRows = readSheetRows(ogSheet);
    var targetRow = 0;
    var groupName = '';
    
    for (var i = 0; i < ogRows.length; i++) {
      if (String(ogRows[i][0]) === String(data.groupId)) {
        targetRow = i + 2;
        groupName = ogRows[i][1];
        break;
      }
    }
    
    if (!targetRow) {
      return { success: false, message: '找不到屬性群組: ' + data.groupId };
    }
    
    var oiSheet = ss.getSheetByName('OptionItems');
    if (oiSheet) {
      var oiRows = readSheetRows(oiSheet);
      for (var j = oiRows.length - 1; j >= 0; j--) {
        if (String(oiRows[j][1]) === String(data.groupId)) {
          oiSheet.deleteRow(j + 2);
        }
      }
    }
    
    ogSheet.deleteRow(targetRow);
    
    clearMenuCache();
    
    return {
      success: true,
      message: '已刪除屬性群組: ' + groupName
    };
  } catch (e) {
    Logger.log('deleteOptionGroup 錯誤: ' + e.toString());
    return {
      success: false,
      message: '刪除屬性群組失敗: ' + e.toString()
    };
  }
}

/**
 * 將舊版「菜單」表遷移至新版正規化格式
 * @param {string} spreadsheetId - Google Sheet ID
 * @returns {Object} 操作結果
 */
function migrateMenuToNormalized(spreadsheetId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    
    if (hasNormalizedMenuSheets(ss)) {
      return { success: false, message: '已為新版格式，無需遷移' };
    }
    
    var menuSheet = ss.getSheetByName('菜單');
    if (!menuSheet) {
      return { success: false, message: '找不到「菜單」工作表' };
    }
    
    var menuRows = readSheetRows(menuSheet);
    if (menuRows.length === 0) {
      return { success: false, message: '「菜單」工作表為空' };
    }
    
    var categoriesMap = {};
    var categoryList = [];
    var optionGroupsMap = {};
    var optionItemsList = [];
    var productsList = [];
    var productOptionsList = [];
    var globalOptionIndex = 0;
    
    for (var i = 0; i < menuRows.length; i++) {
      var row = menuRows[i];
      var category = row[0] || '';
      var name = row[1] || '';
      var price = row[2] || 0;
      var desc = row[3] || '';
      var customizationRaw = row[4];
      var inStock = row[5] === true || row[5] === 'TRUE';
      var enabled = row[6] === true || row[6] === 'TRUE';
      var imageUrl = row[7] || '';
      
      if (!name) continue;
      
      if (category && !categoriesMap[category]) {
        categoriesMap[category] = makeMenuId('cat', category, categoryList.length);
        categoryList.push({ id: categoriesMap[category], name: category });
      }
      
      var productId = makeMenuId('item', name, i);
      var soldOut = !inStock;
      
      productsList.push({
        productId: productId,
        categoryId: categoriesMap[category] || '',
        name: name,
        description: desc,
        price: price,
        soldOut: soldOut,
        sortOrder: (i + 1) * 10,
        enabled: enabled,
        imageUrl: imageUrl
      });
      
      if (customizationRaw && customizationRaw !== '') {
        var customizationOptions = [];
        try {
          if (typeof customizationRaw === 'string') {
            customizationOptions = JSON.parse(customizationRaw);
          } else if (Array.isArray(customizationRaw)) {
            customizationOptions = customizationRaw;
          }
        } catch (e) {
          Logger.log('遷移時解析客製化選項失敗: ' + e.toString());
        }
        
        for (var j = 0; j < customizationOptions.length; j++) {
          var opt = customizationOptions[j];
          if (!opt || !opt.name) continue;
          
          var groupId = optionGroupsMap[opt.name];
          if (!groupId) {
            groupId = makeMenuId('opt', opt.name, globalOptionIndex);
            optionGroupsMap[opt.name] = groupId;
            optionGroupsList.push({
              groupId: groupId,
              name: opt.name,
              type: opt.type || 'single',
              required: opt.required === true,
              sortOrder: (globalOptionIndex + 1) * 10,
              enabled: true
            });
            globalOptionIndex++;
          }
          
          if (opt.choices && Array.isArray(opt.choices)) {
            var choices = uniqueStrings(opt.choices);
            for (var k = 0; k < choices.length; k++) {
              var choiceName = choices[k];
              var exists = false;
              for (var l = 0; l < optionItemsList.length; l++) {
                if (optionItemsList[l].groupId === groupId && optionItemsList[l].name === choiceName) {
                  exists = true;
                  break;
                }
              }
              if (!exists) {
                optionItemsList.push({
                  optionItemId: makeMenuId('choice', groupId + '-' + choiceName, optionItemsList.length),
                  groupId: groupId,
                  name: choiceName,
                  sortOrder: (optionItemsList.length + 1) * 10,
                  enabled: true
                });
              }
            }
          }
          
          productOptionsList.push({
            productId: productId,
            groupId: groupId,
            sortOrder: (j + 1) * 10,
            enabled: true
          });
        }
      }
    }
    
    var categoriesSheet = ss.insertSheet('Categories');
    categoriesSheet.appendRow(['categoryId', 'name', 'sortOrder', 'enabled']);
    for (var m = 0; m < categoryList.length; m++) {
      categoriesSheet.appendRow([categoryList[m].id, categoryList[m].name, (m + 1) * 10, true]);
    }
    
    var productsSheet = ss.insertSheet('Products');
    productsSheet.appendRow(['productId', 'categoryId', 'name', 'description', 'price', 'soldOut', 'sortOrder', 'enabled', 'imageUrl']);
    for (var n = 0; n < productsList.length; n++) {
      var p = productsList[n];
      productsSheet.appendRow([p.productId, p.categoryId, p.name, p.description, p.price, p.soldOut, p.sortOrder, p.enabled, p.imageUrl]);
    }
    
    var ogSheet = ss.insertSheet('OptionGroups');
    ogSheet.appendRow(['groupId', 'name', 'type', 'required', 'sortOrder', 'enabled']);
    for (var o = 0; o < optionGroupsList.length; o++) {
      var og = optionGroupsList[o];
      ogSheet.appendRow([og.groupId, og.name, og.type, og.required, og.sortOrder, og.enabled]);
    }
    
    var oiSheet = ss.insertSheet('OptionItems');
    oiSheet.appendRow(['optionItemId', 'groupId', 'name', 'sortOrder', 'enabled']);
    for (var p = 0; p < optionItemsList.length; p++) {
      var oi = optionItemsList[p];
      oiSheet.appendRow([oi.optionItemId, oi.groupId, oi.name, oi.sortOrder, oi.enabled]);
    }
    
    var poSheet = ss.insertSheet('ProductOptions');
    poSheet.appendRow(['productId', 'groupId', 'sortOrder', 'enabled']);
    for (var q = 0; q < productOptionsList.length; q++) {
      var po = productOptionsList[q];
      poSheet.appendRow([po.productId, po.groupId, po.sortOrder, po.enabled]);
    }
    
    clearMenuCache();
    
    return {
      success: true,
      message: '遷移完成！已建立 Categories、Products、OptionGroups、OptionItems、ProductOptions 五張工作表。建議確認資料正確後，手動刪除舊版「菜單」工作表。'
    };
  } catch (e) {
    Logger.log('migrateMenuToNormalized 錯誤: ' + e.toString());
    return {
      success: false,
      message: '遷移失敗，請查看日誌'
    };
  }
}

/**
 * ========== 管理端輸入驗證 ==========
 */

var ADMIN_VALID_DISCOUNT_TYPES = ['percentage', 'fixed', 'buyXgetY'];
var ADMIN_MAX_STRING_LENGTH = 200;
var ADMIN_MAX_PRICE = 100000;
var ADMIN_URL_REGEX = /^(https?:\/\/).+/i;

/**
 * 通用管理端輸入驗證
 * @param {Object} data - 使用者輸入資料
 * @param {Object} schema - 驗證規則 { fieldName: { type, required, min, max, pattern } }
 * @returns {Object} { valid: boolean, message: string }
 */
function validateAdminInput(data, schema) {
  data = data || {};
  for (var field in schema) {
    var rule = schema[field];
    var value = data[field];

    if (rule.required) {
      if (value === undefined || value === null || String(value).trim() === '') {
        return { valid: false, message: rule.label + ' 為必填欄位' };
      }
    }

    if (value === undefined || value === null || value === '') continue;

    if (rule.type === 'string') {
      if (typeof value !== 'string') {
        return { valid: false, message: rule.label + ' 必須為文字' };
      }
      var strVal = value.trim();
      if (rule.maxLength && strVal.length > rule.maxLength) {
        return { valid: false, message: rule.label + ' 長度不可超過 ' + rule.maxLength + ' 字' };
      }
      if (rule.pattern && !rule.pattern.test(strVal)) {
        return { valid: false, message: rule.label + ' 格式錯誤' };
      }
    }

    if (rule.type === 'number') {
      var num = parseFloat(value);
      if (!isFinite(num)) {
        return { valid: false, message: rule.label + ' 必須為有效數字' };
      }
      if (rule.min !== undefined && num < rule.min) {
        return { valid: false, message: rule.label + ' 不可小於 ' + rule.min };
      }
      if (rule.max !== undefined && num > rule.max) {
        return { valid: false, message: rule.label + ' 不可大於 ' + rule.max };
      }
    }

    if (rule.type === 'boolean') {
      if (typeof value !== 'boolean' && value !== true && value !== false && value !== 'true' && value !== 'false') {
        return { valid: false, message: rule.label + ' 必須為是/否' };
      }
    }

    if (rule.type === 'enum') {
      if (rule.values && rule.values.indexOf(String(value)) === -1) {
        return { valid: false, message: rule.label + ' 必須為: ' + rule.values.join(', ') };
      }
    }

    if (rule.type === 'url') {
      if (!ADMIN_URL_REGEX.test(String(value).trim())) {
        return { valid: false, message: rule.label + ' 必須為有效的 http/https 網址' };
      }
    }
  }
  return { valid: true, message: '驗證通過' };
}

/**
 * 驗證餐點資料
 */
function validateMenuItemData(data) {
  return validateAdminInput(data, {
    name: { type: 'string', required: true, label: '餐點名稱', maxLength: 80 },
    price: { type: 'number', required: true, label: '價格', min: 0, max: ADMIN_MAX_PRICE },
    description: { type: 'string', required: false, label: '描述', maxLength: ADMIN_MAX_STRING_LENGTH },
    imageUrl: { type: 'url', required: false, label: '圖片網址' }
  });
}

/**
 * 驗證分類資料
 */
function validateCategoryData(data) {
  return validateAdminInput(data, {
    name: { type: 'string', required: true, label: '分類名稱', maxLength: 50 }
  });
}

/**
 * 驗證屬性群組資料
 */
function validateOptionGroupData(data) {
  return validateAdminInput(data, {
    name: { type: 'string', required: true, label: '屬性群組名稱', maxLength: 80 },
    type: { type: 'enum', required: false, label: '類型', values: ['single', 'multiple'] }
  });
}

/**
 * 驗證折扣資料
 */
function validateDiscountData(data) {
  return validateAdminInput(data, {
    name: { type: 'string', required: true, label: '折扣名稱', maxLength: 80 },
    type: { type: 'enum', required: true, label: '折扣類型', values: ADMIN_VALID_DISCOUNT_TYPES },
    value: { type: 'number', required: true, label: '折扣值', min: 0, max: ADMIN_MAX_PRICE }
  });
}

function getOrCreateSheet(ss, sheetName, headers) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
    }
  } else if (sheet.getLastRow() === 0) {
    if (headers && headers.length > 0) {
      sheet.appendRow(headers);
    }
  }
  return sheet;
}

function readSheetAsMap(sheet, keyCol, valueCol) {
  var map = {};
  if (!sheet) return map;
  var rows = readSheetRows(sheet);
  for (var i = 0; i < rows.length; i++) {
    var key = String(rows[i][keyCol] || '');
    if (key) {
      map[key] = rows[i][valueCol];
    }
  }
  return map;
}

function getLastDataRow(sheet) {
  if (!sheet) return 0;
  var lastRow = sheet.getLastRow();
  return Math.max(0, lastRow - 1);
}
