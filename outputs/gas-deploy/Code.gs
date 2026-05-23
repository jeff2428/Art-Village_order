/**
 * 星空x藝素村點餐系統 - Google Apps Script 部署檔
 * 由 src/gas 模組合併產生。
 * 請整份貼到 Apps Script 的 Code.gs。
 */

/** ===== src/gas/api-router.js ===== */
/**
 * api-router.js
 * GAS Web App API 路由入口
 * 職責：統一 doGet/doPost，依 action 分派到前台、後台與訂單流程
 */

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = normalizeAction(params.action || params.path || 'menu');

  try {
    var spreadsheetId = getSpreadsheetId();
    var result;

    switch (action) {
      case 'menu':
      case 'getMenu':
        result = getFullMenuData(spreadsheetId);
        break;
      case 'announcements':
      case 'getAnnouncements':
        result = {
          success: true,
          data: getAnnouncements(spreadsheetId)
        };
        break;
      case 'schedule':
        result = {
          success: true,
          data: getScheduleData(spreadsheetId)
        };
        break;
      case 'businessHours':
      case 'getBusinessHours':
        result = {
          success: true,
          data: getBusinessHours(spreadsheetId)
        };
        break;
      case 'getOrdersByUserId':
        var liffUserId = params.liffUserId || params.userId;
        result = {
          success: true,
          data: getOrdersByLiffUserId(spreadsheetId, liffUserId)
        };
        break;
      case 'getInitialData':
        result = {
          success: true,
          data: {
            menu: getFullMenuData(spreadsheetId),
            announcements: getAnnouncements(spreadsheetId),
            businessHours: getBusinessHours(spreadsheetId)
          }
        };
        break;
      default:
        result = createUnknownActionResult(action);
    }

    return createJsonResponse(result);
  } catch (err) {
    Logger.log('api-router doGet 錯誤: ' + err.toString());
    return createJsonResponse({
      success: false,
      message: '伺服器錯誤: ' + err.toString()
    });
  }
}

function doPost(e) {
  try {
    var requestData = parseApiRequestData(e);
    var action = normalizeAction(requestData.action || requestData.path);

    switch (action) {
      case 'order':
      case 'submitOrder':
        return createJsonResponse(processOrder(requestData.data || requestData.order || {}));
      case 'sendReservation':
        var resResult = sendReservationNotification(requestData.data || {});
        return createJsonResponse({
          success: resResult.success,
          message: resResult.success ? '訂位通知已送出' : '訂位通知送出失敗'
        });
      case 'sendOrder':
        var orderResult = sendOrderNotificationForCustomer(requestData.data || {});
        return createJsonResponse({
          success: orderResult.success,
          message: orderResult.success ? '訂單通知已送出' : '訂單通知送出失敗'
        });
      default:
        if (typeof handleAdminPost === 'function' && action) {
          return handleAdminPost(e);
        }

        return createJsonResponse(createUnknownActionResult(action || ''));
    }
  } catch (err) {
    Logger.log('api-router doPost 錯誤: ' + err.toString());
    return createJsonResponse({
      success: false,
      message: '伺服器錯誤: ' + err.toString()
    });
  }
}

function getScheduleData(spreadsheetId) {
  return {
    businessHours: getBusinessHours(spreadsheetId),
    holidays: getHolidays(spreadsheetId)
  };
}

function parseApiRequestData(e) {
  if (e && e.postData && e.postData.contents) {
    return JSON.parse(e.postData.contents);
  }

  return (e && e.parameter) || {};
}

function normalizeAction(action) {
  if (!action) return '';
  return String(action).replace(/^\/+/, '').split('/')[0];
}

