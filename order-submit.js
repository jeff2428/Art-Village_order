/**
 * order-submit.js
 * 訂單送出模組
 * 職責：訂單送出、確認畫面渲染
 */

var OrderSubmit = (function() {
  'use strict';
  var isSubmitting = false;

  var _idempotencyKey = null;

  function generateIdempotencyKey() {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr, function(b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function prepareOrderData() {
    var reservation = Reservation.getData();
    var cart = Menu.getCart();
    var liffUserId = LiffAuth.getUserId();

    if (!reservation) {
      throw new Error('請先填寫預約資訊');
    }
    
    var items = [];
    for (var key in cart) {
      var cartItem = cart[key];
      items.push({
        name: cartItem.item.name,
        quantity: cartItem.quantity,
        price: cartItem.item.price,
        customizations: cartItem.customizations,
        note: cartItem.note || ''
      });
    }

    if (items.length === 0) {
      throw new Error('購物籃是空的');
    }

    if (!_idempotencyKey) {
      _idempotencyKey = generateIdempotencyKey();
    }
    
    return {
      representative: reservation.representative || LiffAuth.getDisplayName() || '',
      customerName: reservation.customerName,
      phone: reservation.phone,
      guestCount: reservation.guestCount,
      diningDate: reservation.diningDate,
      diningTime: reservation.diningTime,
      items: items,
      liffUserId: liffUserId,
      idempotencyKey: _idempotencyKey
    };
  }

  function submit() {
    if (isSubmitting) {
      return Promise.reject(new Error('訂單正在送出中，請勿重複點擊'));
    }
    isSubmitting = true;
    setSubmitting(true);

    return Promise.resolve()
      .then(function() {
        var orderData = prepareOrderData();
        return Api.submitOrder(orderData);
      })
      .then(function(result) {
        showSuccess(result.orderId);
        var orderData = prepareOrderData();
        orderData.orderId = result.orderId;
        Api.sendOrderToLine(orderData).catch(function(err) {
          console.log('訂單通知送出失敗:', err);
        });
        return result;
      })
      .catch(function(err) {
        alert('訂單送出失敗: ' + err.message);
        throw err;
      })
      .then(function(result) {
        isSubmitting = false;
        setSubmitting(false);
        return result;
      }, function(err) {
        isSubmitting = false;
        setSubmitting(false);
        throw err;
      });
  }

  function setSubmitting(isSubmitting) {
    var checkoutBtn = document.getElementById('checkoutBtn');
    if (!checkoutBtn) {
      return;
    }
    checkoutBtn.disabled = isSubmitting;
    checkoutBtn.textContent = isSubmitting ? '送出中...' : '前往結帳';
  }

  function showSuccess(orderId) {
    var reservation = Reservation.getData();
    document.getElementById('mainScreen').classList.add('hidden');
    document.getElementById('successScreen').classList.remove('hidden');
    document.getElementById('orderIdDisplay').textContent = orderId;
    renderSuccessSummary(document.getElementById('orderSummaryDisplay'), reservation);
  }

  function renderSuccessSummary(container, reservation) {
    container.textContent = '';
    appendSummaryLine(container, '訂位代表：' + (reservation.representative || ''));
    appendSummaryLine(container, '訂位人：' + reservation.customerName);
    appendSummaryLine(container, '聯絡電話：' + reservation.phone);
    appendSummaryLine(container, '用餐人數：' + reservation.guestCount + ' 人');
    appendSummaryLine(container, '用餐時間：' + reservation.diningDate + ' ' + reservation.diningTime);
  }

  function appendSummaryLine(container, text) {
    var paragraph = document.createElement('p');
    paragraph.textContent = text;
    container.appendChild(paragraph);
  }

  function reset() {
    _idempotencyKey = null;
    Menu.clearCart();
    Reservation.reset();
    document.getElementById('successScreen').classList.add('hidden');
    document.getElementById('mainScreen').classList.remove('hidden');
    updateCartBar();
  }

  return {
    prepareOrderData: prepareOrderData,
    submit: submit,
    setSubmitting: setSubmitting,
    showSuccess: showSuccess,
    renderSuccessSummary: renderSuccessSummary,
    reset: reset
  };
})();
