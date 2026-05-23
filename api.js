/**
 * api.js
 * 前端 API 串接模組
 * 職責：與 GAS 後端 API 通訊
 */

var Api = (function() {
  'use strict';
  
  var GAS_API_URL = (window.ART_VILLAGE_CONFIG && window.ART_VILLAGE_CONFIG.GAS_API_URL) || '';
  var NETWORK_RETRY_DELAY_MS = 600;
  var CACHE_TTL_MS = 5 * 60 * 1000; // 5 分鐘

  function cacheGet(key) {
    try {
      var raw = localStorage.getItem('av_cache_' + key);
      if (!raw) return null;
      var entry = JSON.parse(raw);
      if (Date.now() - entry.t < CACHE_TTL_MS) return entry.d;
      localStorage.removeItem('av_cache_' + key);
    } catch (e) {}
    return null;
  }

  function cacheSet(key, data) {
    try {
      localStorage.setItem('av_cache_' + key, JSON.stringify({ d: data, t: Date.now() }));
    } catch (e) {}
  }

  function fetchWithCache(url, cacheKey, errorMsg) {
    var cached = cacheGet(cacheKey);
    if (cached) {
      setTimeout(function() {
        fetch(url).then(function(r) { return r.json(); }).then(function(j) {
          if (j && j.success) cacheSet(cacheKey, j.data || j);
        }).catch(function() {});
      }, 0);
      return Promise.resolve(cached);
    }
    return fetchWithRetry(url).then(handleJsonResponse(errorMsg || '請求失敗')).then(function(data) {
      cacheSet(cacheKey, data);
      return data;
    });
  }

  function wait(ms) {
    return new Promise(function(resolve) {
      setTimeout(resolve, ms);
    });
  }

  function isNetworkError(err) {
    return err && (err.name === 'TypeError' || err.name === 'AbortError');
  }

  function createNetworkError(err) {
    var originalMessage = err && err.message ? err.message : 'unknown network error';
    return new Error('無法連線到後端 API，請確認 GAS Web App URL 已重新部署、開放「任何人」存取，且部署更新已完成傳播。原始錯誤: ' + originalMessage);
  }

  function fetchWithRetry(url, options) {
    return fetch(url, options).catch(function(err) {
      if (!isNetworkError(err)) throw err;

      return wait(NETWORK_RETRY_DELAY_MS).then(function() {
        return fetch(url, options).catch(function(retryErr) {
          throw createNetworkError(retryErr);
        });
      });
    });
  }

  function handleJsonResponse(defaultMessage) {
    return function(res) {
      return res.json().catch(function() {
        throw new Error('API 回傳不是 JSON，請確認 GAS Web App URL 指向有效的 /exec 部署。');
      }).then(function(data) {
        if (res.ok && data.success) {
          return data.data !== undefined ? data.data : data;
        }
        throw new Error((data && (data.message || data.error)) || defaultMessage);
      });
    };
  }
  
  /**
   * 取得菜單資料
   * @returns {Promise<Object>} 菜單資料
   */
  function getMenu() {
    return fetchWithCache(GAS_API_URL + '?action=getMenu', 'menu');
  }

  function getInitialData() {
    return fetchWithCache(GAS_API_URL + '?action=getInitialData', 'initialData');
  }

  /**
   * 送出訂單
   * @param {Object} orderData - 訂單資料
   * @returns {Promise<Object>} 訂單結果
   */
  function submitOrder(orderData) {
    return fetchWithRetry(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'submitOrder',
        data: orderData
      })
    })
    .then(handleJsonResponse('訂單送出失敗'));
  }

  /**
   * 取得公告設定
   * @returns {Promise<Object>} 公告資料
   */
  function getAnnouncements() {
    return fetchWithCache(GAS_API_URL + '?action=getAnnouncements', 'announcements', '取得公告失敗');
  }

  function getBusinessHours() {
    return fetchWithCache(GAS_API_URL + '?action=getBusinessHours', 'hours', '取得營業時間失敗');
  }

  /**
   * 取得個人訂單（依 LIFF userId）
   * @param {Object} data - { liffUserId: string }
   * @returns {Promise<Object>} 訂單資料陣列
   */
  function getOrdersByUserId(data) {
    var idToken = LiffAuth.getIdToken();
    return fetchWithRetry(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'getOrdersByUserId',
        liffUserId: data.liffUserId,
        idToken: idToken
      })
    }).then(handleJsonResponse('取得訂單失敗'));
  }

  /**
   * 將訂位資料傳到 LINE 群組
   * @param {Object} data - 訂位資料
   * @returns {Promise<Object>} 結果
   */
  function sendReservationToLine(data) {
    return fetchWithRetry(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sendReservation',
        data: data
      })
    })
    .then(handleJsonResponse('訂位通知送出失敗'));
  }

  /**
   * 將訂單資料傳到 LINE 群組
   * @param {Object} data - 訂單資料
   * @returns {Promise<Object>} 結果
   */
  function sendOrderToLine(data) {
    return fetchWithRetry(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'sendOrder',
        data: data
      })
    })
    .then(handleJsonResponse('訂單通知送出失敗'));
  }

  return {
    getMenu: getMenu,
    getInitialData: getInitialData,
    submitOrder: submitOrder,
    getAnnouncements: getAnnouncements,
    getBusinessHours: getBusinessHours,
    getOrdersByUserId: getOrdersByUserId,
    sendReservationToLine: sendReservationToLine,
    sendOrderToLine: sendOrderToLine
  };
})();