function createUnknownActionResult(action) {
  return {
    success: false,
    message: '未知的 API action: ' + action
  };
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** ===== src/gas/menu-api.js ===== */
/**
 * menu-api.js
 * 菜單 API 端點模組
 * 職責：提供菜單資料（含分類、客製化選項）
 */

/**
 * GAS Web App GET 端點
 * 處理菜單資料請求
 * 
 * 查詢參數：
 * - action: 'getMenu' | 'getCategories' | 'getMenuByCategory'
 * - category: 分類名稱（當 action='getMenuByCategory' 時需要）
 * 
 * 使用方式：
 * https://script.google.com/macros/s/{SCRIPT_ID}/exec?action=getMenu
 */
function handleMenuGet(e) {
  var params = e.parameter || {};
  var action = params.action || 'getMenu';
  
  try {
    var spreadsheetId = getSpreadsheetId();
    var result;
    
    switch (action) {
      case 'getMenu':
        result = getFullMenuData(spreadsheetId);
        break;
      case 'getCategories':
        result = {
          success: true,
          data: getCategories(spreadsheetId)
        };
        break;
      case 'getMenuByCategory':
        if (!params.category) {
          result = {
            success: false,
            message: '缺少必要參數: category'
          };
        } else {
          result = {
            success: true,
            data: getMenuItemsByCategory(spreadsheetId, params.category)
          };
        }
        break;
      default:
        result = {
          success: false,
          message: '無效的 action: ' + action
        };
    }
    
    return createJsonResponse(result);
    
  } catch (err) {
    Logger.log('menu-api doGet 錯誤: ' + err.toString());
    return createJsonResponse({
      success: false,
      message: '伺服器錯誤: ' + err.toString()
    }, 500);
  }
}

/**
 * 取得完整菜單資料
 * @param {string} spreadsheetId - Google Sheet ID
 * @returns {Object} API 回應物件
 */
function getFullMenuData(spreadsheetId) {
  try {
    var cache = CacheService.getScriptCache();
    var cacheKey = 'fullMenu';
    var cached = cache.get(cacheKey);
    
    if (cached) {
      return {
        success: true,
        data: JSON.parse(cached),
        cached: true
      };
    }
    
    var menuData = getFullMenu(spreadsheetId);
    
    var result = {
      categories: menuData.categories,
      items: menuData.items
    };
    
    cache.put(cacheKey, JSON.stringify(result), 300);
    
    return {
      success: true,
      data: result,
      cached: false
    };
    
  } catch (e) {
    Logger.log('getFullMenuData 錯誤: ' + e.toString());
    throw new Error('取得菜單資料失敗: ' + e.toString());
  }
}

/**
 * 建立 JSON 回應
 * @param {Object} data - 回應資料
 * @param {number} statusCode - HTTP 狀態碼
 * @returns {HtmlOutput} GAS HtmlOutput 物件
 */
/**
 * 取得 Google Sheet ID
 * 可從 ScriptProperties 或硬編碼
 * @returns {string} Spreadsheet ID
 */
function getSpreadsheetId() {
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  
  if (!id) {
    throw new Error('未設定 SPREADSHEET_ID，請於 GAS 專案屬性中設定');
  }
  
  return id;
}

/**
 * 清除菜單快取
 * 用於管理後台更新菜單後呼叫
 */
function clearMenuCache() {
  CacheService.getScriptCache().remove('fullMenu');
}

/**
 * 清除排程快取（營業時間 + 休假）
 * 用於管理後台更新營業時間或休假後呼叫
 */
function clearScheduleCache() {
  var cache = CacheService.getScriptCache();
  cache.remove('businessHours');
  cache.remove('holidays');
  cache.remove('schedule');
}

/**
 * 清除公告快取
 * 用於管理後台更新公告後呼叫
 */
function clearAnnouncementCache() {
  CacheService.getScriptCache().remove('announcements');
}

/**
 * 清除所有快取
 * 用於管理後台大量更新後呼叫
 */
function clearAllCache() {
  var cache = CacheService.getScriptCache();
  cache.remove('fullMenu');
  cache.remove('businessHours');
  cache.remove('holidays');
  cache.remove('schedule');
  cache.remove('announcements');
}

/** ===== src/gas/sheet-menu.js ===== */
/**
 * sheet-menu.js
 * 菜單資料讀取模組
 * 職責：從 Google Sheets 讀取菜單資料（分類、品項、價格、客製化選項）
 */

/**
 * 新版資料表：
 * - Categories: categoryId, name, sortOrder, enabled
 * - Products: productId, categoryId, name, description, price, soldOut, sortOrder, enabled
 * - OptionGroups: groupId, name, type, required, sortOrder, enabled
 * - OptionItems: optionItemId, groupId, name, sortOrder, enabled
 * - ProductOptions: productId, groupId, sortOrder, enabled
 *
 * 若新版資料表不存在，會回退讀取舊版單一「菜單」工作表。
 */

/**
 * 讀取所有啟用中的餐點資料
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} sheetName - 工作表名稱（預設為 "菜單"）
 * @returns {Array<Object>} 餐點資料陣列
 */
function readMenuItems(spreadsheetId, sheetName) {
  sheetName = sheetName || '菜單';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    if (hasNormalizedMenuSheets(ss)) {
      return readNormalizedMenuItems(ss);
    }

    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error('找不到工作表: ' + sheetName);
    }
    
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    var headers = data[0];
    var menuItems = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var item = {
        category: row[0],
        name: row[1],
        price: row[2],
        description: row[3],
        customizationOptions: parseCustomizationOptions(row[4]),
        inStock: row[5] === true || row[5] === 'TRUE',
        enabled: row[6] === true || row[6] === 'TRUE'
      };
      
      if (item.enabled) {
        menuItems.push(item);
      }
    }
    
    return menuItems;
    
  } catch (e) {
    Logger.log('readMenuItems 錯誤: ' + e.toString());
    throw new Error('讀取菜單資料失敗: ' + e.toString());
  }
}

