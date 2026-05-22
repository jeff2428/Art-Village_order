/**
 * announcement.js
 * 公告顯示模組
 * 職責：公告顯示（首頁置頂、彈窗、結帳前提醒）
 */

var Announcement = (function() {
  'use strict';
  
  var announcements = null;

  function load() {
    return Api.getAnnouncements()
      .then(function(data) {
        announcements = data;
        renderHeader();
        renderPopup();
        return data;
      });
  }

  function renderHeader() {
    var header = document.getElementById('headerAnnouncement');
    if (announcements && announcements.header && announcements.header.enabled && announcements.header.content) {
      header.querySelector('p').textContent = announcements.header.content;
      header.classList.remove('hidden');
    } else {
      header.classList.add('hidden');
    }
  }

  function renderPopup() {
    var popup = document.getElementById('popupAnnouncement');
    if (announcements && announcements.popup && announcements.popup.enabled && announcements.popup.content) {
      document.getElementById('popupContent').textContent = announcements.popup.content;
      popup.classList.remove('hidden');
    } else {
      popup.classList.add('hidden');
    }
  }

  function closePopup() {
    document.getElementById('popupAnnouncement').classList.add('hidden');
  }

  function showCheckoutAnnouncement(callback) {
    var checkout = document.getElementById('checkoutAnnouncement');
    if (announcements && announcements.checkout && announcements.checkout.enabled && announcements.checkout.content) {
      document.getElementById('checkoutAnnouncementContent').textContent = announcements.checkout.content;
      checkout.classList.remove('hidden');
      window._checkoutCallback = callback;
    } else {
      callback();
    }
  }

  function confirmCheckout() {
    document.getElementById('checkoutAnnouncement').classList.add('hidden');
    if (window._checkoutCallback) {
      window._checkoutCallback();
      window._checkoutCallback = null;
    }
  }

  return {
    load: load,
    closePopup: closePopup,
    showCheckoutAnnouncement: showCheckoutAnnouncement,
    confirmCheckout: confirmCheckout
  };
})();
