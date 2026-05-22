/**
 * admin-orders.js
 * 管理後台 - 訂單歷史模組
 */

var AdminOrders = (function() {
  'use strict';

  var allOrders = [];
  var currentStatusFilter = 'all';
  var searchQuery = '';
  var currentPage = 1;
  var pageSize = 10;
  var pendingStatusChange = null;

  function loadOrders() {
    var startDate = document.getElementById('orderStartDate').value;
    var endDate = document.getElementById('orderEndDate').value;
    setLoading(true);
    clearError();
    
    var promise;
    if (startDate && endDate) {
      promise = AdminApi.getOrdersByDateRange({ startDate: startDate, endDate: endDate });
    } else {
      promise = AdminApi.getOrders();
    }

    promise
      .then(function(result) {
        allOrders = result.data || [];
        currentPage = 1;
        renderCurrentView();
      })
      .catch(function(err) {
        allOrders = [];
        renderCurrentView();
        showError('載入訂單失敗: ' + err.message);
      })
      .finally(function() {
        setLoading(false);
      });
  }

  function filterByStatus(status) {
    currentStatusFilter = status;
    currentPage = 1;
    
    var buttons = document.querySelectorAll('.status-filter-btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('bg-blue-500', 'text-white');
      buttons[i].classList.add('bg-gray-200', 'text-gray-700');
    }
    
    var activeBtn = document.getElementById('filter-' + status);
    if (activeBtn) {
      activeBtn.classList.remove('bg-gray-200', 'text-gray-700');
      activeBtn.classList.add('bg-blue-500', 'text-white');
    }
    
    renderCurrentView();
  }

  function setSearch(value) {
    searchQuery = value || '';
    currentPage = 1;
    renderCurrentView();
  }

  function setPageSize(value) {
    pageSize = parseInt(value, 10) || 10;
    currentPage = 1;
    renderCurrentView();
  }

  function goToPage(page) {
    currentPage = Math.max(1, parseInt(page, 10) || 1);
    renderCurrentView();
  }

  function renderCurrentView() {
    var filtered = getFilteredOrders(allOrders, currentStatusFilter, searchQuery);
    var totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (currentPage > totalPages) currentPage = totalPages;

    renderSummary(filtered.length, allOrders.length);
    renderOrders(getPageItems(filtered, currentPage, pageSize));
    renderPagination(filtered.length, totalPages);
  }

  function getFilteredOrders(orders, status, query) {
    var normalizedQuery = String(query || '').trim().toLowerCase();

    return (orders || []).filter(function(order) {
      if (status !== 'all' && order.status !== status) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return getOrderSearchText(order).indexOf(normalizedQuery) !== -1;
    });
  }

  function getOrderSearchText(order) {
    var itemText = (order.orderItems || []).map(function(item) {
      return [item.name, item.quantity, item.customizationDetails].join(' ');
    }).join(' ');

    return [
      order.orderId,
      order.customerName,
      order.phone,
      order.guestCount,
      order.diningDate,
      order.diningTime,
      order.status,
      itemText
    ].join(' ').toLowerCase();
  }

  function getPageItems(items, page, size) {
    var start = (page - 1) * size;
    return items.slice(start, start + size);
  }

  function renderOrders(orders) {
    var container = document.getElementById('ordersList');
    container.innerHTML = '';
    
    if (orders.length === 0) {
      container.innerHTML = '<p class="text-gray-500">無訂單資料</p>';
      return;
    }

    orders.forEach(function(order) {
      var card = document.createElement('div');
      card.className = 'bg-white rounded-lg p-4 shadow';
      
      var itemsStr = (order.orderItems || []).map(function(item) {
        return escapeHtml(item.name) + ' x' + escapeHtml(item.quantity);
      }).join(', ');
      
      var actionButtons = '';
      if (order.status === 'pending') {
        actionButtons = 
          '<button onclick="AdminOrders.changeStatus(\'' + order.orderId + '\', \'confirmed\')" class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm mr-2">接單</button>' +
          '<button onclick="AdminOrders.changeStatus(\'' + order.orderId + '\', \'cancelled\')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">取消</button>';
      } else if (order.status === 'confirmed') {
        actionButtons = 
          '<button onclick="AdminOrders.changeStatus(\'' + order.orderId + '\', \'completed\')" class="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm mr-2">完成</button>' +
          '<button onclick="AdminOrders.changeStatus(\'' + order.orderId + '\', \'cancelled\')" class="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm">取消</button>';
      }
      
      card.innerHTML = 
        '<div class="flex justify-between items-start">' +
          '<div>' +
            '<p class="font-bold">' + escapeHtml(order.orderId) + '</p>' +
            '<p class="text-sm text-gray-500">' + escapeHtml(order.timestamp) + '</p>' +
            '<p class="mt-2">' + escapeHtml(order.customerName) + ' | ' + escapeHtml(order.phone) + ' | ' + escapeHtml(order.guestCount) + ' 人</p>' +
            '<p class="text-sm">用餐時間: ' + escapeHtml(order.diningDate) + ' ' + escapeHtml(order.diningTime) + '</p>' +
            '<p class="text-sm mt-1">餐點: ' + itemsStr + '</p>' +
            (order.totalAmount ? '<p class="text-sm mt-1 font-semibold">總金額: $' + escapeHtml(order.totalAmount) + '</p>' : '') +
          '</div>' +
          '<div class="text-right">' +
            '<span class="px-2 py-1 rounded text-sm ' + getStatusClass(order.status) + '">' + getStatusLabel(order.status) + '</span>' +
            '<div class="mt-2">' + actionButtons + '</div>' +
          '</div>' +
        '</div>';
      
      container.appendChild(card);
    });
  }

  function changeStatus(orderId, newStatus) {
    var statusLabels = {
      'confirmed': '已接單',
      'completed': '已完成',
      'cancelled': '已取消'
    };
    
    pendingStatusChange = { orderId: orderId, status: newStatus, label: statusLabels[newStatus] || newStatus };
    showStatusModal();
  }

  function confirmStatusChange() {
    if (!pendingStatusChange) return;

    var change = pendingStatusChange;
    var confirmButton = document.getElementById('statusModalConfirm');
    if (confirmButton) {
      confirmButton.disabled = true;
      confirmButton.textContent = '更新中...';
    }
    clearError();
    
    AdminApi.updateOrderStatus({ orderId: change.orderId, status: change.status })
      .then(function(result) {
        closeStatusModal();
        loadOrders();
      })
      .catch(function(err) {
        showError('更新失敗: ' + err.message);
        if (confirmButton) {
          confirmButton.disabled = false;
          confirmButton.textContent = '確認更新';
        }
      });
  }

  function showStatusModal() {
    var modal = document.getElementById('statusModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'statusModal';
      modal.className = 'fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 px-4';
      modal.innerHTML =
        '<div class="w-full max-w-md rounded-lg bg-white p-6 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="statusModalTitle">' +
          '<h3 id="statusModalTitle" class="text-lg font-bold">更新訂單狀態</h3>' +
          '<p id="statusModalBody" class="mt-3 text-sm text-gray-600"></p>' +
          '<div class="mt-6 flex justify-end gap-2">' +
            '<button type="button" onclick="AdminOrders.closeStatusModal()" class="rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300">取消</button>' +
            '<button type="button" id="statusModalConfirm" onclick="AdminOrders.confirmStatusChange()" class="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">確認更新</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }

    document.getElementById('statusModalBody').textContent =
      '確定要將訂單 ' + pendingStatusChange.orderId + ' 改為「' + pendingStatusChange.label + '」嗎？';
    var confirmButton = document.getElementById('statusModalConfirm');
    confirmButton.disabled = false;
    confirmButton.textContent = '確認更新';
    modal.classList.remove('hidden');
    confirmButton.focus();
  }

  function closeStatusModal() {
    var modal = document.getElementById('statusModal');
    if (modal) modal.classList.add('hidden');
    pendingStatusChange = null;
  }

  function renderSummary(filteredCount, totalCount) {
    var summary = document.getElementById('ordersSummary');
    if (!summary) return;

    if (filteredCount === totalCount) {
      summary.textContent = '共 ' + totalCount + ' 筆訂單';
    } else {
      summary.textContent = '顯示 ' + filteredCount + ' 筆，全部 ' + totalCount + ' 筆';
    }
  }

  function renderPagination(totalItems, totalPages) {
    var container = document.getElementById('ordersPagination');
    if (!container) return;

    container.innerHTML = '';
    if (totalItems === 0 || totalPages <= 1) return;

    var prev = createPageButton('上一頁', currentPage - 1, currentPage === 1);
    container.appendChild(prev);

    for (var i = 1; i <= totalPages; i++) {
      var button = createPageButton(String(i), i, false);
      if (i === currentPage) {
        button.className = 'rounded bg-blue-500 px-3 py-1 text-sm text-white';
        button.setAttribute('aria-current', 'page');
      }
      container.appendChild(button);
    }

    var next = createPageButton('下一頁', currentPage + 1, currentPage === totalPages);
    container.appendChild(next);
  }

  function createPageButton(label, page, disabled) {
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.disabled = disabled;
    button.className = disabled
      ? 'rounded bg-gray-100 px-3 py-1 text-sm text-gray-400'
      : 'rounded bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300';
    button.onclick = function() { goToPage(page); };
    return button;
  }

  function setLoading(isLoading) {
    var loading = document.getElementById('ordersLoading');
    var list = document.getElementById('ordersList');
    if (!loading || !list) return;

    if (isLoading) {
      loading.classList.remove('hidden');
      list.classList.add('hidden');
    } else {
      loading.classList.add('hidden');
      list.classList.remove('hidden');
    }
  }

  function showError(message) {
    var error = document.getElementById('ordersError');
    if (!error) return;
    error.textContent = message;
    error.classList.remove('hidden');
  }

  function clearError() {
    var error = document.getElementById('ordersError');
    if (!error) return;
    error.textContent = '';
    error.classList.add('hidden');
  }

  function getStatusClass(status) {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusLabel(status) {
    switch(status) {
      case 'pending': return '已成立';
      case 'confirmed': return '已接單';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return status;
    }
  }

  return {
    loadOrders: loadOrders,
    filterByStatus: filterByStatus,
    setSearch: setSearch,
    setPageSize: setPageSize,
    goToPage: goToPage,
    changeStatus: changeStatus,
    confirmStatusChange: confirmStatusChange,
    closeStatusModal: closeStatusModal,
    getFilteredOrders: getFilteredOrders,
    getPageItems: getPageItems
  };
})();