/**
 * 取得所有不重複的分類列表
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} sheetName - 工作表名稱
 * @returns {Array<string>} 分類列表
 */
function getCategories(spreadsheetId, sheetName) {
  sheetName = sheetName || '菜單';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    if (hasNormalizedMenuSheets(ss)) {
      return readNormalizedCategories(ss).map(function(category) {
        return category.name;
      });
    }

    var menuItems = readMenuItems(spreadsheetId, sheetName);
    var categories = [];
    var seen = {};
    
    for (var i = 0; i < menuItems.length; i++) {
      var cat = menuItems[i].category;
      if (cat && !seen[cat]) {
        seen[cat] = true;
        categories.push(cat);
      }
    }
    
    return categories;
    
  } catch (e) {
    Logger.log('getCategories 錯誤: ' + e.toString());
    throw new Error('讀取分類失敗: ' + e.toString());
  }
}

/**
 * 依分類篩選餐點
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} category - 分類名稱
 * @param {string} sheetName - 工作表名稱
 * @returns {Array<Object>} 過濾後的餐點資料
 */
function getMenuItemsByCategory(spreadsheetId, category, sheetName) {
  sheetName = sheetName || '菜單';
  
  try {
    var menuItems = readMenuItems(spreadsheetId, sheetName);
    var filtered = [];
    
    for (var i = 0; i < menuItems.length; i++) {
      if (menuItems[i].category === category) {
        filtered.push(menuItems[i]);
      }
    }
    
    return filtered;
    
  } catch (e) {
    Logger.log('getMenuItemsByCategory 錯誤: ' + e.toString());
    throw new Error('依分類篩選餐點失敗: ' + e.toString());
  }
}

/**
 * 解析客製化選項欄位
 * 支援 JSON 格式或簡單字串格式
 * @param {string|Object} rawData - 原始資料
 * @returns {Array<Object>} 解析後的客製化選項
 */
function parseCustomizationOptions(rawData) {
  if (!rawData || rawData === '') {
    return [];
  }
  
  if (typeof rawData === 'object') {
    return normalizeCustomizationOptions(Array.isArray(rawData) ? rawData : [rawData]);
  }
  
  try {
    var parsed = JSON.parse(rawData);
    return normalizeCustomizationOptions(Array.isArray(parsed) ? parsed : [parsed]);
  } catch (e) {
    Logger.log('parseCustomizationOptions 解析失敗: ' + rawData);
    return [];
  }
}

function normalizeCustomizationOptions(options) {
  return (options || []).map(function(option) {
    if (!option) return null;
    var normalized = {};
    for (var key in option) {
      if (Object.prototype.hasOwnProperty.call(option, key)) {
        normalized[key] = option[key];
      }
    }
    normalized.choices = uniqueStrings(option.choices || []);
    return normalized;
  }).filter(function(option) {
    return option && String(option.name || '').trim();
  });
}

/**
 * 取得完整菜單資料（含分類結構）
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} sheetName - 工作表名稱
 * @returns {Object} { categories: [...], items: [...] }
 */
function getFullMenu(spreadsheetId, sheetName) {
  sheetName = sheetName || '菜單';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var items;
    var categories;

    if (hasNormalizedMenuSheets(ss)) {
      items = readNormalizedMenuItems(ss);
      categories = readNormalizedCategories(ss).map(function(category) {
        return category.name;
      });
    } else {
      items = readMenuItems(spreadsheetId, sheetName);
      categories = getCategories(spreadsheetId, sheetName);
    }
    
    return {
      categories: categories,
      items: items
    };
    
  } catch (e) {
    Logger.log('getFullMenu 錯誤: ' + e.toString());
    throw new Error('取得完整菜單失敗: ' + e.toString());
  }
}

function hasNormalizedMenuSheets(ss) {
  return !!(
    ss.getSheetByName('Categories') &&
    ss.getSheetByName('Products') &&
    ss.getSheetByName('OptionGroups') &&
    ss.getSheetByName('OptionItems') &&
    ss.getSheetByName('ProductOptions')
  );
}

function readNormalizedCategories(ss) {
  var rows = readSheetRows(ss, 'Categories');
  var categories = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!isTruthy(row[3])) continue;

    categories.push({
      id: String(row[0]),
      name: String(row[1] || ''),
      sortOrder: parseNumber(row[2], 0)
    });
  }

  categories.sort(compareBySortThenName);
  return categories;
}

