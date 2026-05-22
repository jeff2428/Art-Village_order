/**
 * reservation.js
 * 預約資訊表單模組
 * 職責：預約資訊表單驗證與狀態管理
 */

var Reservation = (function() {
  'use strict';
  
  var businessHours = null;
  var reservationData = null;
  var submitCallback = null;

  function init(hours, onSubmit) {
    businessHours = hours;
    submitCallback = onSubmit || null;
    setupFormValidation();
  }

  function setupTimeOptions(dateString) {
    var select = document.getElementById('diningTime');
    select.innerHTML = '<option value="">請選擇</option>';
    
    if (!businessHours || !dateString) return;
    
    var date = new Date(dateString);
    var dayOfWeek = date.getDay(); // 0-6
    var dayData = businessHours[dayOfWeek.toString()];
    
    if (!dayData || !dayData.enabled || dayData.slots.length === 0) {
      var option = document.createElement('option');
      option.value = "";
      option.textContent = "本日公休";
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
    var dateInput = document.getElementById('diningDate');
    var today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
    
    // 當顧客選擇日期時，重新產生可選時段
    dateInput.addEventListener('change', function(e) {
      setupTimeOptions(e.target.value);
    });

    if (form.dataset.bound === 'true') {
      return;
    }
    form.dataset.bound = 'true';
    
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      if (validate()) {
        submitForm();
      }
    });
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
    
    close();
    if (submitCallback) {
      submitCallback(reservationData);
    }
    return reservationData;
  }

  function open() {
    document.getElementById('reservationModal').classList.remove('hidden');
  }

  function close() {
    document.getElementById('reservationModal').classList.add('hidden');
  }

  function getData() {
    return reservationData;
  }

  function reset() {
    reservationData = null;
    document.getElementById('reservationForm').reset();
  }

  return {
    init: init,
    open: open,
    close: close,
    getData: getData,
    reset: reset
  };
})();
