/**
 * admin-schedule.js
 * 管理後台 - 營業排程模組
 */

var AdminSchedule = (function() {
  'use strict';

  var currentSchedule = {};
  var pendingHolidayDate = '';
  var DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  function load(options) {
    options = options || {};
    setLoading(true);
    if (!options.preserveMessage) clearMessage();

    var hoursPromise = AdminApi.getBusinessHours()
      .then(function(result) {
        currentSchedule = result.data || {};
        renderWeeklySchedule();
      })
      .catch(function(err) {
        showMessage('error', '載入營業時間失敗: ' + err.message);
      });

    var holidaysPromise = AdminApi.getHolidays()
      .then(function(result) {
        renderHolidays(result.data || []);
      })
      .catch(function(err) {
        renderHolidays([]);
        showMessage('error', '載入休假日期失敗: ' + err.message);
      });

    Promise.all([hoursPromise, holidaysPromise])
      .finally(function() {
        setLoading(false);
      });
  }

  function renderWeeklySchedule() {
    var container = document.getElementById('weeklySchedule');
    container.innerHTML = '';
    
    for (var i = 0; i < 7; i++) {
      var dayData = currentSchedule[i.toString()] || { enabled: false, slots: [] };
      
      var row = document.createElement('div');
      row.className = 'flex items-start border-b pb-4';
      
      var leftCol = document.createElement('div');
      leftCol.className = 'w-32 pt-2';
      leftCol.innerHTML = '<label class="flex items-center space-x-2 cursor-pointer">' +
        '<input type="checkbox" onchange="AdminSchedule.toggleDay(' + i + ', this.checked)" ' + (dayData.enabled ? 'checked' : '') + ' class="form-checkbox h-5 w-5 text-green-500">' +
        '<span class="font-medium">' + DAYS[i] + '</span>' +
      '</label>';
      
      var rightCol = document.createElement('div');
      rightCol.className = 'flex-1 space-y-2';
      
      if (!dayData.enabled) {
        rightCol.innerHTML = '<div class="pt-2 text-gray-400">休息日</div>';
      } else {
        dayData.slots.forEach(function(slot, slotIndex) {
          var parts = slot.split('-');
          var start = parts[0] || '00:00';
          var end = parts[1] || '00:00';
          
          var slotDiv = document.createElement('div');
          slotDiv.className = 'flex items-center space-x-2';
          slotDiv.innerHTML = 
            '<input type="time" value="' + escapeAttribute(start) + '" onchange="AdminSchedule.updateSlot(' + i + ',' + slotIndex + ',\'start\',this.value)" class="border rounded px-2 py-1 text-sm">' +
            '<span>至</span>' +
            '<input type="time" value="' + escapeAttribute(end) + '" onchange="AdminSchedule.updateSlot(' + i + ',' + slotIndex + ',\'end\',this.value)" class="border rounded px-2 py-1 text-sm">' +
            '<button onclick="AdminSchedule.removeSlot(' + i + ',' + slotIndex + ')" class="text-red-500 hover:text-red-700 ml-2 text-sm">刪除</button>';
          rightCol.appendChild(slotDiv);
        });
        
        var addBtn = document.createElement('button');
        addBtn.className = 'text-green-500 hover:text-green-700 text-sm mt-1';
        addBtn.innerText = '+ 新增時段';
        addBtn.onclick = function(dayIndex) { return function() { AdminSchedule.addSlot(dayIndex); }; }(i);
        rightCol.appendChild(addBtn);
      }
      
      row.appendChild(leftCol);
      row.appendChild(rightCol);
      container.appendChild(row);
    }
  }

  function renderHolidays(holidays) {
    var container = document.getElementById('holidayList');
    container.innerHTML = '';

    if (!holidays || holidays.length === 0) {
      container.innerHTML = '<p class="text-gray-500">尚無特殊休假日期</p>';
      return;
    }
    
    holidays.forEach(function(h) {
      var row = document.createElement('div');
      row.className = 'flex justify-between items-center bg-gray-50 px-3 py-2 rounded';
      var removeAction = escapeAttribute("AdminSchedule.removeHoliday('" + escapeJsString(h.date) + "')");
      row.innerHTML = 
        '<span>' + escapeHtml(h.date) + (h.reason ? ' - ' + escapeHtml(h.reason) : '') + '</span>' +
        '<button onclick="' + removeAction + '" class="text-red-500">刪除</button>';
      container.appendChild(row);
    });
  }

  function toggleDay(dayIndex, enabled) {
    if (!currentSchedule[dayIndex.toString()]) currentSchedule[dayIndex.toString()] = { slots: [] };
    currentSchedule[dayIndex.toString()].enabled = enabled;
    if (enabled && currentSchedule[dayIndex.toString()].slots.length === 0) {
      currentSchedule[dayIndex.toString()].slots.push('11:00-21:00');
    }
    renderWeeklySchedule();
  }

  function addSlot(dayIndex) {
    currentSchedule[dayIndex.toString()].slots.push('11:00-21:00');
    renderWeeklySchedule();
  }

  function removeSlot(dayIndex, slotIndex) {
    currentSchedule[dayIndex.toString()].slots.splice(slotIndex, 1);
    renderWeeklySchedule();
  }

  function updateSlot(dayIndex, slotIndex, type, val) {
    var slot = currentSchedule[dayIndex.toString()].slots[slotIndex];
    var parts = slot.split('-');
    if (type === 'start') parts[0] = val;
    else parts[1] = val;
    currentSchedule[dayIndex.toString()].slots[slotIndex] = parts.join('-');
  }

  function saveHours() {
    clearMessage();

    if (!validateSchedule()) {
      return;
    }

    AdminApi.call('updateBusinessHours', { scheduleData: currentSchedule })
      .then(function() {
        showMessage('success', '營業排程已成功更新');
      })
      .catch(function(err) {
        showMessage('error', '更新失敗: ' + err.message);
      });
  }

  function addHoliday() {
    var date = document.getElementById('holidayDate').value;
    var reason = document.getElementById('holidayReason').value;
    clearMessage();
    
    if (!date) {
      showMessage('error', '請選擇日期');
      return;
    }

    AdminApi.addHoliday({ date: date, reason: reason })
      .then(function() {
        showMessage('success', '已新增休假日期');
        document.getElementById('holidayDate').value = '';
        document.getElementById('holidayReason').value = '';
        load({ preserveMessage: true });
      })
      .catch(function(err) {
        showMessage('error', '新增失敗: ' + err.message);
      });
  }

  function removeHoliday(date) {
    pendingHolidayDate = date;
    showRemoveHolidayModal(date);
  }

  function confirmRemoveHoliday() {
    if (!pendingHolidayDate) return;

    var date = pendingHolidayDate;
    var confirmButton = document.getElementById('holidayModalConfirm');
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = '刪除中...';
    }
    clearMessage();
    
    AdminApi.removeHoliday({ date: date })
      .then(function() {
        closeRemoveHolidayModal();
        showMessage('success', '已刪除休假日期');
        load({ preserveMessage: true });
      })
      .catch(function(err) {
        showMessage('error', '刪除失敗: ' + err.message);
        if (confirmButton) {
          confirmButton.disabled = false;
          confirmButton.textContent = '確認刪除';
        }
      });
  }

  function showRemoveHolidayModal(date) {
    var modal = document.getElementById('holidayRemoveModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'holidayRemoveModal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 px-4';
      modal.innerHTML =
        '<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="holidayModalTitle">' +
          '<h3 id="holidayModalTitle" class="text-lg font-bold">刪除休假日期</h3>' +
          '<p id="holidayModalBody" class="mt-3 text-sm text-gray-600"></p>' +
          '<div class="mt-6 flex justify-end gap-2">' +
            '<button type="button" onclick="AdminSchedule.closeRemoveHolidayModal()" class="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300">取消</button>' +
            '<button type="button" id="holidayModalConfirm" onclick="AdminSchedule.confirmRemoveHoliday()" class="rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600">確認刪除</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }

    document.getElementById('holidayModalBody').textContent = '確定要刪除休假日期「' + date + '」嗎？';
    var confirmButton = document.getElementById('holidayModalConfirm');
    confirmButton.disabled = false;
    confirmButton.textContent = '確認刪除';
    modal.classList.remove('hidden');
    confirmButton.focus();
  }

  function closeRemoveHolidayModal() {
    var modal = document.getElementById('holidayRemoveModal');
    if (modal) modal.classList.add('hidden');
    pendingHolidayDate = '';
  }

  function validateSchedule() {
    for (var dayIndex = 0; dayIndex < 7; dayIndex++) {
      var dayData = currentSchedule[dayIndex.toString()];
      if (!dayData || !dayData.enabled) continue;

      for (var slotIndex = 0; slotIndex < dayData.slots.length; slotIndex++) {
        var slot = dayData.slots[slotIndex];
        var parts = slot.split('-');
        if (!parts[0] || !parts[1] || parts[0] >= parts[1]) {
          showMessage('error', DAYS[dayIndex] + ' 第 ' + (slotIndex + 1) + ' 個時段需早於結束時間');
          return false;
        }
      }
    }

    return true;
  }

  function setLoading(isLoading) {
    var loading = document.getElementById('scheduleLoading');
    var content = document.getElementById('scheduleContent');
    if (!loading || !content) return;

    if (isLoading) {
      loading.classList.remove('hidden');
      content.classList.add('hidden');
    } else {
      loading.classList.add('hidden');
      content.classList.remove('hidden');
    }
  }

  function showMessage(type, message) {
    var el = document.getElementById('scheduleMessage');
    if (!el) return;

    el.textContent = message;
    el.className = type === 'error'
      ? 'mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
      : 'mb-4 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700';
  }

  function clearMessage() {
    var el = document.getElementById('scheduleMessage');
    if (!el) return;

    el.textContent = '';
    el.className = 'hidden mb-4 rounded border px-4 py-3 text-sm';
  }

  return {
    load: load,
    saveHours: saveHours,
    addHoliday: addHoliday,
    removeHoliday: removeHoliday,
    confirmRemoveHoliday: confirmRemoveHoliday,
    closeRemoveHolidayModal: closeRemoveHolidayModal,
    toggleDay: toggleDay,
    addSlot: addSlot,
    removeSlot: removeSlot,
    updateSlot: updateSlot,
    validateSchedule: validateSchedule
  };
})();