function readNormalizedMenuItems(ss) {
  var categoryMap = {};
  var categories = readNormalizedCategories(ss);
  for (var i = 0; i < categories.length; i++) {
    categoryMap[categories[i].id] = categories[i];
  }

  var optionGroups = readOptionGroups(ss);
  var optionItemsByGroup = readOptionItemsByGroup(ss);
  var productOptionsByProduct = readProductOptionsByProduct(ss);
  var rows = readSheetRows(ss, 'Products');
  var items = [];

  for (var j = 0; j < rows.length; j++) {
    var row = rows[j];
    var productId = String(row[0]);
    var category = categoryMap[String(row[1])];
    var soldOut = isTruthy(row[5]);
    var enabled = isTruthy(row[7]);

    if (!category || !enabled || soldOut) continue;

    items.push({
      id: productId,
      category: category.name,
      categoryId: category.id,
      name: String(row[2] || ''),
      description: String(row[3] || ''),
      price: parseNumber(row[4], 0),
      sortOrder: parseNumber(row[6], 0),
      soldOut: false,
      inStock: true,
      imageUrl: String(row[8] || ''),
      customizationOptions: buildCustomizationOptions(
        productOptionsByProduct[productId] || [],
        optionGroups,
        optionItemsByGroup
      )
    });
  }

  items.sort(function(a, b) {
    if (a.categoryId !== b.categoryId) {
      return compareBySortThenName(categoryMap[a.categoryId], categoryMap[b.categoryId]);
    }
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
  });

  return items;
}

function readOptionGroups(ss) {
  var rows = readSheetRows(ss, 'OptionGroups');
  var groups = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!isTruthy(row[5])) continue;

    groups[String(row[0])] = {
      id: String(row[0]),
      name: String(row[1] || ''),
      type: String(row[2] || 'single'),
      required: isTruthy(row[3]),
      sortOrder: parseNumber(row[4], 0)
    };
  }

  return groups;
}

function readOptionItemsByGroup(ss) {
  var rows = readSheetRows(ss, 'OptionItems');
  var byGroup = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!isTruthy(row[4])) continue;

    var groupId = String(row[1]);
    var itemName = String(row[2] || '').trim();
    if (!itemName) continue;

    if (!byGroup[groupId]) byGroup[groupId] = [];
    byGroup[groupId].push({
      name: itemName,
      sortOrder: parseNumber(row[3], 0)
    });
  }

  for (var key in byGroup) {
    byGroup[key].sort(compareBySortThenName);
    byGroup[key] = dedupeOptionItems(byGroup[key]);
  }

  return byGroup;
}

function readProductOptionsByProduct(ss) {
  var rows = readSheetRows(ss, 'ProductOptions');
  var byProduct = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!isTruthy(row[3])) continue;

    var productId = String(row[0]);
    if (!byProduct[productId]) byProduct[productId] = [];
    byProduct[productId].push({
      groupId: String(row[1]),
      sortOrder: parseNumber(row[2], 0)
    });
  }

  for (var key in byProduct) {
    byProduct[key].sort(compareBySortThenName);
  }

  return byProduct;
}

function buildCustomizationOptions(productOptions, optionGroups, optionItemsByGroup) {
  var options = [];

  for (var i = 0; i < productOptions.length; i++) {
    var group = optionGroups[productOptions[i].groupId];
    if (!group) continue;

    var optionItems = optionItemsByGroup[group.id] || [];
    options.push({
      name: group.name,
      type: group.type,
      required: group.required,
      choices: uniqueStrings(optionItems.map(function(item) {
        return item.name;
      }))
    });
  }

  return options;
}

function readSheetRows(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1);
}

function isTruthy(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
}

