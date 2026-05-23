/**
 * api.js
 * 前端 API 串接模組
 * 職責：與 GAS 後端 API 通訊
 */

var Api = (function() {
  'use strict';
  
  var GAS_API_URL = (window.ART_VILLAGE_CONFIG && window.ART_VILLAGE_CONFIG.GAS_API_URL) || '';
  var NETWORK_RETRY_DELAY_MS = 600;

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
    return fetchWithRetry(GAS_API_URL + '?action=getMenu')
      .then(handleJsonResponse('取得菜單失敗'));
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
    return fetchWithRetry(GAS_API_URL + '?action=getAnnouncements')
      .then(handleJsonResponse('取得公告失敗'));
  }

  /**
    * 取得營業時間
    * @returns {Promise<Object>} 營業時間
    */
   function getBusinessHours() {
     return fetchWithRetry(GAS_API_URL + '?action=getBusinessHours')
       .then(handleJsonResponse('取得營業時間失敗'));
   }

   /**
    * 取得營業排程（含休假日期）
    * @returns {Promise<Object>} { businessHours, holidays }
    */
   function getSchedule() {
     return fetchWithRetry(GAS_API_URL + '?action=schedule')
       .then(handleJsonResponse('取得營業資訊失敗'));
   }

   return {
     getMenu: getMenu,
     submitOrder: submitOrder,
     getAnnouncements: getAnnouncements,
     getBusinessHours: getBusinessHours,
     getSchedule: getSchedule
   };
})();
