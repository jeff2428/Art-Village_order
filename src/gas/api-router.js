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
        result = {
          success: true,
          data: getOrdersByUserId(spreadsheetId, params.liffUserId)
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