function parseNumber(value, defaultValue) {
  var parsed = Number(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function compareBySortThenName(a, b) {
  var aSort = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
  var bSort = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
  if (aSort !== bSort) return aSort - bSort;
  return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
}

function uniqueStrings(values) {
  var seen = {};
  var output = [];
  for (var i = 0; i < (values || []).length; i++) {
    var value = String(values[i] || '').trim();
    if (!value || seen[value]) continue;
    seen[value] = true;
    output.push(value);
  }
  return output;
}

function dedupeOptionItems(items) {
  var seen = {};
  var output = [];
  for (var i = 0; i < (items || []).length; i++) {
    var name = String(items[i].name || '').trim();
    if (!name || seen[name]) continue;
    seen[name] = true;
    output.push({
      name: name,
      sortOrder: items[i].sortOrder
    });
  }
  return output;
}

function getFullMenuState(spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  if (hasNormalizedMenuSheets(ss)) {
    return getNormalizedMenuState(ss);
  }

  var sheet = ss.getSheetByName('菜單');
  
  if (!sheet) {
    return { categories: [], options: [], items: [] };
  }
  
  var data = sheet.getDataRange().getValues();
  var items = [];
  var categoriesSet = {};
  var categories = [];
  var globalOptionsMap = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var category = row[0];
    var name = row[1];
    var price = row[2];
    var desc = row[3];
    var opts = parseCustomizationOptions(row[4]);
    var inStock = row[5] === true || row[5] === 'TRUE';
    var enabled = row[6] === true || row[6] === 'TRUE';
    var imageUrl = row[7] || '';
    
    // 如果品名為空，可能是用來佔位儲存獨立的分類或選項
    if (name) {
      items.push({
        id: 'item_' + i,
        category: category,
        name: name,
        price: price,
        description: desc,
        customizationOptions: opts,
        inStock: inStock,
        enabled: enabled,
        imageUrl: imageUrl
      });
    }
    
    if (category && !categoriesSet[category]) {
      categoriesSet[category] = true;
      categories.push({ id: 'cat_' + i, name: category });
    }
    
    // 收集獨立的 Global Options (若有人只寫在品名為空的行，或從商品中抽取)
    opts.forEach(function(opt) {
      var key = opt.name;
      if (!globalOptionsMap[key]) {
        globalOptionsMap[key] = {
          id: 'opt_' + i + '_' + key,
          name: opt.name,
          type: opt.type || 'single',
          required: opt.required || false,
          choices: uniqueStrings(opt.choices || [])
        };
      } else {
        // 合併選項
        uniqueStrings(opt.choices || []).forEach(function(c) {
          if (globalOptionsMap[key].choices.indexOf(c) === -1) {
            globalOptionsMap[key].choices.push(c);
          }
        });
      }
    });
  }
  
  var options = [];
  for (var k in globalOptionsMap) {
    options.push(globalOptionsMap[k]);
  }
  
  return {
    categories: categories,
    options: options,
    items: items
  };
}

function updateFullMenuState(spreadsheetId, menuState) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    if (hasNormalizedMenuSheets(ss) || ss.getSheetByName('Categories') || ss.getSheetByName('Products')) {
      return updateNormalizedMenuState(ss, menuState);
    }

    var sheet = ss.getSheetByName('菜單');
    if (!sheet) {
      sheet = ss.insertSheet('菜單');
    }
    
    sheet.clear();
    var rows = [['分類', '品名', '價格', '描述', '客製化選項', '庫存狀態', '啟用狀態', '圖片網址']];
    
    var items = menuState.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var optsStr = Array.isArray(item.customizationOptions) ? JSON.stringify(item.customizationOptions) : '[]';
      rows.push([
        item.category || '',
        item.name || '',
        item.price || 0,
        item.description || '',
        optsStr,
        item.hasOwnProperty('inStock') ? item.inStock : true,
        item.hasOwnProperty('enabled') ? item.enabled : true,
        item.imageUrl || ''
      ]);
    }
    appendSheetRows(sheet, rows);
    
    // 清除快取
    CacheService.getScriptCache().remove('fullMenu');
    
    return { success: true, message: '菜單已全面更新' };
  } catch (e) {
    Logger.log('updateFullMenuState 錯誤: ' + e.toString());
    return { success: false, message: '菜單更新失敗: ' + e.toString() };
  }
}

function getNormalizedMenuState(ss) {
  var categoryRows = readSheetRows(ss, 'Categories');
  var categories = [];
  var categoryMap = {};

  for (var i = 0; i < categoryRows.length; i++) {
    var categoryRow = categoryRows[i];
    var category = {
      id: String(categoryRow[0] || ''),
      name: String(categoryRow[1] || ''),
      sortOrder: parseNumber(categoryRow[2], (i + 1) * 10),
      enabled: categoryRow[3] === undefined ? true : isTruthy(categoryRow[3])
    };
    if (!category.id && category.name) category.id = makeMenuId('cat', category.name, i);
    if (!category.name) continue;
    categories.push(category);
    categoryMap[category.id] = category;
  }
  categories.sort(compareBySortThenName);

  var optionGroups = readAllOptionGroups(ss);
  var optionItemsByGroup = readOptionItemsByGroup(ss);
  var options = [];
  for (var groupId in optionGroups) {
    var group = optionGroups[groupId];
    var groupItems = optionItemsByGroup[groupId] || [];
    options.push({
      id: group.id,
      name: group.name,
      type: group.type,
      required: group.required,
      sortOrder: group.sortOrder,
      enabled: group.enabled,
      choices: uniqueStrings(groupItems.map(function(item) { return item.name; }))
    });
  }
  options.sort(compareBySortThenName);

  var productOptionsByProduct = readProductOptionsByProduct(ss);
  var productRows = readSheetRows(ss, 'Products');
  var items = [];

  for (var j = 0; j < productRows.length; j++) {
    var productRow = productRows[j];
    var productId = String(productRow[0] || '');
    var categoryId = String(productRow[1] || '');
    var productOptionLinks = productOptionsByProduct[productId] || [];

    if (!productId && productRow[2]) productId = makeMenuId('item', productRow[2], j);

    items.push({
      id: productId,
      category: categoryMap[categoryId] ? categoryMap[categoryId].name : '',
      categoryId: categoryId,
      name: String(productRow[2] || ''),
      description: String(productRow[3] || ''),
      price: parseNumber(productRow[4], 0),
      soldOut: isTruthy(productRow[5]),
      inStock: !isTruthy(productRow[5]),
      sortOrder: parseNumber(productRow[6], (j + 1) * 10),
      enabled: productRow[7] === undefined ? true : isTruthy(productRow[7]),
      imageUrl: String(productRow[8] || ''),
      customizationOptions: buildCustomizationOptions(productOptionLinks, optionGroups, optionItemsByGroup)
    });
  }
  items.sort(function(a, b) {
    if (a.categoryId !== b.categoryId && categoryMap[a.categoryId] && categoryMap[b.categoryId]) {
      return compareBySortThenName(categoryMap[a.categoryId], categoryMap[b.categoryId]);
    }
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
  });

  return {
    categories: categories,
    options: options,
    items: items
  };
}

