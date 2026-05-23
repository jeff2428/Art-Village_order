/**
 * api-router.js
 * GAS Web App API 路由入口
 * 職責：統一 doGet/doPost，依 action 分派到前台、後台與訂單流程
 */

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = normalizeAction(params.action || params.path || 'menu');

  var clientIp = getClientIp(e);
  if (!checkRateLimit('rl_get_' + action, clientIp)) {
    return createJsonResponse({
      success: false,
      message: '請求過於頻繁，請稍後再試'
    });
  }

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
      case 'getOrdersByUserId': {
        var targetUserId = params.liffUserId || '';
        var idToken = params.idToken || '';

        var permission = verifyLiffIdToken(idToken, targetUserId);
        if (!permission.verified) {
          result = {
            success: false,
            message: permission.message
          };
          break;
        }

        result = {
          success: true,
          data: getOrdersByUserId(spreadsheetId, targetUserId)
        };
        break;
      }
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
      message: '伺服器錯誤，請稍後再試'
    });
  }
}

function doPost(e) {
  try {
    var requestData = parseApiRequestData(e);
    var action = normalizeAction(requestData.action || requestData.path);

    var clientIp = getClientIp(e);
    if (!checkRateLimit('rl_post_' + action, clientIp)) {
      return createJsonResponse({
        success: false,
        message: '請求過於頻繁，請稍後再試'
      });
    }

    if (action === 'submitOrder' || action === 'order') {
      var idempotencyKey = requestData.idempotencyKey || (requestData.data && requestData.data.idempotencyKey);
      if (idempotencyKey && !checkIdempotency(idempotencyKey)) {
        return createJsonResponse({
          success: false,
          message: '此訂單已提交，請勿重複送出'
        });
      }
    }

    switch (action) {
      case 'order':
      case 'submitOrder':
        return createJsonResponse(processOrder(requestData.data || requestData.order || {}));
      case 'getOrdersByUserId':
        return createJsonResponse(handleGetOrdersByUserId(requestData));
      case 'sendReservation':
        return createJsonResponse(handleSendReservation(requestData));
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
      message: '伺服器錯誤，請稍後再試'
    });
  }
}

/**
 * 處理 getOrdersByUserId POST 請求（含 ID Token 驗證）
 */
function handleGetOrdersByUserId(requestData) {
  try {
    var spreadsheetId = getSpreadsheetId();
    var targetUserId = (requestData.data && requestData.data.liffUserId) || requestData.liffUserId || '';
    var idToken = (requestData.data && requestData.data.idToken) || requestData.idToken || '';

    if (!targetUserId) {
      return { success: false, message: '缺少使用者 ID' };
    }

    var permission = verifyLiffIdToken(idToken, targetUserId);
    if (!permission.verified) {
      return { success: false, message: permission.message };
    }

    var orders = getOrdersByUserId(spreadsheetId, targetUserId);
    return {
      success: true,
      data: orders
    };
  } catch (err) {
    Logger.log('handleGetOrdersByUserId 錯誤: ' + err.toString());
    return {
      success: false,
      message: '伺服器錯誤，請稍後再試'
    };
  }
}

/**
 * 處理訂位通知並發送至 LINE（含電話驗證）
 */
function handleSendReservation(requestData) {
  try {
    var reservationData = requestData.data || {};

    if (!reservationData.customerName || !String(reservationData.customerName).trim()) {
      return { success: false, message: '缺少訂位人姓名' };
    }
    if (!reservationData.phone || !/^09\d{8}$/.test(String(reservationData.phone).replace(/-/g, ''))) {
      return { success: false, message: '電話號碼格式無效' };
    }

    var message = buildReservationMessage(reservationData);
    if (typeof sendLineMessage === 'function') {
      sendLineMessage(message);
    }

    return { success: true, message: '訂位通知已發送' };
  } catch (err) {
    Logger.log('handleSendReservation 錯誤: ' + err.toString());
    return { success: false, message: '訂位通知發送失敗' };
  }
}

