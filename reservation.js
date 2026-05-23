var Reservation = (function() {
  'use strict';

  var businessHours = null;
  var reservationData = null;
  var submitCallback = null;
  var representativeLocked = false;
  var sharedBy = null;

  function init(hours, onSubmit) {
    businessHours = hours;
    submitCallback = onSubmit || null;
    setupFormValidation();
  }

  function setupTimeOptions(dateString) {
    var select = document.getElementById('diningTime');
    if (!select) return;
    select.innerHTML = '<option value="">請選擇</option>';

    if (!businessHours || !dateString) return;

    var date = new Date(dateString + 'T00:00:00');
    var dayOfWeek = date.getDay();
    var dayData = businessHours[dayOfWeek.toString()];

    if (!dayData || !dayData.enabled || dayData.slots.length === 0) {
      var option = document.createElement('option');
      option.value = '';
      option.textContent = '本日公休';
      select.appendChild(option);
      return;
    }

    dayData.slots.forEach(function(slot) {
      var parts = slot.split('-');
      var start = parts[0];
      var end = parts[1];
      if (!start || !end) return;

      var startHour = parseInt(start.split(':')[0]);
      var startMin = parseInt(start.split(':')[1]);
      var endHour = parseInt(end.split(':')[0]);
      var endMin = parseInt(end.split(':')[1]);

      var currentHour = startHour;
      var currentMin = startMin;

      while (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
        var timeStr = currentHour.toString().padStart(2, '0') + ':' + currentMin.toString().padStart(2, '0');
        var option = document.createElement('option');
        option.value = timeStr;
        option.textContent = timeStr;
        select.appendChild(option);

        currentMin += 30;
        if (currentMin >= 60) {
          currentHour++;
          currentMin -= 60;
        }
      }
    });
  }

  function setupFormValidation() {
    var form = document.getElementById('reservationForm');
    if (!form) return;
    if (form.dataset.bound === 'true') return;
    form.dataset.bound = 'true';

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      if (validate()) {
        submitForm();
      }
    });

    var dateInput = document.getElementById('diningDate');
    if (dateInput) {
      dateInput.addEventListener('change', function(e) {
        setupTimeOptions(e.target.value);
      });
    }
  }

  function validate() {
    var name = document.getElementById('customerName').value.trim();
    var phone = document.getElementById('customerPhone').value.trim();
    var guests = document.getElementById('guestCount').value;
    var date = document.getElementById('diningDate').value;
    var time = document.getElementById('diningTime').value;

    if (!name) { alert('請輸入姓名'); return false; }
    if (!/^09\d{8}$/.test(phone.replace(/-/g, ''))) { alert('請輸入正確的手機號碼格式'); return false; }
    if (!guests || parseInt(guests) < 1) { alert('請輸入有效人數'); return false; }
    if (!date) { alert('請選擇用餐日期'); return false; }
    if (!time) { alert('請選擇用餐時間'); return false; }

    return true;
  }

  function submitForm() {
    reservationData = {
      customerName: document.getElementById('customerName').value.trim(),
      phone: document.getElementById('customerPhone').value.trim(),
      guestCount: parseInt(document.getElementById('guestCount').value),
      diningDate: document.getElementById('diningDate').value,
      diningTime: document.getElementById('diningTime').value
    };

    if (submitCallback) {
      submitCallback(reservationData);
    }
    return reservationData;
  }

  function parseSharedBy() {
    var params = new URLSearchParams(window.location.search);
    var value = params.get('sharedBy');
    if (value) {
      value = decodeURIComponent(value);
      value = escapeHtml(value);
      var url = new URL(window.location);
      url.searchParams.delete('sharedBy');
      window.history.replaceState({}, '', url);
    }
    return value;
  }

  function setLockedRepresentative(name) {
    var input = document.getElementById('representativeName');
    if (input) {
      input.value = name || '';
      input.readOnly = true;
      input.classList.add('bg-gray-100', 'cursor-not-allowed');
      representativeLocked = true;
    }
  }

  function openReservationScreen() {
    var screens = ['loginScreen', 'mainScreen', 'successScreen',
      'reservationCompleteScreen', 'myOrdersModal'];
    screens.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    document.getElementById('reservationScreen').classList.remove('hidden');

    var dateInput = document.getElementById('diningDate');
    if (dateInput) {
      var today = new Date().toISOString().split('T')[0];
      dateInput.setAttribute('min', today);

      dateInput.addEventListener('change', function(e) {
        setupTimeOptions(e.target.value);
      });
    }
  }

  function showReservationComplete() {
    var screens = ['loginScreen', 'mainScreen', 'successScreen',
      'reservationScreen', 'myOrdersModal'];
    screens.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    document.getElementById('reservationCompleteScreen').classList.remove('hidden');

    var summary = document.getElementById('reservationSummary');
    if (summary && reservationData) {
      summary.innerHTML = '';
      var lines = [
        '訂位代表：' + (reservationData.representative || ''),
        '訂位人：' + reservationData.customerName,
        '電話：' + reservationData.phone,
        '人數：' + reservationData.guestCount + '人',
        '日期：' + reservationData.diningDate,
        '時間：' + reservationData.diningTime
      ];
      for (var i = 0; i < lines.length; i++) {
        if (i > 0) summary.appendChild(document.createElement('br'));
        summary.appendChild(document.createTextNode(lines[i]));
      }
    }
  }

  function setupDineInAction() {
    var btn = document.getElementById('dineInBtn');
    if (!btn || btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';

    btn.addEventListener('click', function() {
      var name = document.getElementById('customerName').value.trim();
      var phone = document.getElementById('customerPhone').value.trim();
      var guests = document.getElementById('guestCount').value;
      var date = document.getElementById('diningDate').value;
      var time = document.getElementById('diningTime').value;

      if (!name) { alert('請輸入訂位人姓名'); return; }
      if (!/^09\d{8}$/.test(phone.replace(/-/g, ''))) { alert('請輸入正確的手機號碼格式'); return; }
      if (!guests || parseInt(guests) < 1) { alert('請輸入有效人數'); return; }
      if (!date) { alert('請選擇用餐日期'); return; }
      if (!time) { alert('請選擇用餐時間'); return; }

      reservationData = {
        representative: document.getElementById('representativeName').value.trim(),
        customerName: name,
        phone: phone,
        guestCount: parseInt(guests),
        diningDate: date,
        diningTime: time
      };

      showReservationComplete();

      Api.sendReservationToLine(reservationData).catch(function(err) {
        console.log('訂位通知送出失敗:', err);
      });
    });
  }

  function setupPreOrderAction() {
    var btn = document.getElementById('preOrderBtn');
    if (!btn || btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';

    btn.addEventListener('click', function() {
      var name = document.getElementById('customerName').value.trim();
      var phone = document.getElementById('customerPhone').value.trim();
      var guests = document.getElementById('guestCount').value;
      var date = document.getElementById('diningDate').value;
      var time = document.getElementById('diningTime').value;

      if (!name) { alert('請輸入訂位人姓名'); return; }
      if (!/^09\d{8}$/.test(phone.replace(/-/g, ''))) { alert('請輸入正確的手機號碼格式'); return; }
      if (!guests || parseInt(guests) < 1) { alert('請輸入有效人數'); return; }
      if (!date) { alert('請選擇用餐日期'); return; }
      if (!time) { alert('請選擇用餐時間'); return; }

      reservationData = {
        representative: document.getElementById('representativeName').value.trim(),
        customerName: name,
        phone: phone,
        guestCount: parseInt(guests),
        diningDate: date,
        diningTime: time
      };

      var screens = ['loginScreen', 'reservationScreen', 'successScreen',
        'reservationCompleteScreen', 'myOrdersModal'];
      screens.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      document.getElementById('mainScreen').classList.remove('hidden');

      if (typeof loadMainScreen === 'function') {
        loadMainScreen();
      }
    });
  }

  function setupQueryOrderAction() {
    var btn = document.getElementById('queryOrderBtn');
    if (!btn || btn.dataset.bound === 'true') return;
    btn.dataset.bound = 'true';

    btn.addEventListener('click', function() {
      loadMyOrders();
    });
  }

  function loadMyOrders() {
    var liffUserId = LiffAuth.getUserId();
    if (!liffUserId) {
      alert('無法取得使用者身分，請重新登入');
      return;
    }

    document.getElementById('myOrdersModal').classList.remove('hidden');
    document.getElementById('ordersLoading').classList.remove('hidden');
    document.getElementById('ordersError').classList.add('hidden');
    document.getElementById('ordersList').classList.add('hidden');
    document.getElementById('ordersEmpty').classList.add('hidden');

    Api.getOrdersByUserId({ liffUserId: liffUserId })
      .then(function(result) {
        document.getElementById('ordersLoading').classList.add('hidden');
        var orders = result.data || [];
        if (orders.length === 0) {
          document.getElementById('ordersEmpty').classList.remove('hidden');
          return;
        }
        renderMyOrders(orders);
      })
      .catch(function(err) {
        document.getElementById('ordersLoading').classList.add('hidden');
        document.getElementById('ordersError').textContent = '載入失敗: ' + err.message;
        document.getElementById('ordersError').classList.remove('hidden');
      });
  }

  function renderMyOrders(orders) {
    var sorted = orders.sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    }).slice(0, 10);

    var container = document.getElementById('ordersList');
    container.innerHTML = '';
    container.classList.remove('hidden');

    sorted.forEach(function(order) {
      var card = document.createElement('div');
      card.className = 'border border-gray-200 rounded-lg p-4';

      var statusClass = getOrderStatusClass(order.status);
      var statusLabel = getOrderStatusLabel(order.status);

      var itemsText = (order.orderItems || []).map(function(item) {
        return item.name + ' x' + item.quantity;
      }).join(', ');

      card.innerHTML =
        '<div class="flex justify-between items-start">' +
          '<div>' +
            '<p class="font-bold text-sm">' + escapeHtml(order.orderId) + '</p>' +
            '<p class="text-xs text-gray-500 mt-1">' + escapeHtml(order.timestamp) + '</p>' +
            '<p class="text-sm mt-2">' + escapeHtml(order.customerName) + ' | ' + escapeHtml(order.phone) + ' | ' + escapeHtml(order.guestCount) + ' 人</p>' +
            '<p class="text-xs text-gray-500">用餐: ' + escapeHtml(order.diningDate) + ' ' + escapeHtml(order.diningTime) + '</p>' +
            '<p class="text-xs text-gray-500 mt-1">' + escapeHtml(itemsText) + '</p>' +
            (order.totalAmount ? '<p class="text-sm font-semibold mt-1">$' + escapeHtml(order.totalAmount) + '</p>' : '') +
          '</div>' +
          '<div class="text-right">' +
            '<span class="px-2 py-1 rounded text-xs ' + statusClass + '">' + statusLabel + '</span>' +
          '</div>' +
        '</div>';

      container.appendChild(card);
    });
  }

  function getOrderStatusClass(status) {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getOrderStatusLabel(status) {
    switch(status) {
      case 'pending': return '已成立';
      case 'confirmed': return '已接單';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return status;
    }
  }

  function closeMyOrders() {
    document.getElementById('myOrdersModal').classList.add('hidden');
  }

  function getData() {
    return reservationData;
  }

  function reset() {
    reservationData = null;
    representativeLocked = false;
    sharedBy = null;
    var form = document.getElementById('reservationForm');
    if (form) form.reset();
    var repInput = document.getElementById('representativeName');
    if (repInput) repInput.value = '';
  }

  function open() {
    document.getElementById('reservationModal').classList.remove('hidden');
  }

  function close() {
    document.getElementById('reservationModal').classList.add('hidden');
  }

  return {
    init: init,
    open: open,
    close: close,
    getData: getData,
    reset: reset,
    parseSharedBy: parseSharedBy,
    setLockedRepresentative: setLockedRepresentative,
    openReservationScreen: openReservationScreen,
    showReservationComplete: showReservationComplete,
    setupDineInAction: setupDineInAction,
    setupPreOrderAction: setupPreOrderAction,
    setupQueryOrderAction: setupQueryOrderAction,
    loadMyOrders: loadMyOrders,
    closeMyOrders: closeMyOrders
  };
})();
