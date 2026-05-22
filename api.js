/**
 * api.js
 * 前端 API 串接模組
 * 職責：與 GAS 後端 API 通訊
 */

var Api = (function() {
  'use strict';
  
  var GAS_API_URL = (window.ART_VILLAGE_CONFIG && window.ART_VILLAGE_CONFIG.GAS_API_URL) || '';

  function handleJsonResponse(defaultMessage) {
    return function(res) {
      return res.json().then(function(data) {
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
    return fetch(GAS_API_URL + '?action=getMenu')
      .then(handleJsonResponse('取得菜單失敗'));
  }

  /**
   * 送出訂單
   * @param {Object} orderData - 訂單資料
   * @returns {Promise<Object>} 訂單結果
   */
  function submitOrder(orderData) {
    return fetch(GAS_API_URL, {
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
    return fetch(GAS_API_URL + '?action=getAnnouncements')
      .then(handleJsonResponse('取得公告失敗'));
  }

  /**
   * 取得營業時間
   * @returns {Promise<Object>} 營業時間
   */
  function getBusinessHours() {
    return fetch(GAS_API_URL + '?action=getBusinessHours')
      .then(handleJsonResponse('取得營業時間失敗'));
  }

  return {
    getMenu: getMenu,
    submitOrder: submitOrder,
    getAnnouncements: getAnnouncements,
    getBusinessHours: getBusinessHours
  };
})();
