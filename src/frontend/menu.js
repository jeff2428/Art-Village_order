/**
 * menu.js
 * 菜單展示模組
 * 職責：菜單讀取、分類標籤切換、餐點展示
 */

var Menu = (function() {
  'use strict';
  
  var currentCategory = null;
  var selectedItems = {};
  var nextCartItemId = 1;
  var CART_STORAGE_KEY = 'artVillageCart';

  function init(menuData) {
    if (menuData && menuData.categories && menuData.categories.length > 0) {
      currentCategory = menuData.categories[0];
    } else {
      currentCategory = null;
    }
    loadCart();
  }

  function getCurrentCategory() {
    return currentCategory;
  }

  function setCurrentCategory(category) {
    currentCategory = category;
  }

  function getItemsByCategory(menuData, category) {
    if (!menuData || !menuData.items || !category) {
      return [];
    }

    return menuData.items
      .filter(function(item) {
        return item.category === category;
      })
      .sort(function(a, b) {
        var aSort = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
        var bSort = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
        if (aSort !== bSort) {
          return aSort - bSort;
        }
        return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
      });
  }

  function createCartKey(item, customizations) {
    var normalizedCustomizations = (customizations || []).map(function(customization) {
      return customization.optionName + ':' + customization.selectedValue;
    }).sort().join('|');
    return item.name + '::' + normalizedCustomizations;
  }

  function addToCart(item, customizations) {
    var key = createCartKey(item, customizations);
    if (!selectedItems[key]) {
      selectedItems[key] = {
        id: String(nextCartItemId++),
        key: key,
        item: item,
        quantity: 1,
        customizations: customizations || []
      };
    } else {
      selectedItems[key].quantity += 1;
    }
    saveCart();
  }

  function increaseCartItem(cartKey) {
    if (selectedItems[cartKey]) {
      selectedItems[cartKey].quantity += 1;
      saveCart();
    }
  }

  function removeFromCart(cartKey) {
    if (selectedItems[cartKey]) {
      if (selectedItems[cartKey].quantity > 1) {
        selectedItems[cartKey].quantity -= 1;
      } else {
        delete selectedItems[cartKey];
      }
      saveCart();
    }
  }

  function removeCartItem(cartKey) {
    delete selectedItems[cartKey];
    saveCart();
  }

  function getCart() {
    return selectedItems;
  }

  function getCartItems() {
    return Object.keys(selectedItems).map(function(key) {
      return selectedItems[key];
    });
  }

  function getCartCount() {
    var count = 0;
    for (var key in selectedItems) {
      count += selectedItems[key].quantity;
    }
    return count;
  }

  function getCartTotal() {
    var total = 0;
    for (var key in selectedItems) {
      total += selectedItems[key].item.price * selectedItems[key].quantity;
    }
    return total;
  }

  function clearCart() {
    selectedItems = {};
    nextCartItemId = 1;
    saveCart();
  }

  function saveCart() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({
        selectedItems: selectedItems,
        nextCartItemId: nextCartItemId
      }));
    } catch (err) {
      // 購物車保存失敗不應阻擋點餐流程。
    }
  }

  function loadCart() {
    try {
      if (typeof localStorage === 'undefined') return;
      var raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.selectedItems) return;
      selectedItems = parsed.selectedItems || {};
      nextCartItemId = parseInt(parsed.nextCartItemId, 10) || calculateNextCartItemId(selectedItems);
    } catch (err) {
      selectedItems = {};
      nextCartItemId = 1;
    }
  }

  function calculateNextCartItemId(items) {
    var maxId = 0;
    Object.keys(items || {}).forEach(function(key) {
      maxId = Math.max(maxId, parseInt(items[key].id, 10) || 0);
    });
    return maxId + 1;
  }

  return {
    init: init,
    getCurrentCategory: getCurrentCategory,
    setCurrentCategory: setCurrentCategory,
    getItemsByCategory: getItemsByCategory,
    addToCart: addToCart,
    increaseCartItem: increaseCartItem,
    removeFromCart: removeFromCart,
    removeCartItem: removeCartItem,
    getCart: getCart,
    getCartItems: getCartItems,
    getCartCount: getCartCount,
    getCartTotal: getCartTotal,
    clearCart: clearCart,
    saveCart: saveCart,
    loadCart: loadCart
  };
})();