function readAllOptionGroups(ss) {
  var rows = readSheetRows(ss, 'OptionGroups');
  var groups = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var groupId = String(row[0] || '');
    if (!groupId && row[1]) groupId = makeMenuId('opt', row[1], i);

    groups[groupId] = {
      id: groupId,
      name: String(row[1] || ''),
      type: String(row[2] || 'single'),
      required: isTruthy(row[3]),
      sortOrder: parseNumber(row[4], (i + 1) * 10),
      enabled: row[5] === undefined ? true : isTruthy(row[5])
    };
  }

  return groups;
}

function updateNormalizedMenuState(ss, menuState) {
  var categories = menuState.categories || [];
  var options = menuState.options || [];
  var items = menuState.items || [];
  var categoryIdByName = {};
  var optionIdByName = {};

  var categoryRows = [['categoryId', 'name', 'sortOrder', 'enabled']];
  for (var i = 0; i < categories.length; i++) {
    var category = categories[i];
    var categoryId = category.id || makeMenuId('cat', category.name, i);
    categoryIdByName[category.name] = categoryId;
    categoryRows.push([
      categoryId,
      category.name || '',
      category.sortOrder !== undefined ? category.sortOrder : (i + 1) * 10,
      category.enabled !== false
    ]);
  }

  var optionGroupRows = [['groupId', 'name', 'type', 'required', 'sortOrder', 'enabled']];
  var optionItemRows = [['optionItemId', 'groupId', 'name', 'sortOrder', 'enabled']];
  for (var j = 0; j < options.length; j++) {
    var option = options[j];
    var optionId = option.id || makeMenuId('opt', option.name, j);
    optionIdByName[option.name] = optionId;
    optionGroupRows.push([
      optionId,
      option.name || '',
      option.type || 'single',
      option.required === true,
      option.sortOrder !== undefined ? option.sortOrder : (j + 1) * 10,
      option.enabled !== false
    ]);

    var choices = uniqueStrings(option.choices || []);
    for (var k = 0; k < choices.length; k++) {
      optionItemRows.push([
        makeMenuId('choice', optionId + '-' + choices[k], k),
        optionId,
        choices[k],
        (k + 1) * 10,
        true
      ]);
    }
  }

  var productRows = [['productId', 'categoryId', 'name', 'description', 'price', 'soldOut', 'sortOrder', 'enabled', 'imageUrl']];
  var productOptionRows = [['productId', 'groupId', 'sortOrder', 'enabled']];
  for (var p = 0; p < items.length; p++) {
    var item = items[p];
    var productId = item.id || makeMenuId('item', item.name, p);
    var categoryId = item.categoryId || categoryIdByName[item.category] || '';
    var soldOut = item.soldOut === true || item.inStock === false;

    productRows.push([
      productId,
      categoryId,
      item.name || '',
      item.description || '',
      parseNumber(item.price, 0),
      soldOut,
      item.sortOrder !== undefined ? item.sortOrder : (p + 1) * 10,
      item.enabled !== false,
      item.imageUrl || ''
    ]);

    var itemOptions = item.customizationOptions || [];
    for (var q = 0; q < itemOptions.length; q++) {
      var itemOption = itemOptions[q];
      var groupId = itemOption.id || optionIdByName[itemOption.name];
      if (!groupId) continue;
      productOptionRows.push([
        productId,
        groupId,
        (q + 1) * 10,
        true
      ]);
    }
  }

  replaceSheetValues(ss, 'Categories', categoryRows);
  replaceSheetValues(ss, 'Products', productRows);
  replaceSheetValues(ss, 'OptionGroups', optionGroupRows);
  replaceSheetValues(ss, 'OptionItems', optionItemRows);
  replaceSheetValues(ss, 'ProductOptions', productOptionRows);
  clearMenuCache();

  return { success: true, message: '菜單已全面更新' };
}

