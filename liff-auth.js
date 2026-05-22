/**
 * liff-auth.js
 * LINE LIFF 認證模組（前端）
 * 職責：處理 LIFF 登入流程、取得使用者 profile
 * 
 * 使用方式：
 * <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
 * <script src="liff-auth.js"></script>
 */

var LiffAuth = (function() {
  'use strict';
  
  var LIFF_ID = '';
  var isLoggedIn = false;
  var profile = null;
  var idToken = null;
  
  /**
   * 初始化 LIFF
   * @param {string} liffId - LINE LIFF ID
   * @returns {Promise} 初始化結果
   */
  function init(liffId) {
    LIFF_ID = liffId;
    
    return liff.init({ liffId: LIFF_ID })
      .then(function() {
        if (liff.isLoggedIn()) {
          isLoggedIn = true;
          return getProfile();
        }
        return null;
      })
      .catch(function(err) {
        console.error('LIFF 初始化失敗:', err);
        throw err;
      });
  }
  
  /**
   * 執行登入
   * @returns {Promise} 登入結果
   */
  function login() {
    if (!liff.isLoggedIn()) {
      liff.login();
    } else {
      return Promise.resolve({ alreadyLoggedIn: true });
    }
  }
  
  /**
   * 執行登出
   */
  function logout() {
    if (liff.isLoggedIn()) {
      liff.logout();
      isLoggedIn = false;
      profile = null;
      idToken = null;
      localStorage.removeItem('liff_profile');
      localStorage.removeItem('liff_token');
    }
  }
  
  /**
   * 取得使用者 Profile
   * @returns {Promise} Profile 資料
   */
  function getProfile() {
    if (profile) {
      return Promise.resolve(profile);
    }

    return liff.getProfile()
      .then(function(data) {
        profile = data;
        return data;
      })
      .catch(function(err) {
        console.error('取得 Profile 失敗:', err);
        throw err;
      });
  }
  
  /**
   * 取得 LIFF ID Token
   * @returns {string|null} ID Token
   */
  function getIdToken() {
    if (idToken) {
      return idToken;
    }
    
    idToken = liff.getIDToken();
    return idToken;
  }
  
  /**
   * 檢查登入狀態
   * @returns {boolean} 是否已登入
   */
  function checkLoginStatus() {
    isLoggedIn = liff.isLoggedIn();
    return isLoggedIn;
  }
  
  /**
   * 取得使用者 ID
   * @returns {string|null} userId
   */
  function getUserId() {
    if (profile) {
      return profile.userId;
    }
    return null;
  }
  
  /**
   * 取得顯示名稱
   * @returns {string|null} displayName
   */
  function getDisplayName() {
    if (profile) {
      return profile.displayName;
    }
    return null;
  }
  
  /**
   * 取得頭像 URL
   * @returns {string|null} pictureUrl
   */
  function getPictureUrl() {
    if (profile) {
      return profile.pictureUrl;
    }
    return null;
  }
  
  /**
   * 將 LIFF 資訊附加至 API 請求
   * @param {Object} data - 原始請求資料
   * @returns {Object} 附加 LIFF 資訊的資料
   */
  function attachLiffInfo(data) {
    data.liffUserId = getUserId();
    data.displayName = getDisplayName();
    return data;
  }
  
  return {
    init: init,
    login: login,
    logout: logout,
    getProfile: getProfile,
    getIdToken: getIdToken,
    checkLoginStatus: checkLoginStatus,
    getUserId: getUserId,
    getDisplayName: getDisplayName,
    getPictureUrl: getPictureUrl,
    attachLiffInfo: attachLiffInfo,
    isLoggedIn: function() { return isLoggedIn; }
  };
})();
