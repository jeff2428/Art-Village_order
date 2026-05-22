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