function replaceSheetValues(ss, sheetName, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clear();
  appendSheetRows(sheet, rows);
}

function appendSheetRows(sheet, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function makeMenuId(prefix, value, index) {
  var base = String(value || 'item')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-');
  if (!base) base = 'item';
  return prefix + '-' + base + '-' + (index + 1);
}

/** ===== src/gas/sheet-config.js ===== */
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

/** ===== src/gas/order-validator.js ===== */
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

/** ===== src/gas/discount-calculator.js ===== */
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
      message: '新增折扣失敗: ' + e.toString()
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

/** ===== src/gas/order-processor.js ===== */
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
        message: '訂單儲存失敗: ' + writeResult.message
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
      message: '訂單處理失敗: ' + e.toString()
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

/** ===== src/gas/sheet-order.js ===== */
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

/**
 * 依 LIFF userId 查詢訂單（客戶端用）
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} liffUserId - LINE userId
 * @returns {Array<Object>} 訂單資料陣列
 */
function getOrdersByLiffUserId(spreadsheetId, liffUserId) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var ordersSheet = ss.getSheetByName('Orders');
    
    if (!ordersSheet) {
      return [];
    }
    
    var data = ordersSheet.getDataRange().getValues();
    var orderItemsSheet = ss.getSheetByName('OrderItems');
    
    var itemsByOrderId = {};
    if (orderItemsSheet) {
      var itemData = orderItemsSheet.getDataRange().getValues();
      for (var i = 1; i < itemData.length; i++) {
        var orderId = itemData[i][0];
        if (!itemsByOrderId[orderId]) itemsByOrderId[orderId] = [];
        itemsByOrderId[orderId].push({
          name: itemData[i][1],
          quantity: itemData[i][2],
          price: itemData[i][3],
          customizationDetails: itemData[i][4],
          lineTotal: itemData[i][5]
        });
      }
    }
    
    var orders = [];
    for (var j = 1; j < data.length; j++) {
      var row = data[j];
      if (row[2] === liffUserId) {
        orders.push({
          orderId: row[0],
          timestamp: row[1],
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
    }
    
    return orders;
    
  } catch (e) {
    Logger.log('getOrdersByLiffUserId 錯誤: ' + e.toString());
    return [];
  }
}

/**
 * 發送訂位通知至 LINE 群組
 * @param {Object} data - 訂位資料
 * @returns {Object} 發送結果
 */
function sendReservationNotification(data) {
  var message = '📋 新訂位通知\n' +
    '━━━━━━━━━━━━━━━\n' +
    '訂位代表：' + (data.representative || '未填寫') + '\n' +
    '訂位人：' + (data.customerName || '未填寫') + '\n' +
    '電話：' + (data.phone || '未填寫') + '\n' +
    '人數：' + (data.guestCount || '?') + '人\n' +
    '日期：' + (data.diningDate || '未填寫') + '\n' +
    '時間：' + (data.diningTime || '未填寫');
  
  return sendLineMessage(message);
}

/**
 * 發送訂單通知至 LINE 群組（含備註）
 * @param {Object} data - 訂單資料
 * @returns {Object} 發送結果
 */
function sendOrderNotificationForCustomer(data) {
  var itemsText = '';
  if (data.items && data.items.length > 0) {
    var itemLines = [];
    for (var i = 0; i < data.items.length; i++) {
      var item = data.items[i];
      var line = '  ' + item.name + ' x' + item.quantity;
      if (item.customizations && item.customizations.length > 0) {
        var customText = item.customizations.map(function(c) {
          return c.optionName + ': ' + c.selectedValue;
        }).join(' / ');
        line += '\n    選項：' + customText;
      }
      if (item.note) {
        line += '\n    備註：' + item.note;
      }
      itemLines.push(line);
    }
    itemsText = itemLines.join('\n\n');
  }
  
  var message = '🍽️ 新訂單通知\n' +
    '━━━━━━━━━━━━━━━\n' +
    '訂單編號：' + (data.orderId || '未產生') + '\n' +
    '訂位代表：' + (data.representative || '未填寫') + '\n' +
    '訂位人：' + (data.customerName || '未填寫') + '\n' +
    '電話：' + (data.phone || '未填寫') + '\n' +
    '人數：' + (data.guestCount || '?') + '人\n' +
    '日期：' + (data.diningDate || '未填寫') + '\n' +
    '時間：' + (data.diningTime || '未填寫') + '\n\n' +
    '餐點明細：\n' + itemsText;
  
  return sendLineMessage(message);
}

/** ===== src/gas/line-bot.js ===== */
/**
 * line-bot.js
 * LINE Bot 推播模組
 * 職責：透過 LINE Messaging API 將訂單推播至內部群組
 */

/**
 * 發送訊息至 LINE 群組
 * @param {string} message - 訊息內容
 * @returns {Object} 發送結果
 */
function sendLineMessage(message) {
  try {
    var channelAccessToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    var groupId = PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID');
    
    if (!channelAccessToken) {
      throw new Error('未設定 LINE_CHANNEL_ACCESS_TOKEN');
    }
    
    if (!groupId) {
      throw new Error('未設定 LINE_GROUP_ID');
    }
    
    var url = 'https://api.line.me/v2/bot/message/push';
    
    var payload = {
      to: groupId,
      messages: [
        {
          type: 'text',
          text: message
        }
      ]
    };
    
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + channelAccessToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      Logger.log('LINE 推播成功');
      return {
        success: true,
        message: '推播成功'
      };
    } else {
      var errorBody = response.getContentText();
      Logger.log('LINE 推播失敗 (' + responseCode + '): ' + errorBody);
      return {
        success: false,
        message: '推播失敗 (' + responseCode + '): ' + errorBody
      };
    }
    
  } catch (e) {
    Logger.log('sendLineMessage 錯誤: ' + e.toString());
    return {
      success: false,
      message: '推播異常: ' + e.toString()
    };
  }
}

/**
 * 發送多則訊息
 * @param {Array<Object>} messages - 訊息陣列 [{ type: 'text', text: '...' }]
 * @returns {Object} 發送結果
 */
function sendLineMultipleMessages(messages) {
  try {
    var channelAccessToken = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
    var groupId = PropertiesService.getScriptProperties().getProperty('LINE_GROUP_ID');
    
    if (!channelAccessToken || !groupId) {
      throw new Error('未設定 LINE 憑證');
    }
    
    var url = 'https://api.line.me/v2/bot/message/push';
    
    var payload = {
      to: groupId,
      messages: messages
    };
    
    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + channelAccessToken,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    var responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      Logger.log('LINE 多則訊息推播成功');
      return { success: true };
    } else {
      Logger.log('LINE 多則訊息推播失敗: ' + response.getContentText());
      return { success: false, message: response.getContentText() };
    }
    
  } catch (e) {
    Logger.log('sendLineMultipleMessages 錯誤: ' + e.toString());
    return { success: false, message: e.toString() };
  }
}

