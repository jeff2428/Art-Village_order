/**
 * admin-announcement.js
 * 管理後台 - 公告管理模組
 */

var AdminAnnouncement = (function() {
  'use strict';

  function load() {
    setLoading(true);
    clearMessage();
    AdminApi.getAnnouncements()
      .then(function(result) {
        var data = result.data;
        document.getElementById('headerAnnouncement').value = data.header.content || '';
        document.getElementById('headerEnabled').checked = data.header.enabled;
        document.getElementById('popupAnnouncement').value = data.popup.content || '';
        document.getElementById('popupEnabled').checked = data.popup.enabled;
        document.getElementById('checkoutAnnouncement').value = data.checkout.content || '';
        document.getElementById('checkoutEnabled').checked = data.checkout.enabled;
      })
      .catch(function(err) {
        showMessage('error', '載入公告失敗: ' + err.message);
      })
      .finally(function() {
        setLoading(false);
      });
  }

  function saveAll() {
    clearMessage();
    var positions = [
      { position: 'header', content: document.getElementById('headerAnnouncement').value, enabled: document.getElementById('headerEnabled').checked },
      { position: 'popup', content: document.getElementById('popupAnnouncement').value, enabled: document.getElementById('popupEnabled').checked },
      { position: 'checkout', content: document.getElementById('checkoutAnnouncement').value, enabled: document.getElementById('checkoutEnabled').checked }
    ];

    var promises = positions.map(function(p) {
      return AdminApi.updateAnnouncement(p);
    });

    Promise.all(promises)
      .then(function() {
        showMessage('success', '所有公告已儲存');
      })
      .catch(function(err) {
        showMessage('error', '儲存失敗: ' + err.message);
      });
  }

  function setLoading(isLoading) {
    var loading = document.getElementById('announcementLoading');
    var form = document.getElementById('announcementForm');
    if (!loading || !form) return;

    if (isLoading) {
      loading.classList.remove('hidden');
      form.classList.add('hidden');
    } else {
      loading.classList.add('hidden');
      form.classList.remove('hidden');
    }
  }

  function showMessage(type, message) {
    var el = document.getElementById('announcementMessage');
    if (!el) return;

    el.textContent = message;
    el.className = type === 'error'
      ? 'mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
      : 'mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700';
  }

  function clearMessage() {
    var el = document.getElementById('announcementMessage');
    if (!el) return;

    el.textContent = '';
    el.className = 'hidden mb-4 rounded border px-4 py-3 text-sm';
  }

  return {
    load: load,
    saveAll: saveAll
  };
})();
