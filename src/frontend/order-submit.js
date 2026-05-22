/**
 * order-submit.js
 * 訂單送出模組
 * 職責：訂單送出、確認畫面渲染
 */

var OrderSubmit = (function() {
  'use strict';
  var isSubmitting = false;

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
        customizations: cartItem.customizations
      });
    }

    if (items.length === 0) {
      throw new Error('購物籃是空的');
    }
    
    return {
      customerName: reservation.customerName,
      phone: reservation.phone,
      guestCount: reservation.guestCount,
      diningDate: reservation.diningDate,
      diningTime: reservation.diningTime,
      items: items,
      liffUserId: liffUserId
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