/**
 * 發送 Flex Message（進階排版）
 * @param {Object} flexContent - Flex Message 內容
 * @returns {Object} 發送結果
 */
function sendLineFlexMessage(flexContent) {
  var message = {
    type: 'flex',
    altText: flexContent.altText || '新訂單通知',
    contents: flexContent.contents
  };
  
  return sendLineMultipleMessages([message]);
}

/**
 * 測試推播功能
 * 發送測試訊息至群組
 * @returns {Object} 測試結果
 */
function testLinePush() {
  var testMessage = '🔔 系統測試\n\n這是一則測試訊息，推播功能正常運作。';
  return sendLineMessage(testMessage);
}

/** ===== src/gas/employee-auth.js ===== */
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

function deleteEmployee(spreadsheetId, data) {
  try {
    data = data || {};
    var employeeId = sanitizeEmployeeText(data.employeeId, 80);
    if (!employeeId) {
      return { success: false, message: '請指定員工 ID' };
    }

    var ss = SpreadsheetApp.openById(spreadsheetId);
    var sheet = ensureEmployeeSheet(ss);
    var sheetData = sheet.getDataRange().getValues();
    var headers = ensureEmployeeHeaders(sheet, sheetData[0] || []);

    for (var i = 1; i < sheetData.length; i++) {
      if (employeeCell(sheetData[i], headers, 'employeeId') === employeeId) {
        var employeeName = sanitizeEmployeeText(employeeCell(sheetData[i], headers, 'name'), 80);
        sheet.deleteRow(i + 1);

        if (typeof logAction === 'function') {
          logAction(spreadsheetId, 'system', 'deleteEmployee', 'employee', {
            targetType: 'employee',
            targetId: employeeId,
            beforeJson: { employeeId: employeeId, name: employeeName }
          });
        }

        return {
          success: true,
          message: '已刪除員工: ' + (employeeName || employeeId)
        };
      }
    }

    return {
      success: false,
      message: '找不到員工: ' + employeeId
    };

  } catch (e) {
    Logger.log('deleteEmployee 錯誤: ' + e.toString());
    return {
      success: false,
      message: '刪除員工失敗'
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

/** ===== src/gas/admin-api.js ===== */
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

