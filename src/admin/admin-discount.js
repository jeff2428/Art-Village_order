/**
 * admin-discount.js
 * 管理後台 - 折扣管理模組
 */

var AdminDiscount = (function() {
  'use strict';

  var discounts = [];
  var activeMode = 'add';

  function load() {
    AdminApi.getDiscounts()
      .then(function(result) {
        discounts = result.data || [];
        renderDiscounts();
      })
      .catch(function(err) {
        alert('載入折扣失敗: ' + err.message);
      });
  }

  function renderDiscounts() {
    var container = document.getElementById('discountList');
    container.innerHTML = '';

    if (discounts.length === 0) {
      container.innerHTML = '<p class="text-gray-500">尚無折扣設定</p>';
      return;
    }

    var typeLabels = {
      'order_percent': '整單折扣',
      'order_fixed': '整單定額',
      'item_percent': '單品折扣',
      'item_fixed': '單品定額',
      'free_item': '贈品折扣',
      'time_period': '時段折扣',
      'min_amount': '滿額折扣'
    };

    discounts.forEach(function(discount, index) {
      var card = document.createElement('div');
      card.className = 'bg-white rounded-lg p-4 shadow';

      var valueDisplay = '';
      if (discount.type.indexOf('percent') !== -1 || discount.type === 'time_period') {
        valueDisplay = escapeHtml(discount.value) + '%';
      } else {
        valueDisplay = '$' + escapeHtml(discount.value);
      }

      var timeInfo = '';
      if (discount.timeStart || discount.timeEnd) {
        timeInfo = '<p class="text-sm">時段: ' + escapeHtml(discount.timeStart || '全天') + ' - ' + escapeHtml(discount.timeEnd || '全天') + '</p>';
      }
      if (discount.dateStart || discount.dateEnd) {
        timeInfo += '<p class="text-sm">日期: ' + escapeHtml(discount.dateStart || '無') + ' - ' + escapeHtml(discount.dateEnd || '無') + '</p>';
      }
      if (discount.minAmount > 0) {
        timeInfo += '<p class="text-sm">最低消費: $' + escapeHtml(discount.minAmount) + '</p>';
      }

      card.innerHTML =
        '<div class="flex justify-between items-start">' +
          '<div>' +
            '<p class="font-bold">' + escapeHtml(discount.name) + '</p>' +
            '<p class="text-sm text-gray-500">類型: ' + escapeHtml(typeLabels[discount.type] || discount.type) + ' | 折扣: ' + valueDisplay + '</p>' +
            timeInfo +
            '<p class="text-sm mt-1">優先順序: ' + escapeHtml(discount.priority) + '</p>' +
          '</div>' +
          '<div class="text-right">' +
            '<span class="px-2 py-1 rounded text-sm ' + (discount.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800') + '">' + (discount.enabled ? '啟用' : '停用') + '</span>' +
            '<div class="mt-2">' +
              '<button onclick="AdminDiscount.editDiscount(' + index + ')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2">編輯</button>' +
              '<button onclick="AdminDiscount.toggleDiscount(' + index + ')" class="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded text-sm mr-2">' + (discount.enabled ? '停用' : '啟用') + '</button>' +
              '<button onclick="AdminDiscount.removeDiscount(' + index + ')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">刪除</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      container.appendChild(card);
    });
  }

  function showAddForm() {
    var container = document.getElementById('discountFormContainer');
    activeMode = 'add';
    container.innerHTML =
      '<div class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900 bg-opacity-50 px-4" role="dialog" aria-modal="true" aria-labelledby="discountFormTitle">' +
      '<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg p-6 shadow-lg">' +
        '<div class="flex items-center justify-between mb-4">' +
          '<h3 id="discountFormTitle" class="text-lg font-bold">新增折扣</h3>' +
          '<button type="button" onclick="AdminDiscount.cancelForm()" class="text-gray-500 hover:text-gray-700" aria-label="關閉">✕</button>' +
        '</div>' +
        '<p id="discountFormError" class="hidden mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></p>' +
        '<div class="space-y-4">' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">折扣名稱</label>' +
            '<input type="text" id="discountName" class="border rounded px-3 py-2 w-full" placeholder="例如：午餐時段優惠">' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">折扣類型</label>' +
            '<select id="discountType" class="border rounded px-3 py-2 w-full" onchange="AdminDiscount.onTypeChange()">' +
              '<option value="order_percent">整單百分比折扣</option>' +
              '<option value="order_fixed">整單定額折扣</option>' +
              '<option value="item_percent">單品百分比折扣</option>' +
              '<option value="item_fixed">單品定額折扣</option>' +
              '<option value="min_amount">滿額折扣</option>' +
              '<option value="time_period">時段折扣</option>' +
            '</select>' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">折扣值</label>' +
            '<input type="number" id="discountValue" class="border rounded px-3 py-2 w-full" placeholder="百分比或金額">' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">最低消費金額（選填）</label>' +
            '<input type="number" id="discountMinAmount" class="border rounded px-3 py-2 w-full" placeholder="0">' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-4">' +
            '<div>' +
              '<label class="block text-sm font-medium mb-1">生效時間</label>' +
              '<input type="time" id="discountTimeStart" class="border rounded px-3 py-2 w-full">' +
            '</div>' +
            '<div>' +
              '<label class="block text-sm font-medium mb-1">截止時間</label>' +
              '<input type="time" id="discountTimeEnd" class="border rounded px-3 py-2 w-full">' +
            '</div>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-4">' +
            '<div>' +
              '<label class="block text-sm font-medium mb-1">生效日期</label>' +
              '<input type="date" id="discountDateStart" class="border rounded px-3 py-2 w-full">' +
            '</div>' +
            '<div>' +
              '<label class="block text-sm font-medium mb-1">截止日期</label>' +
              '<input type="date" id="discountDateEnd" class="border rounded px-3 py-2 w-full">' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">優先順序（數字越小越優先）</label>' +
            '<input type="number" id="discountPriority" class="border rounded px-3 py-2 w-full" value="10">' +
          '</div>' +
          '<div class="flex gap-2">' +
            '<button onclick="AdminDiscount.saveNewDiscount()" class="bg-green-500 text-white px-4 py-2 rounded">儲存</button>' +
            '<button onclick="AdminDiscount.cancelForm()" class="bg-gray-500 text-white px-4 py-2 rounded">取消</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
    focusDiscountForm();
  }

  function onTypeChange() {
    var type = document.getElementById('discountType').value;
    var valueInput = document.getElementById('discountValue');

    if (type.indexOf('percent') !== -1 || type === 'time_period') {
      valueInput.placeholder = '例如：10 代表 10%';
    } else {
      valueInput.placeholder = '例如：50 代表 $50';
    }
  }

  function saveNewDiscount() {
    var data = {
      name: document.getElementById('discountName').value,
      type: document.getElementById('discountType').value,
      value: parseFloat(document.getElementById('discountValue').value) || 0,
      minAmount: parseFloat(document.getElementById('discountMinAmount').value) || 0,
      timeStart: document.getElementById('discountTimeStart').value,
      timeEnd: document.getElementById('discountTimeEnd').value,
      dateStart: document.getElementById('discountDateStart').value,
      dateEnd: document.getElementById('discountDateEnd').value,
      priority: parseInt(document.getElementById('discountPriority').value) || 999,
      enabled: true
    };

    if (!data.name) {
      showFormError('請輸入折扣名稱');
      return;
    }

    AdminApi.addDiscount(data)
      .then(function(result) {
        alert(result.message);
        cancelForm();
        load();
      })
      .catch(function(err) {
        showFormError('新增失敗: ' + err.message);
      });
  }

  function editDiscount(index) {
    var discount = discounts[index];
    var container = document.getElementById('discountFormContainer');
    activeMode = 'edit';

    var applicableItemsStr = Array.isArray(discount.applicableItems)
      ? discount.applicableItems.join(',')
      : '';

    container.innerHTML =
      '<div class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900 bg-opacity-50 px-4" role="dialog" aria-modal="true" aria-labelledby="discountFormTitle">' +
      '<div class="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-lg p-6 shadow-lg">' +
        '<div class="flex items-center justify-between mb-4">' +
          '<h3 id="discountFormTitle" class="text-lg font-bold">編輯折扣</h3>' +
          '<button type="button" onclick="AdminDiscount.cancelForm()" class="text-gray-500 hover:text-gray-700" aria-label="關閉">✕</button>' +
        '</div>' +
        '<p id="discountFormError" class="hidden mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"></p>' +
        '<div class="space-y-4">' +
          '<input type="hidden" id="editDiscountId" value="' + escapeAttribute(discount.discountId) + '">' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">折扣名稱</label>' +
            '<input type="text" id="editDiscountName" class="border rounded px-3 py-2 w-full" value="' + escapeAttribute(discount.name) + '">' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">折扣類型</label>' +
            '<select id="editDiscountType" class="border rounded px-3 py-2 w-full">' +
              '<option value="order_percent"' + (discount.type === 'order_percent' ? ' selected' : '') + '>整單百分比折扣</option>' +
              '<option value="order_fixed"' + (discount.type === 'order_fixed' ? ' selected' : '') + '>整單定額折扣</option>' +
              '<option value="item_percent"' + (discount.type === 'item_percent' ? ' selected' : '') + '>單品百分比折扣</option>' +
              '<option value="item_fixed"' + (discount.type === 'item_fixed' ? ' selected' : '') + '>單品定額折扣</option>' +
              '<option value="min_amount"' + (discount.type === 'min_amount' ? ' selected' : '') + '>滿額折扣</option>' +
              '<option value="time_period"' + (discount.type === 'time_period' ? ' selected' : '') + '>時段折扣</option>' +
            '</select>' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">折扣值</label>' +
            '<input type="number" id="editDiscountValue" class="border rounded px-3 py-2 w-full" value="' + escapeAttribute(discount.value) + '">' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">最低消費金額</label>' +
            '<input type="number" id="editDiscountMinAmount" class="border rounded px-3 py-2 w-full" value="' + escapeAttribute(discount.minAmount) + '">' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-4">' +
            '<div>' +
              '<label class="block text-sm font-medium mb-1">生效時間</label>' +
              '<input type="time" id="editDiscountTimeStart" class="border rounded px-3 py-2 w-full" value="' + escapeAttribute(discount.timeStart || '') + '">' +
            '</div>' +
            '<div>' +
              '<label class="block text-sm font-medium mb-1">截止時間</label>' +
              '<input type="time" id="editDiscountTimeEnd" class="border rounded px-3 py-2 w-full" value="' + escapeAttribute(discount.timeEnd || '') + '">' +
            '</div>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-4">' +
            '<div>' +
              '<label class="block text-sm font-medium mb-1">生效日期</label>' +
              '<input type="date" id="editDiscountDateStart" class="border rounded px-3 py-2 w-full" value="' + escapeAttribute(discount.dateStart || '') + '">' +
            '</div>' +
            '<div>' +
              '<label class="block text-sm font-medium mb-1">截止日期</label>' +
              '<input type="date" id="editDiscountDateEnd" class="border rounded px-3 py-2 w-full" value="' + escapeAttribute(discount.dateEnd || '') + '">' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="block text-sm font-medium mb-1">優先順序</label>' +
            '<input type="number" id="editDiscountPriority" class="border rounded px-3 py-2 w-full" value="' + escapeAttribute(discount.priority) + '">' +
          '</div>' +
          '<div class="flex gap-2">' +
            '<button onclick="AdminDiscount.saveEditDiscount()" class="bg-green-500 text-white px-4 py-2 rounded">儲存</button>' +
            '<button onclick="AdminDiscount.cancelForm()" class="bg-gray-500 text-white px-4 py-2 rounded">取消</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '</div>';
    focusDiscountForm();
  }

  function saveEditDiscount() {
    var data = {
      discountId: document.getElementById('editDiscountId').value,
      name: document.getElementById('editDiscountName').value,
      type: document.getElementById('editDiscountType').value,
      value: parseFloat(document.getElementById('editDiscountValue').value) || 0,
      minAmount: parseFloat(document.getElementById('editDiscountMinAmount').value) || 0,
      timeStart: document.getElementById('editDiscountTimeStart').value,
      timeEnd: document.getElementById('editDiscountTimeEnd').value,
      dateStart: document.getElementById('editDiscountDateStart').value,
      dateEnd: document.getElementById('editDiscountDateEnd').value,
      priority: parseInt(document.getElementById('editDiscountPriority').value) || 999
    };

    if (!data.name) {
      showFormError('請輸入折扣名稱');
      return;
    }

    AdminApi.updateDiscount(data)
      .then(function(result) {
        alert(result.message);
        cancelForm();
        load();
      })
      .catch(function(err) {
        showFormError('更新失敗: ' + err.message);
      });
  }

  function toggleDiscount(index) {
    var discount = discounts[index];
    var newEnabled = !discount.enabled;

    AdminApi.updateDiscount({
      discountId: discount.discountId,
      enabled: newEnabled
    })
      .then(function(result) {
        alert(result.message);
        load();
      })
      .catch(function(err) {
        alert('操作失敗: ' + err.message);
      });
  }

  function removeDiscount(index) {
    if (!confirm('確定要停用折扣「' + discounts[index].name + '」嗎？')) {
      return;
    }

    AdminApi.deleteDiscount({ discountId: discounts[index].discountId })
      .then(function(result) {
        alert(result.message);
        load();
      })
      .catch(function(err) {
        alert('刪除失敗: ' + err.message);
      });
  }

  function cancelForm() {
    document.getElementById('discountFormContainer').innerHTML = '';
  }

  function showFormError(message) {
    var errorEl = document.getElementById('discountFormError');
    if (!errorEl) return;

    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  }

  function focusDiscountForm() {
    var targetId = activeMode === 'edit' ? 'editDiscountName' : 'discountName';
    var target = document.getElementById(targetId);
    if (target) target.focus();
  }

  return {
    load: load,
    showAddForm: showAddForm,
    onTypeChange: onTypeChange,
    saveNewDiscount: saveNewDiscount,
    editDiscount: editDiscount,
    saveEditDiscount: saveEditDiscount,
    toggleDiscount: toggleDiscount,
    removeDiscount: removeDiscount,
    cancelForm: cancelForm
  };
})();
