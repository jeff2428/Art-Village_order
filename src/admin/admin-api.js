/**
 * admin-api.js
 * 管理後台 API 串接模組
 */

var AdminApi = (function() {
  'use strict';
  
  var ADMIN_CONFIG = window.ART_VILLAGE_ADMIN_CONFIG || {};
  var GAS_API_URL = ADMIN_CONFIG.GAS_API_URL || '';
  var ADMIN_TOKEN = ADMIN_CONFIG.ADMIN_TOKEN || '';
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

  function call(action, data) {
    return fetchWithRetry(GAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: action, data: data, adminToken: ADMIN_TOKEN })
    })
    .then(function(res) {
      return res.json().catch(function() {
        throw new Error('API 回傳不是 JSON，請確認 GAS Web App URL 指向有效的 /exec 部署。');
      }).then(function(result) {
        if (res.ok && result.success) return result;
        throw new Error(result.message || result.error || '操作失敗');
      });
    });
  }

  return {
    call: call,
    getMenuItems: function() { return call('getMenuItems'); },
    addMenuItem: function(data) { return call('addMenuItem', data); },
    updateMenuItem: function(data) { return call('updateMenuItem', data); },
    deleteMenuItem: function(data) { return call('deleteMenuItem', data); },
    getBusinessHours: function() { return call('getBusinessHours'); },
    updateBusinessHours: function(data) { return call('updateBusinessHours', data); },
    getHolidays: function() { return call('getHolidays'); },
    addHoliday: function(data) { return call('addHoliday', data); },
    removeHoliday: function(data) { return call('removeHoliday', data); },
    getAnnouncements: function() { return call('getAnnouncements'); },
    updateAnnouncement: function(data) { return call('updateAnnouncement', data); },
    getOrders: function() { return call('getOrders'); },
    getOrdersByDateRange: function(data) { return call('getOrdersByDateRange', data); },
    getOrdersByStatus: function(data) { return call('getOrdersByStatus', data); },
    updateOrderStatus: function(data) { return call('updateOrderStatus', data); },
    getDiscounts: function() { return call('getDiscounts'); },
    addDiscount: function(data) { return call('addDiscount', data); },
    updateDiscount: function(data) { return call('updateDiscount', data); },
    deleteDiscount: function(data) { return call('deleteDiscount', data); },
    loginEmployee: function(data) { return call('loginEmployee', data); },
    getEmployees: function() { return call('getEmployees'); },
    addEmployee: function(data) { return call('addEmployee', data); },
    updateEmployee: function(data) { return call('updateEmployee', data); },
    deleteEmployee: function(data) { return call('deleteEmployee', data); },
    resetEmployeePin: function(data) { return call('resetEmployeePin', data); },
    changeEmployeePin: function(data) { return call('changeEmployeePin', data); },
    getAuditLog: function(data) { return call('getAuditLog', data); },
    addCategory: function(data) { return call('addCategory', data); },
    updateCategory: function(data) { return call('updateCategory', data); },
    deleteCategory: function(data) { return call('deleteCategory', data); },
    addOptionGroup: function(data) { return call('addOptionGroup', data); },
    updateOptionGroup: function(data) { return call('updateOptionGroup', data); },
    deleteOptionGroup: function(data) { return call('deleteOptionGroup', data); },
    migrateMenuToNormalized: function() { return call('migrateMenuToNormalized', {}); }
  };
})();