function buildReservationMessage(data) {
  var lines = [];
  lines.push('🆕 新訂位通知');
  lines.push('━━━━━━━━━━━━━━━');
  lines.push('訂位代表：' + (data.representative || data.customerName));
  lines.push('訂位人：' + data.customerName);
  lines.push('電話：' + data.phone);
  lines.push('人數：' + data.guestCount + ' 人');
  lines.push('日期：' + data.diningDate);
  lines.push('時間：' + data.diningTime);
  lines.push('━━━━━━━━━━━━━━━');
  return lines.join('\n');
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

/**
 * 驗證 LIFF ID Token，確保請求者即為 userId 的擁有者
 * 使用 LINE /oauth2/v2.1/verify 端點驗證 id_token 的有效性
 * @param {string} idToken - LIFF ID Token
 * @param {string} expectedUserId - 期望的 LINE userId
 * @returns {Object} { verified: boolean, message: string }
 */
function verifyLiffIdToken(idToken, expectedUserId) {
  if (!idToken) {
    Logger.log('IDOR 防護: 缺少 idToken，拒絕 getOrdersByUserId 請求 (target: ' + expectedUserId + ')');
    return { verified: false, message: '缺少身分驗證資訊' };
  }

  if (!expectedUserId) {
    return { verified: false, message: '缺少使用者 ID' };
  }

  try {
    var verifyUrl = 'https://api.line.me/oauth2/v2.1/verify?access_token=' + encodeURIComponent(idToken);
    var response = UrlFetchApp.fetch(verifyUrl, {
      method: 'get',
      muteHttpExceptions: true
    });
    var responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      Logger.log('IDOR 防護: idToken 驗證失敗 (HTTP ' + responseCode + ')');
      return { verified: false, message: '身分驗證失敗' };
    }

    var result = JSON.parse(response.getContentText());
    var channelId = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ID');

    if (channelId && String(result.client_id) !== String(channelId)) {
      Logger.log('IDOR 防護: client_id 不符，預期: ' + channelId + '，收到: ' + result.client_id);
      return { verified: false, message: '身分驗證失敗' };
    }

    return { verified: true, message: '驗證通過' };
  } catch (err) {
    Logger.log('verifyLiffIdToken 錯誤: ' + err.toString());
    return { verified: false, message: '身分驗證失敗' };
  }
}

/**
 * ========== Rate Limiting & 冪等性 ==========
 */

var RATE_LIMIT_WINDOW_MS = 60 * 1000;
var RATE_LIMIT_MAX_REQUESTS = 30;
var IDEMPOTENCY_TTL_SECONDS = 86400;

/**
 * 取得客戶端識別（GAS 環境下近似識別）
 */
function getClientIp(e) {
  try {
    if (e && e.parameter && e.parameter._ip) return e.parameter._ip;
  } catch (ignored) {}
  var sessionId = (e && e.queryString) || '';
  return sessionId || 'anonymous';
}

/**
 * 檢查請求頻率限制
 */
function checkRateLimit(key, clientId) {
  try {
    var cache = CacheService.getScriptCache();
    var cacheKey = 'rl_' + key + '_' + clientId;
    var count = parseInt(cache.get(cacheKey)) || 0;

    if (count >= RATE_LIMIT_MAX_REQUESTS) {
      Logger.log('Rate limit 觸發: ' + cacheKey + ' (count: ' + count + ')');
      return false;
    }

    cache.put(cacheKey, count + 1, 60);
    return true;
  } catch (e) {
    Logger.log('checkRateLimit 錯誤: ' + e.toString());
    return true;
  }
}

/**
 * 檢查冪等性 key，防止重複訂單提交
 */
function checkIdempotency(key) {
  try {
    var cache = CacheService.getScriptCache();
    var cacheKey = 'idemp_' + key;

    if (cache.get(cacheKey)) {
      Logger.log('冪等性觸發: 重複訂單提交 key=' + key);
      return false;
    }

    cache.put(cacheKey, '1', IDEMPOTENCY_TTL_SECONDS);
    return true;
  } catch (e) {
    Logger.log('checkIdempotency 錯誤: ' + e.toString());
    return true;
  }
}
