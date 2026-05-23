/**
 * admin-menu.js
 * 管理後台 - POSKY-style 菜單管理模組
 */

var AdminMenu = (function() {
  'use strict';

  var fullMenuState = createEmptyState();
  var currentTab = 'products';
  var isDirty = false;
  var autoSaveTimer = null;
  var isAutoSaving = false;
  var pendingImport = null;
  var filters = {
    search: '',
    categoryId: 'all',
    status: 'all'
  };
  var selected = {
    categories: {},
    products: {},
    options: {}
  };

  var TABS = [
    { id: 'products', label: '餐點管理' },
    { id: 'categories', label: '分類管理' },
    { id: 'options', label: '附加屬性群組' }
  ];

  function createEmptyState() {
    return { categories: [], options: [], items: [] };
  }

  function load() {
    renderShell();
    setLoading(true);
    setMessage('', '');

    return AdminApi.call('getFullMenuState')
      .then(function(result) {
        fullMenuState = normalizeMenuState(result.data || createEmptyState());
        selected = { categories: {}, products: {}, options: {} };
        isDirty = false;
        renderShell();
        setLoading(false);
      })
      .catch(function(err) {
        setLoading(false);
        setMessage('error', '載入菜單失敗：' + err.message);
      });
  }

  function normalizeMenuState(state) {
    var categories = (state.categories || []).map(function(category, index) {
      return {
        id: String(category.id || makeId('cat', category.name, index)),
        name: String(category.name || ''),
        sortOrder: parseNumber(category.sortOrder, (index + 1) * 10),
        enabled: category.enabled !== false
      };
    }).filter(function(category) { return category.name; });

    var categoryNameById = {};
    categories.forEach(function(category) {
      categoryNameById[category.id] = category.name;
    });

    var options = (state.options || []).map(function(option, index) {
      var choices = uniqueStrings((option.choices || []).map(function(choice) {
        if (typeof choice === 'string') return choice;
        return choice && choice.name ? String(choice.name) : '';
      }));

      return {
        id: String(option.id || makeId('opt', option.name, index)),
        name: String(option.name || ''),
        type: option.type === 'multiple' ? 'multiple' : 'single',
        required: option.required === true,
        sortOrder: parseNumber(option.sortOrder, (index + 1) * 10),
        enabled: option.enabled !== false,
        choices: choices
      };
    }).filter(function(option) { return option.name; });

    var optionById = {};
    var optionByName = {};
    options.forEach(function(option) {
      optionById[option.id] = option;
      optionByName[option.name] = option;
    });

    var items = (state.items || []).map(function(item, index) {
      var categoryId = String(item.categoryId || findCategoryIdByName(categories, item.category) || '');
      var productId = String(item.id || makeId('item', item.name, index));
      var customizationOptions = (item.customizationOptions || []).map(function(itemOption) {
        var match = optionById[itemOption.id] || optionByName[itemOption.name];
        return match ? cloneOptionSummary(match) : null;
      }).filter(Boolean);

      return {
        id: productId,
        categoryId: categoryId,
        category: categoryNameById[categoryId] || String(item.category || ''),
        name: String(item.name || ''),
        description: String(item.description || ''),
        price: parseNumber(item.price, 0),
        soldOut: parseBoolean(item.soldOut, item.inStock === false),
        sortOrder: parseNumber(item.sortOrder, (index + 1) * 10),
        enabled: item.enabled !== false,
        imageUrl: String(item.imageUrl || ''),
        customizationOptions: customizationOptions
      };
    }).filter(function(item) { return item.name; });

    categories.sort(compareBySortThenName);
    options.sort(compareBySortThenName);
    items.sort(compareItems);

    return { categories: categories, options: options, items: items };
  }

  function cloneOptionSummary(option) {
    return {
      id: option.id,
      name: option.name,
      type: option.type,
      required: option.required,
      choices: (option.choices || []).slice()
    };
  }

  function renderShell() {
    var container = document.getElementById('menuTabContent');
    if (!container) return;

    container.innerHTML =
      '<div class="space-y-4">' +
        '<div id="menuMessage" class="hidden rounded border px-4 py-3 text-sm" role="status"></div>' +
        '<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">' +
          '<div>' +
            '<h3 class="text-xl font-bold text-gray-900">餐點管理</h3>' +
            '<p class="text-sm text-gray-500 mt-1">分類、餐點、附加屬性與批次匯入集中管理。</p>' +
          '</div>' +
          '<div class="flex flex-wrap gap-2">' +
            '<button type="button" onclick="AdminMenu.downloadSettings()" class="rounded bg-white px-3 py-2 text-sm font-bold text-gray-700 border hover:bg-gray-50">下載設定檔</button>' +
            '<button type="button" onclick="AdminMenu.openUploadDialog()" class="rounded bg-white px-3 py-2 text-sm font-bold text-gray-700 border hover:bg-gray-50">上傳設定檔</button>' +
            '<button type="button" onclick="AdminMenu.saveAll()" class="rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">立即儲存</button>' +
          '</div>' +
        '</div>' +
        '<div id="menuLoading" class="hidden space-y-3" aria-live="polite" aria-busy="true">' +
          '<div class="h-12 rounded bg-gray-200 animate-pulse"></div>' +
          '<div class="h-64 rounded bg-gray-200 animate-pulse"></div>' +
        '</div>' +
        '<div id="menuContent" class="space-y-4">' +
          renderTabs() +
          '<div id="menuToolbar"></div>' +
          '<div id="menuBody"></div>' +
        '</div>' +
        '<div id="menuDialogHost"></div>' +
      '</div>';

    renderTab();
  }

  function renderTabs() {
    return '<div class="border-b border-gray-200">' +
      '<div class="flex flex-wrap gap-4">' +
      TABS.map(function(tab) {
        var active = tab.id === currentTab;
        return '<button type="button" onclick="AdminMenu.switchTab(\'' + tab.id + '\')" id="tab-' + tab.id + '" class="' +
          (active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-700') +
          ' border-b-2 px-1 py-3 text-sm font-bold">' + tab.label + '</button>';
      }).join('') +
      '</div></div>';
  }

  function switchTab(tab) {
    currentTab = tab;
    renderShell();
  }

  function renderTab() {
    renderToolbar();
    if (currentTab === 'categories') renderCategories();
    if (currentTab === 'products') renderProducts();
    if (currentTab === 'options') renderOptions();
  }

  function renderToolbar() {
    var toolbar = document.getElementById('menuToolbar');
    if (!toolbar) return;

    if (currentTab === 'products') {
      toolbar.innerHTML =
        '<div class="grid gap-3 rounded border bg-gray-50 p-4 lg:grid-cols-[1fr_180px_160px_auto]">' +
          '<label class="block"><span class="mb-1 block text-xs font-bold text-gray-500">搜尋</span>' +
            '<input type="search" value="' + escapeAttribute(filters.search) + '" oninput="AdminMenu.setSearch(this.value)" placeholder="搜尋餐點名稱、描述或分類" class="w-full rounded border px-3 py-2"></label>' +
          '<label class="block"><span class="mb-1 block text-xs font-bold text-gray-500">分類</span>' +
            '<select onchange="AdminMenu.setCategoryFilter(this.value)" class="w-full rounded border px-3 py-2">' + renderCategoryOptions(filters.categoryId, true) + '</select></label>' +
          '<label class="block"><span class="mb-1 block text-xs font-bold text-gray-500">狀態</span>' +
            '<select onchange="AdminMenu.setStatusFilter(this.value)" class="w-full rounded border px-3 py-2">' +
              optionHtml('all', '全部', filters.status) +
              optionHtml('active', '上架中', filters.status) +
              optionHtml('disabled', '已停用', filters.status) +
              optionHtml('soldOut', '完售', filters.status) +
            '</select></label>' +
          '<div class="flex items-end gap-2">' +
            '<button type="button" onclick="AdminMenu.openProductForm()" class="rounded bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">新增餐點</button>' +
          '</div>' +
        '</div>' +
        renderBatchBar('products');
      return;
    }

    if (currentTab === 'categories') {
      toolbar.innerHTML = '<div class="flex flex-wrap justify-between gap-3 rounded border bg-gray-50 p-4">' +
        '<p class="text-sm text-gray-600">管理分類顯示名稱與狀態；顯示順序可直接拖曳調整。</p>' +
        '<button type="button" onclick="AdminMenu.openCategoryForm()" class="rounded bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">新增分類</button>' +
      '</div>' + renderBatchBar('categories');
      return;
    }

    if (currentTab === 'options') {
      toolbar.innerHTML = '<div class="flex flex-col gap-3 rounded border border-green-100 bg-green-50/60 p-4 md:flex-row md:items-center md:justify-between">' +
        '<div><h4 class="text-base font-bold text-gray-900">所有客製化群組</h4>' +
        '<p class="mt-1 text-sm text-gray-600">建立甜度、辣度、加料等附加屬性群組，並管理每個群組的選項值。</p></div>' +
        '<button type="button" onclick="AdminMenu.openOptionForm()" class="inline-flex items-center justify-center rounded bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-700">+ 新增群組</button>' +
      '</div>' + renderBatchBar('options');
      return;
    }

    toolbar.innerHTML = '';
  }

  function renderBatchBar(kind) {
    return '<div class="mt-3 flex flex-wrap items-center gap-2">' +
      '<button type="button" onclick="AdminMenu.batchSetEnabled(\'' + kind + '\', true)" class="rounded border px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">批次啟用</button>' +
      '<button type="button" onclick="AdminMenu.batchSetEnabled(\'' + kind + '\', false)" class="rounded border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700 hover:bg-orange-100">批次停用</button>' +
      '<button type="button" onclick="AdminMenu.batchDelete(\'' + kind + '\')" class="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-700 hover:bg-red-100">批次刪除</button>' +
    '</div>';
  }

  function renderCategories() {
    var body = document.getElementById('menuBody');
    var categoryIds = fullMenuState.categories.map(function(c) { return c.id; });
    body.innerHTML = renderTable(
      ['<input type="checkbox" onchange="AdminMenu.toggleAll(\'categories\', this.checked)">', '來源', '分類名稱', '狀態', '操作'],
      fullMenuState.categories.map(function(category) {
        return [
          checkboxCell('categories', category.id),
          '自行建立',
          '<span class="font-bold">' + escapeHtml(category.name) + '</span>',
          statusBadge(category.enabled, false),
          rowActions('Category', category.id)
        ];
      }),
      '尚未建立分類',
      'categories',
      categoryIds
    );
    initCategoryDrag();
  }

  function renderProducts() {
    var body = document.getElementById('menuBody');
    var products = filterProducts(fullMenuState.items, fullMenuState.categories, filters);
    var productIds = products.map(function(p) { return p.id; });
    body.innerHTML = renderTable(
      ['<input type="checkbox" onchange="AdminMenu.toggleAll(\'products\', this.checked)">', '來源', '分類', '餐點名稱', '價格', '狀態', '附加屬性', '操作'],
      products.map(function(item) {
        return [
          checkboxCell('products', item.id),
          '自行建立',
          escapeHtml(item.category || '未分類'),
          '<div class="font-bold text-gray-900">' + escapeHtml(item.name) + '</div><div class="text-xs text-gray-500">' + escapeHtml(item.description || '無描述') + '</div>',
          '$' + item.price,
          statusBadge(item.enabled, item.soldOut),
          (item.customizationOptions || []).map(function(option) { return '<span class="mr-1 inline-flex rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">' + escapeHtml(option.name) + '</span>'; }).join('') || '<span class="text-gray-400">無</span>',
          rowActions('Product', item.id)
        ];
      }),
      '沒有符合條件的餐點',
      'products',
      productIds
    );
    initProductDrag();
  }

  function renderOptions() {
    var body = document.getElementById('menuBody');
    if (!fullMenuState.options.length) {
      body.innerHTML =
        '<div class="rounded border border-dashed border-green-200 bg-white p-8 text-center">' +
          '<div class="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-xl text-green-700">+</div>' +
          '<h4 class="text-base font-bold text-gray-900">尚未建立客製化群組</h4>' +
          '<p class="mt-2 text-sm text-gray-500">新增甜度、辣度、配料等群組，讓餐點可以套用固定的客製化選項。</p>' +
          '<button type="button" onclick="AdminMenu.openOptionForm()" class="mt-4 rounded bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700">新增群組</button>' +
        '</div>';
      return;
    }

    var optionIds = fullMenuState.options.map(function(option) { return option.id; });
    body.innerHTML = renderTable(
      ['<input type="checkbox" onchange="AdminMenu.toggleAll(\'options\', this.checked)">', '來源', '群組名稱', '類型', '必填', '狀態', '選項值', '操作'],
      fullMenuState.options.map(function(option) {
        return [
          checkboxCell('options', option.id),
          '自行建立',
          '<span class="font-bold">' + escapeHtml(option.name) + '</span>',
          optionTypeBadge(option.type),
          requiredBadge(option.required),
          statusBadge(option.enabled, false),
          renderChoiceChips(option.choices || []),
          rowActions('Option', option.id)
        ];
      }),
      '尚未建立客製化群組',
      'options',
      optionIds
    );
    initOptionDrag();
  }

  function renderTable(headers, rows, emptyText, dragKind, rowIds) {
    if (!rows.length) {
      return '<div class="rounded border border-dashed bg-white p-8 text-center text-gray-500">' + emptyText + '</div>';
    }

    var dragColHtml = dragKind
      ? '<th class="whitespace-nowrap px-3 py-3 text-left font-bold w-10">拖曳</th>'
      : '';

    return '<div class="overflow-x-auto rounded border bg-white">' +
      '<table class="min-w-full divide-y divide-gray-200 text-sm">' +
        '<thead class="bg-yellow-300 text-gray-900"><tr>' +
          headers.map(function(header) { return '<th class="whitespace-nowrap px-3 py-3 text-left font-bold">' + header + '</th>'; }).join('') +
          dragColHtml +
        '</tr></thead>' +
        '<tbody class="divide-y divide-gray-100">' +
          rows.map(function(row, index) {
            var dragId = rowIds && rowIds[index] ? escapeAttribute(rowIds[index]) : '';
            var dragCell = dragKind
              ? '<td class="px-3 py-3 align-top"><span class="drag-handle cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 select-none" data-drag-kind="' + escapeAttribute(dragKind) + '" data-drag-id="' + dragId + '" data-drag-index="' + index + '">⠿</span></td>'
              : '';
            var dragIdAttr = dragId ? ' data-drag-id="' + dragId + '" data-drag-kind="' + escapeAttribute(dragKind) + '"' : '';
            return '<tr class="' + (index % 2 === 0 ? 'bg-yellow-50/60' : 'bg-white') + '" data-drag-row="' + index + '"' + dragIdAttr + '>' +
              row.map(function(cell) { return '<td class="px-3 py-3 align-top">' + cell + '</td>'; }).join('') +
              dragCell +
            '</tr>';
          }).join('') +
        '</tbody>' +
      '</table>' +
    '</div>';
  }

  function checkboxCell(kind, id) {
    return '<input type="checkbox" ' + (selected[kind][id] ? 'checked' : '') + ' onchange="AdminMenu.toggleSelected(\'' + kind + '\', \'' + escapeAttribute(id) + '\', this.checked)">';
  }

  function rowActions(entity, id) {
    return '<div class="flex flex-wrap gap-2">' +
      '<button type="button" onclick="AdminMenu.open' + entity + 'Form(\'' + escapeAttribute(id) + '\')" class="text-sm font-bold text-blue-600 hover:text-blue-800">修改</button>' +
      '<button type="button" onclick="AdminMenu.delete' + entity + '(\'' + escapeAttribute(id) + '\')" class="text-sm font-bold text-red-600 hover:text-red-800">刪除</button>' +
    '</div>';
  }

  function statusBadge(enabled, soldOut) {
    if (!enabled) return '<span class="rounded bg-red-100 px-2 py-1 text-xs font-bold text-red-700">停用中</span>';
    if (soldOut) return '<span class="rounded bg-orange-100 px-2 py-1 text-xs font-bold text-orange-700">完售</span>';
    return '<span class="rounded bg-green-100 px-2 py-1 text-xs font-bold text-green-700">啟用</span>';
  }

  function optionTypeBadge(type) {
    return type === 'multiple'
      ? '<span class="rounded bg-purple-50 px-2 py-1 text-xs font-bold text-purple-700">多選</span>'
      : '<span class="rounded bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">單選</span>';
  }

  function requiredBadge(required) {
    return required
      ? '<span class="rounded bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">必填</span>'
      : '<span class="rounded bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">非必填</span>';
  }

  function renderChoiceChips(choices) {
    var values = uniqueStrings(choices || []);
    if (!values.length) return '<span class="text-sm text-gray-400">尚未設定選項</span>';
    return values.map(function(choice) {
      return '<span class="rounded-full border border-green-100 bg-green-50 px-3 py-1 text-sm font-bold text-green-700">' + escapeHtml(choice) + '</span>';
    }).join('');
  }

  function openCategoryForm(id) {
    var category = findById(fullMenuState.categories, id) || { id: '', name: '', sortOrder: nextSort(fullMenuState.categories), enabled: true };
    var isNewCategory = !category.id;
    var categoryNameLimit = 15;

    openDialog(isNewCategory ? '新增分類' : '編輯分類',
      '<label class="block"><span class="mb-1 block text-sm font-bold">分類名稱</span><input id="menuFormName" value="' + escapeAttribute(category.name) + '" maxlength="' + categoryNameLimit + '" placeholder="例如：火鍋、飯類、飲品" data-autofocus="true" class="w-full rounded border px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"></label>' +
      '<div class="-mt-3 text-right text-xs text-gray-500"><span id="menuFormNameCount">' + String(Array.from(category.name || '').length) + '</span>/' + categoryNameLimit + '</div>' +
      '<input id="menuFormSort" type="hidden" value="' + category.sortOrder + '">' +
      '<label class="flex items-center gap-2"><input id="menuFormEnabled" type="checkbox" ' + (category.enabled ? 'checked' : '') + '> 啟用</label>',
      function() {
        var input = {
          id: category.id || makeId('cat', getValue('menuFormName'), fullMenuState.categories.length),
          name: getValue('menuFormName').trim(),
          sortOrder: parseNumber(getValue('menuFormSort'), nextSort(fullMenuState.categories)),
          enabled: isChecked('menuFormEnabled')
        };
        if (!input.name) return setDialogError('請輸入分類名稱');
        upsert(fullMenuState.categories, input);
        syncItemCategoryNames();
        markDirtyAndRender();
        closeDialog();
      },
      {
        submitText: isNewCategory ? '確認新增' : '儲存變更',
        submitClass: 'rounded bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300',
        initialFocusId: 'menuFormName'
      }
    );

    wireRequiredNameField(categoryNameLimit);
  }

  function openProductForm(id) {
    var item = findById(fullMenuState.items, id) || {
      id: '',
      categoryId: fullMenuState.categories[0] ? fullMenuState.categories[0].id : '',
      category: fullMenuState.categories[0] ? fullMenuState.categories[0].name : '',
      name: '',
      description: '',
      price: 0,
      sortOrder: nextSort(fullMenuState.items),
      enabled: true,
      imageUrl: '',
      customizationOptions: []
    };
    var selectedOptionIds = {};
    (item.customizationOptions || []).forEach(function(option) { selectedOptionIds[option.id] = true; });

    openDialog('餐點設定',
      '<div class="grid gap-3 md:grid-cols-2">' +
        '<label class="block md:col-span-2"><span class="mb-1 block text-sm font-bold">餐點名稱 *</span><input id="menuFormName" value="' + escapeAttribute(item.name) + '" class="w-full rounded border px-3 py-2"></label>' +
        '<label class="block"><span class="mb-1 block text-sm font-bold">分類 *</span><select id="menuFormCategory" class="w-full rounded border px-3 py-2">' + renderCategoryOptions(item.categoryId, false) + '</select></label>' +
        '<label class="block"><span class="mb-1 block text-sm font-bold">價格 *</span><input id="menuFormPrice" type="number" min="0" value="' + item.price + '" class="w-full rounded border px-3 py-2"></label>' +
        '<label class="block md:col-span-2"><span class="mb-1 block text-sm font-bold">描述</span><textarea id="menuFormDescription" rows="3" class="w-full rounded border px-3 py-2">' + escapeHtml(item.description) + '</textarea></label>' +
        '<label class="block md:col-span-2"><span class="mb-1 block text-sm font-bold">圖片 URL</span><input id="menuFormImageUrl" value="' + escapeAttribute(item.imageUrl) + '" class="w-full rounded border px-3 py-2"></label>' +
        '<input id="menuFormSort" type="hidden" value="' + item.sortOrder + '">' +
        '<div class="flex flex-wrap items-end gap-4">' +
          '<label class="flex items-center gap-2"><input id="menuFormEnabled" type="checkbox" ' + (item.enabled ? 'checked' : '') + '> 啟用</label>' +
        '</div>' +
      '</div>' +
      '<div class="mt-4"><div class="mb-2 text-sm font-bold">綁定附加屬性</div>' +
        '<div class="grid gap-2 md:grid-cols-2">' +
        fullMenuState.options.map(function(option) {
          return '<label class="flex items-start gap-2 rounded border p-2 text-sm"><input type="checkbox" data-option-bind="' + escapeAttribute(option.id) + '" ' + (selectedOptionIds[option.id] ? 'checked' : '') + '><span><span class="font-bold">' + escapeHtml(option.name) + '</span><br><span class="text-xs text-gray-500">' + escapeHtml((option.choices || []).join('、')) + '</span></span></label>';
        }).join('') +
        '</div></div>',
      function() {
        var input = {
          id: item.id || makeId('item', getValue('menuFormName'), fullMenuState.items.length),
          categoryId: getValue('menuFormCategory'),
          name: getValue('menuFormName').trim(),
          description: getValue('menuFormDescription').trim(),
          price: parseNumber(getValue('menuFormPrice'), -1),
          sortOrder: parseNumber(getValue('menuFormSort'), nextSort(fullMenuState.items)),
          enabled: isChecked('menuFormEnabled'),
          imageUrl: getValue('menuFormImageUrl').trim(),
          customizationOptions: getCheckedOptionSummaries()
        };
        var validation = validateProductInput(input, fullMenuState, item.id);
        if (!validation.valid) return setDialogError(validation.errors.join('、'));
        var category = findById(fullMenuState.categories, input.categoryId);
        input.category = category ? category.name : '';
        upsert(fullMenuState.items, input);
        markDirtyAndRender();
        closeDialog();
      }
    );
  }

  function openOptionForm(id) {
    var option = findById(fullMenuState.options, id) || {
      id: '',
      name: '',
      type: 'single',
      required: false,
      sortOrder: nextSort(fullMenuState.options),
      enabled: true,
      choices: []
    };

    var isNewOption = !option.id;
    var optionNameLimit = 15;

    openDialog(isNewOption ? '新增客製化群組' : '編輯客製化群組',
      '<label class="block"><span class="mb-1 block text-sm font-bold">群組名稱</span><input id="menuFormName" value="' + escapeAttribute(option.name) + '" maxlength="' + optionNameLimit + '" placeholder="例如：甜度、加麵、配料" data-autofocus="true" class="w-full rounded border px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"></label>' +
      '<div class="-mt-3 text-right text-xs text-gray-500"><span id="menuFormNameCount">' + String(Array.from(option.name || '').length) + '</span>/' + optionNameLimit + '</div>' +
      '<div class="grid gap-3 md:grid-cols-2">' +
        '<label class="block"><span class="mb-1 block text-sm font-bold">選擇類型</span><select id="menuFormType" class="w-full rounded border px-3 py-2">' + optionHtml('single', '單選', option.type) + optionHtml('multiple', '多選', option.type) + '</select></label>' +
        '<label class="block"><span class="mb-1 block text-sm font-bold">排序</span><input id="menuFormSort" type="number" value="' + option.sortOrder + '" class="w-full rounded border px-3 py-2"></label>' +
      '</div>' +
      '<label class="block"><span class="mb-1 block text-sm font-bold">選項值 *</span><textarea id="menuFormChoices" rows="4" placeholder="每行一個，例如：正常冰" class="w-full rounded border px-3 py-2">' + escapeHtml((option.choices || []).join('\n')) + '</textarea></label>' +
      '<div class="flex flex-wrap gap-4">' +
        '<label class="flex items-center gap-2"><input id="menuFormRequired" type="checkbox" ' + (option.required ? 'checked' : '') + '> 必填</label>' +
        '<label class="flex items-center gap-2"><input id="menuFormEnabled" type="checkbox" ' + (option.enabled ? 'checked' : '') + '> 啟用</label>' +
      '</div>',
      function() {
        var input = {
          id: option.id || makeId('opt', getValue('menuFormName'), fullMenuState.options.length),
          name: getValue('menuFormName').trim(),
          type: getValue('menuFormType') === 'multiple' ? 'multiple' : 'single',
          required: isChecked('menuFormRequired'),
          sortOrder: parseNumber(getValue('menuFormSort'), nextSort(fullMenuState.options)),
          enabled: isChecked('menuFormEnabled'),
          choices: uniqueStrings(getValue('menuFormChoices').split(/\r?\n|,/))
        };
        if (!input.name) return setDialogError('請輸入群組名稱');
        if (!input.choices.length) return setDialogError('請至少輸入一個選項值');
        upsert(fullMenuState.options, input);
        syncProductOptionDetails(input);
        markDirtyAndRender();
        closeDialog();
      },
      {
        submitText: isNewOption ? '確認新增' : '儲存變更',
        submitClass: 'rounded bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 disabled:hover:bg-gray-300',
        initialFocusId: 'menuFormName'
      }
    );

    wireOptionFormValidation(optionNameLimit);
  }

  function openDialog(title, bodyHtml, onSubmit, options) {
    options = options || {};
    var host = document.getElementById('menuDialogHost');
    var submitText = options.submitText || '套用';
    var submitClass = options.submitClass || 'rounded bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700';
    host.innerHTML =
      '<div id="menuDialogOverlay" class="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4">' +
        '<div class="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl" role="dialog" aria-modal="true" aria-labelledby="menuDialogTitle">' +
          '<div class="flex items-center justify-between border-b px-5 py-4">' +
            '<h4 id="menuDialogTitle" class="text-lg font-bold text-gray-900">' + escapeHtml(title) + '</h4>' +
            '<button type="button" onclick="AdminMenu.closeDialog()" class="rounded px-2 py-1 text-gray-500 hover:bg-gray-100" aria-label="關閉">×</button>' +
          '</div>' +
          '<div class="space-y-4 p-5">' +
            '<div id="menuDialogError" class="hidden rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"></div>' +
            bodyHtml +
          '</div>' +
          '<div class="flex justify-end gap-2 border-t bg-gray-50 px-5 py-4">' +
            '<button type="button" onclick="AdminMenu.closeDialog()" class="rounded border border-gray-300 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50">取消</button>' +
            '<button type="button" id="menuDialogSubmit" class="' + submitClass + '">' + escapeHtml(submitText) + '</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.getElementById('menuDialogSubmit').onclick = onSubmit;
    document.getElementById('menuDialogOverlay').onclick = function(event) {
      if (event.target && event.target.id === 'menuDialogOverlay') closeDialog();
    };
    document.onkeydown = function(event) {
      if (event && event.key === 'Escape') closeDialog();
    };
    focusDialogField(options.initialFocusId);
  }

  function closeDialog() {
    var host = document.getElementById('menuDialogHost');
    if (host) host.innerHTML = '';
    if (typeof document !== 'undefined') document.onkeydown = null;
  }

  function setDialogError(message) {
    var el = document.getElementById('menuDialogError');
    if (!el) return;
    el.textContent = message;
    el.className = 'rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700';
  }

  function wireOptionFormValidation(limit) {
    var input = document.getElementById('menuFormName');
    var choicesInput = document.getElementById('menuFormChoices');
    var counter = document.getElementById('menuFormNameCount');
    var submit = document.getElementById('menuDialogSubmit');
    if (!input || !counter || !submit) return;

    function refresh() {
      var chars = Array.from(input.value || '');
      if (chars.length > limit) {
        input.value = chars.slice(0, limit).join('');
        chars = Array.from(input.value || '');
      }
      counter.textContent = String(chars.length);
      var choices = choicesInput ? uniqueStrings(choicesInput.value.split(/\r?\n|,/)) : [];
      submit.disabled = input.value.trim().length === 0 || choices.length === 0;
    }

    input.oninput = refresh;
    if (choicesInput) choicesInput.oninput = refresh;
    refresh();
  }

  function wireRequiredNameField(limit) {
    var input = document.getElementById('menuFormName');
    var counter = document.getElementById('menuFormNameCount');
    var submit = document.getElementById('menuDialogSubmit');
    if (!input || !counter || !submit) return;

    function refresh() {
      var chars = Array.from(input.value || '');
      if (chars.length > limit) {
        input.value = chars.slice(0, limit).join('');
        chars = Array.from(input.value || '');
      }
      counter.textContent = String(chars.length);
      submit.disabled = input.value.trim().length === 0;
    }

    input.oninput = refresh;
    refresh();
  }

  function focusDialogField(id) {
    var target = id ? document.getElementById(id) : null;
    if (!target && document.querySelector) target = document.querySelector('[data-autofocus="true"]');
    if (!target || !target.focus) return;
    var focus = function() {
      target.focus();
      if (target.select) target.select();
    };
    if (typeof setTimeout === 'function') setTimeout(focus, 0);
    else focus();
  }

  function deleteCategory(id) {
    if (!confirm('確定要刪除此分類？餐點會變成未分類。')) return;
    fullMenuState.categories = fullMenuState.categories.filter(function(category) { return category.id !== id; });
    fullMenuState.items.forEach(function(item) {
      if (item.categoryId === id) {
        item.categoryId = '';
        item.category = '';
      }
    });
    markDirtyAndRender();
  }

  function deleteProduct(id) {
    if (!confirm('確定要刪除此餐點？')) return;
    fullMenuState.items = fullMenuState.items.filter(function(item) { return item.id !== id; });
    markDirtyAndRender();
  }

  function deleteOption(id) {
    if (!confirm('確定要刪除此附加屬性群組？餐點綁定也會移除。')) return;
    fullMenuState.options = fullMenuState.options.filter(function(option) { return option.id !== id; });
    fullMenuState.items.forEach(function(item) {
      item.customizationOptions = (item.customizationOptions || []).filter(function(option) { return option.id !== id; });
    });
    markDirtyAndRender();
  }

  function batchSetEnabled(kind, enabled) {
    getSelectedTargets(kind).forEach(function(target) {
      target.enabled = enabled;
    });
    clearSelected(kind);
    markDirtyAndRender();
  }

  function batchDelete(kind) {
    var ids = Object.keys(selected[kind]).filter(function(id) { return selected[kind][id]; });
    if (!ids.length) return;
    if (!confirm('確定要刪除已選取項目？')) return;
    if (kind === 'categories') ids.forEach(deleteCategoryDirect);
    if (kind === 'products') fullMenuState.items = fullMenuState.items.filter(function(item) { return ids.indexOf(item.id) === -1; });
    if (kind === 'options') ids.forEach(deleteOptionDirect);
    clearSelected(kind);
    markDirtyAndRender();
  }

  function deleteCategoryDirect(id) {
    fullMenuState.categories = fullMenuState.categories.filter(function(category) { return category.id !== id; });
    fullMenuState.items.forEach(function(item) {
      if (item.categoryId === id) {
        item.categoryId = '';
        item.category = '';
      }
    });
  }

  function deleteOptionDirect(id) {
    fullMenuState.options = fullMenuState.options.filter(function(option) { return option.id !== id; });
    fullMenuState.items.forEach(function(item) {
      item.customizationOptions = (item.customizationOptions || []).filter(function(option) { return option.id !== id; });
    });
  }

  function getSelectedTargets(kind) {
    var source = kind === 'categories' ? fullMenuState.categories : kind === 'products' ? fullMenuState.items : fullMenuState.options;
    return source.filter(function(item) { return selected[kind][item.id]; });
  }

  function getSelectedIds(kind) {
    return Object.keys(selected[kind] || {}).filter(function(id) { return selected[kind][id]; });
  }

  function toggleSelected(kind, id, checked) {
    selected[kind][id] = checked;
  }

  function toggleAll(kind, checked) {
    var source = kind === 'categories' ? fullMenuState.categories : kind === 'products' ? filterProducts(fullMenuState.items, fullMenuState.categories, filters) : fullMenuState.options;
    source.forEach(function(item) {
      selected[kind][item.id] = checked;
    });
    renderTab();
  }

  function clearSelected(kind) {
    selected[kind] = {};
  }

  function setSearch(value) {
    filters.search = value || '';
    renderProducts();
  }

  function setCategoryFilter(value) {
    filters.categoryId = value || 'all';
    renderProducts();
  }

  function setStatusFilter(value) {
    filters.status = value || 'all';
    renderProducts();
  }

  function saveAll(options) {
    options = options || {};
    setMessage('', '');
    var payload = normalizeMenuState(fullMenuState);
    isAutoSaving = !!options.auto;
    if (isAutoSaving) setMessage('success', '正在自動儲存...');
    return AdminApi.call('updateFullMenuState', { menuState: payload })
      .then(function() {
        fullMenuState = payload;
        isDirty = false;
        setMessage('success', options.auto ? '已自動儲存。前台會讀取最新設定。' : '菜單已儲存。前台會讀取最新設定。');
      })
      .catch(function(err) {
        setMessage('error', '儲存失敗：' + err.message);
      })
      .finally(function() {
        isAutoSaving = false;
      });
  }

  function openUploadDialog() {
    openDialog('上傳設定檔',
      '<p class="text-sm text-gray-600">請上傳包含 Categories、Products、OptionGroups、OptionItems、ProductOptions 的 .xlsx 設定檔。上傳後會直接套用所有設定。</p>' +
      '<input id="menuUploadFile" type="file" accept=".xlsx,.xls" class="w-full rounded border px-3 py-2">' +
      '<div id="menuUploadStatus" class="rounded border bg-gray-50 p-3 text-sm text-gray-600">尚未選擇檔案</div>',
      function() {
        var file = document.getElementById('menuUploadFile').files && document.getElementById('menuUploadFile').files[0];
        if (!file) return setDialogError('請先選擇檔案');
        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            if (typeof XLSX === 'undefined') {
              setDialogError('找不到 SheetJS 套件，請確認 vendor/xlsx.full.min.js 已載入。');
              return;
            }
            var workbook = XLSX.read(e.target.result, { type: 'array' });
            var rows = {
              categories: readWorkbookSheet(workbook, 'Categories', XLSX),
              products: readWorkbookSheet(workbook, 'Products', XLSX),
              optionGroups: readWorkbookSheet(workbook, 'OptionGroups', XLSX),
              optionItems: readWorkbookSheet(workbook, 'OptionItems', XLSX),
              productOptions: readWorkbookSheet(workbook, 'ProductOptions', XLSX)
            };
            var preview = previewImportRows(rows);
            if (preview.errors.length) {
              setDialogError('驗證失敗：' + preview.errors.join('、'));
              return;
            }
            fullMenuState = normalizeMenuState({
              categories: preview.categories,
              options: preview.options,
              items: preview.items
            });
            isDirty = true;
            closeDialog();
            renderShell();
            setMessage('success', '設定檔已套用：分類 ' + preview.summary.categories + ' 筆、餐點 ' + preview.summary.items + ' 筆、附加屬性群組 ' + preview.summary.options + ' 組。正在自動儲存。');
            scheduleAutoSave();
          } catch (err) {
            setDialogError('讀取失敗：' + err.message);
          }
        };
        reader.readAsArrayBuffer(file);
      }
    );

    document.getElementById('menuUploadFile').onchange = function() {
      var el = document.getElementById('menuUploadStatus');
      var file = this.files && this.files[0];
      if (!file) {
        el.innerHTML = '尚未選擇檔案';
        return;
      }
      el.innerHTML = '<div class="font-bold text-green-700">已選擇：' + escapeHtml(file.name) + '</div><div class="mt-1 text-xs text-gray-500">檔案大小：' + (file.size / 1024).toFixed(1) + ' KB</div>';
    };
  }

  function downloadSettings() {
    if (typeof XLSX === 'undefined') {
      setMessage('error', '找不到 SheetJS 匯出套件，無法建立設定檔。');
      return;
    }

    var sheets = buildTemplateSheets(fullMenuState);
    var workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.categories), 'Categories');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.optionGroups), 'OptionGroups');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.optionItems), 'OptionItems');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.products), 'Products');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheets.productOptions), 'ProductOptions');

    var fileName = '藝素村菜單設定_' + new Date().toISOString().slice(0, 10) + '.xlsx';
    XLSX.writeFile(workbook, fileName);
    setMessage('success', '設定檔已下載：' + fileName);
  }

  function buildTemplateSheets(stateSource) {
    var state = normalizeMenuState(stateSource || fullMenuState);
    var catRows = [['categoryId', 'name', 'sortOrder', 'enabled']];
    var ogRows = [['groupId', 'name', 'type', 'required', 'sortOrder', 'enabled']];
    var oiRows = [['optionItemId', 'groupId', 'name', 'sortOrder', 'enabled']];
    var prodRows = [['productId', 'categoryId', 'name', 'description', 'price', 'soldOut', 'sortOrder', 'enabled', 'imageUrl']];
    var poRows = [['productId', 'groupId', 'sortOrder', 'enabled']];

    (state.categories || []).forEach(function(c) {
      catRows.push([c.id, c.name, c.sortOrder, c.enabled]);
    });

    (state.options || []).forEach(function(o) {
      ogRows.push([o.id, o.name, o.type, o.required, o.sortOrder, o.enabled]);
      (o.choices || []).forEach(function(choice, idx) {
        oiRows.push([makeId('choice', o.id + '-' + choice, idx), o.id, choice, (idx + 1) * 10, true]);
      });
    });

    (state.items || []).forEach(function(p) {
      prodRows.push([p.id, p.categoryId, p.name, p.description || '', p.price, p.soldOut, p.sortOrder, p.enabled, p.imageUrl || '']);
      (p.customizationOptions || []).forEach(function(opt, idx) {
        poRows.push([p.id, opt.id, (idx + 1) * 10, true]);
      });
    });

    return {
      categories: catRows,
      optionGroups: ogRows,
      optionItems: oiRows,
      products: prodRows,
      productOptions: poRows
    };
  }

  function previewImportWorkbook(workbook, currentState, xlsxApi) {
    var rows = {
      categories: readWorkbookSheet(workbook, 'Categories', xlsxApi),
      products: readWorkbookSheet(workbook, 'Products', xlsxApi),
      optionGroups: readWorkbookSheet(workbook, 'OptionGroups', xlsxApi),
      optionItems: readWorkbookSheet(workbook, 'OptionItems', xlsxApi),
      productOptions: readWorkbookSheet(workbook, 'ProductOptions', xlsxApi)
    };
    return previewImportRows(rows, currentState);
  }

  function readWorkbookSheet(workbook, sheetName, xlsxApi) {
    var sheet = workbook.Sheets ? workbook.Sheets[sheetName] : workbook[sheetName];
    if (!sheet) return [];
    if (Array.isArray(sheet)) return sheet;
    if (!xlsxApi || !xlsxApi.utils) return [];
    return xlsxApi.utils.sheet_to_json(sheet, { defval: '' });
  }

  function previewImportRows(rows) {
    var errors = [];
    var categoryIds = {};
    var productIds = {};
    var groupIds = {};
    var optionItemIds = {};
    var optionItemsByGroup = {};

    var categories = normalizeImportRows(rows.categories).map(function(row, index) {
      var category = {
        id: String(row.categoryId || '').trim(),
        name: String(row.name || '').trim(),
        sortOrder: parseNumber(row.sortOrder, (index + 1) * 10),
        enabled: parseBoolean(row.enabled, true)
      };
      if (!category.id) errors.push('Categories 第 ' + (index + 2) + ' 列缺少 categoryId');
      if (!category.name) errors.push('Categories 第 ' + (index + 2) + ' 列缺少 name');
      if (categoryIds[category.id]) errors.push('Categories categoryId 重複：' + category.id);
      categoryIds[category.id] = true;
      return category;
    });

    var options = normalizeImportRows(rows.optionGroups).map(function(row, index) {
      var option = {
        id: String(row.groupId || '').trim(),
        name: String(row.name || '').trim(),
        type: String(row.type || 'single') === 'multiple' ? 'multiple' : 'single',
        required: parseBoolean(row.required, false),
        sortOrder: parseNumber(row.sortOrder, (index + 1) * 10),
        enabled: parseBoolean(row.enabled, true),
        choices: []
      };
      if (!option.id) errors.push('OptionGroups 第 ' + (index + 2) + ' 列缺少 groupId');
      if (!option.name) errors.push('OptionGroups 第 ' + (index + 2) + ' 列缺少 name');
      if (groupIds[option.id]) errors.push('OptionGroups groupId 重複：' + option.id);
      groupIds[option.id] = option;
      return option;
    });

    normalizeImportRows(rows.optionItems).forEach(function(row, index) {
      var itemId = String(row.optionItemId || '').trim();
      var groupId = String(row.groupId || '').trim();
      var name = String(row.name || '').trim();
      if (!itemId) errors.push('OptionItems 第 ' + (index + 2) + ' 列缺少 optionItemId');
      if (!groupId) errors.push('OptionItems 第 ' + (index + 2) + ' 列缺少 groupId');
      if (!name) errors.push('OptionItems 第 ' + (index + 2) + ' 列缺少 name');
      if (itemId && optionItemIds[itemId]) errors.push('OptionItems optionItemId 重複：' + itemId);
      optionItemIds[itemId] = true;
      if (groupId && !groupIds[groupId]) errors.push('OptionItems 參照不存在的 groupId：' + groupId);
      if (!parseBoolean(row.enabled, true)) return;
      if (!optionItemsByGroup[groupId]) optionItemsByGroup[groupId] = [];
      optionItemsByGroup[groupId].push({
        name: name,
        sortOrder: parseNumber(row.sortOrder, (index + 1) * 10)
      });
    });

    options.forEach(function(option) {
      option.choices = uniqueStrings((optionItemsByGroup[option.id] || []).sort(compareBySortThenName).map(function(choice) { return choice.name; }));
    });

    var optionById = {};
    options.forEach(function(option) { optionById[option.id] = option; });

    var productOptionIdsByProduct = {};
    normalizeImportRows(rows.productOptions).forEach(function(row, index) {
      var productId = String(row.productId || '').trim();
      var groupId = String(row.groupId || '').trim();
      if (!productId) errors.push('ProductOptions 第 ' + (index + 2) + ' 列缺少 productId');
      if (!groupId) errors.push('ProductOptions 第 ' + (index + 2) + ' 列缺少 groupId');
      if (groupId && !groupIds[groupId]) errors.push('ProductOptions 參照不存在的 groupId：' + groupId);
      if (!parseBoolean(row.enabled, true)) return;
      if (!productOptionIdsByProduct[productId]) productOptionIdsByProduct[productId] = [];
      productOptionIdsByProduct[productId].push(groupId);
    });

    var categoryNameById = {};
    categories.forEach(function(category) { categoryNameById[category.id] = category.name; });

    var items = normalizeImportRows(rows.products).map(function(row, index) {
      var price = parseNumber(row.price, NaN);
      var product = {
        id: String(row.productId || '').trim(),
        categoryId: String(row.categoryId || '').trim(),
        category: categoryNameById[String(row.categoryId || '').trim()] || '',
        name: String(row.name || '').trim(),
        description: String(row.description || '').trim(),
        price: price,
        sortOrder: parseNumber(row.sortOrder, (index + 1) * 10),
        enabled: parseBoolean(row.enabled, true),
        imageUrl: String(row.imageUrl || '').trim(),
        customizationOptions: []
      };
      if (!product.id) errors.push('Products 第 ' + (index + 2) + ' 列缺少 productId');
      if (!product.categoryId) errors.push('Products 第 ' + (index + 2) + ' 列缺少 categoryId');
      if (product.categoryId && !categoryIds[product.categoryId]) errors.push('Products 參照不存在的 categoryId：' + product.categoryId);
      if (!product.name) errors.push('Products 第 ' + (index + 2) + ' 列缺少 name');
      if (isNaN(price) || price < 0) errors.push('Products「' + (product.name || product.id) + '」價格需為非負數');
      if (productIds[product.id]) errors.push('Products productId 重複：' + product.id);
      productIds[product.id] = true;
      product.customizationOptions = (productOptionIdsByProduct[product.id] || []).map(function(groupId) {
        return cloneOptionSummary(optionById[groupId]);
      }).filter(Boolean);
      return product;
    });

    Object.keys(productOptionIdsByProduct).forEach(function(productId) {
      if (!productIds[productId]) errors.push('ProductOptions 參照不存在的 productId：' + productId);
    });

    return {
      errors: unique(errors),
      categories: categories,
      options: options,
      items: items,
      summary: {
        categories: categories.length,
        options: options.length,
        items: items.length,
        bindings: normalizeImportRows(rows.productOptions).length
      }
    };
  }

  function normalizeImportRows(rows) {
    return (rows || []).filter(function(row) {
      return Object.keys(row || {}).some(function(key) {
        return String(row[key] || '').trim() !== '';
      });
    });
  }

  function applyImportPreview(currentState, preview) {
    if (preview.errors && preview.errors.length) return currentState;
    return normalizeMenuState({
      categories: preview.categories,
      options: preview.options,
      items: preview.items
    });
  }

  function filterProducts(items, categories, activeFilters) {
    var categoryById = {};
    categories.forEach(function(category) { categoryById[category.id] = category; });
    var query = String(activeFilters.search || '').trim().toLowerCase();
    return (items || []).filter(function(item) {
      if (activeFilters.categoryId !== 'all' && item.categoryId !== activeFilters.categoryId) return false;
      if (activeFilters.status === 'active' && (!item.enabled || item.soldOut)) return false;
      if (activeFilters.status === 'disabled' && item.enabled) return false;
      if (activeFilters.status === 'soldOut' && !item.soldOut) return false;
      if (!query) return true;
      var haystack = [item.name, item.description, item.category, categoryById[item.categoryId] && categoryById[item.categoryId].name].join(' ').toLowerCase();
      return haystack.indexOf(query) !== -1;
    }).sort(compareItems);
  }

  function validateProductInput(input, state, currentId) {
    var errors = [];
    if (!input.name) errors.push('請輸入餐點名稱');
    if (!input.categoryId) errors.push('請選擇分類');
    if (input.price < 0 || isNaN(input.price)) errors.push('價格需為非負數');
    if (state.items.some(function(item) { return item.id !== currentId && item.name === input.name; })) {
      errors.push('餐點名稱不可重複');
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function getCheckedOptionSummaries() {
    var inputs = document.querySelectorAll('[data-option-bind]');
    var values = [];
    for (var i = 0; i < inputs.length; i++) {
      if (!inputs[i].checked) continue;
      var option = findById(fullMenuState.options, inputs[i].getAttribute('data-option-bind'));
      if (option) values.push(cloneOptionSummary(option));
    }
    return values;
  }

  function syncProductOptionDetails(option) {
    fullMenuState.items.forEach(function(item) {
      item.customizationOptions = (item.customizationOptions || []).map(function(itemOption) {
        return itemOption.id === option.id ? cloneOptionSummary(option) : itemOption;
      });
    });
  }

  function syncItemCategoryNames() {
    fullMenuState.items.forEach(function(item) {
      var category = findById(fullMenuState.categories, item.categoryId);
      item.category = category ? category.name : '';
    });
  }

  function markDirtyAndRender() {
    isDirty = true;
    fullMenuState = normalizeMenuState(fullMenuState);
    renderShell();
    scheduleAutoSave();
  }

  function scheduleAutoSave() {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    setMessage('success', '變更已套用，正在自動儲存...');
    autoSaveTimer = setTimeout(function() {
      autoSaveTimer = null;
      saveAll({ auto: true });
    }, 700);
  }

  function setLoading(loading) {
    var loadingEl = document.getElementById('menuLoading');
    var contentEl = document.getElementById('menuContent');
    if (loadingEl) loadingEl.className = loading ? 'space-y-3' : 'hidden space-y-3';
    if (contentEl) contentEl.className = loading ? 'hidden space-y-4' : 'space-y-4';
  }

  function setMessage(type, message) {
    var el = document.getElementById('menuMessage');
    if (!el) return;
    if (!message) {
      el.className = 'hidden rounded border px-4 py-3 text-sm';
      el.textContent = '';
      return;
    }
    var classes = type === 'error'
      ? 'rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700'
      : 'rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700';
    el.className = classes;
    el.textContent = message + (isDirty && !isAutoSaving ? '（等待自動儲存）' : '');
  }

  function initCategoryDrag() {
    initDragOnRows('categories', fullMenuState.categories);
  }

  function initProductDrag() {
    var products = filterProducts(fullMenuState.items, fullMenuState.categories, filters);
    initDragOnRows('products', products);
  }

  function initOptionDrag() {
    initDragOnRows('options', fullMenuState.options);
  }

  function initDragOnRows(kind, source) {
    var tbody = document.querySelector('#menuBody table tbody');
    if (!tbody) return;

    var rows = tbody.querySelectorAll('tr[data-drag-row]');
    var handleSelector = '.drag-handle';

    for (var i = 0; i < rows.length; i++) {
      (function(row, idx) {
        var handle = row.querySelector(handleSelector);
        if (!handle) return;

        handle.addEventListener('mousedown', function(e) {
          e.preventDefault();
          e.stopPropagation();
          startDragRows(kind, source, row, idx, e.clientY);
        });
      })(rows[i], i);
    }
  }

  function initDragOnCards(kind, source) {
    var container = document.getElementById('menuBody');
    if (!container) return;

    var cards = container.querySelectorAll('> .space-y-3 > [data-drag-kind="options"]');
    if (!cards.length) cards = container.querySelectorAll('[data-drag-kind="options"]');
    if (!cards.length) return;

    for (var i = 0; i < cards.length; i++) {
      (function(card, idx) {
        var handle = card.querySelector('.drag-handle');
        if (!handle) return;

        handle.addEventListener('mousedown', function(e) {
          e.preventDefault();
          e.stopPropagation();
          startDragCards(kind, source, card, idx, e.clientY);
        });
      })(cards[i], i);
    }
  }

  function startDragRows(kind, source, startRow, startIdx, startY) {
    var ghost = startRow.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.left = startRow.getBoundingClientRect().left + 'px';
    ghost.style.width = startRow.offsetWidth + 'px';
    ghost.style.opacity = '0.8';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.transform = 'translateY(-10px)';
    document.body.appendChild(ghost);
    startRow.style.opacity = '0.3';

    var targetIdx = startIdx;

    function onMove(e) {
      ghost.style.top = (e.clientY - 20) + 'px';

      var allRows = document.querySelectorAll('#menuBody table tbody tr[data-drag-row]');
      allRows.forEach(function(r) { r.classList.remove('border-t-2', 'border-blue-400', 'border-b-2'); });

      targetIdx = startIdx;
      for (var i = 0; i < allRows.length; i++) {
        if (i === startIdx) continue;
        var rect = allRows[i].getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          targetIdx = i;
          allRows[i].classList.add('border-t-2', 'border-blue-400');
          return;
        }
      }

      if (allRows.length > 0) {
        targetIdx = allRows.length - 1;
        allRows[allRows.length - 1].classList.add('border-b-2', 'border-blue-400');
      }
    }

    function onUp() {
      ghost.remove();
      startRow.style.opacity = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      var allRows = document.querySelectorAll('#menuBody table tbody tr[data-drag-row]');
      allRows.forEach(function(r) { r.classList.remove('border-t-2', 'border-blue-400', 'border-b-2'); });

      if (targetIdx !== startIdx) {
        var item = source.splice(startIdx, 1)[0];
        var adjustedTarget = targetIdx > startIdx ? targetIdx - 1 : targetIdx;
        source.splice(adjustedTarget, 0, item);
        reassignSortOrder(kind, source);
        markDirtyAndRender();
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startDragCards(kind, source, startCard, startIdx, startY) {
    var ghost = startCard.cloneNode(true);
    ghost.style.position = 'fixed';
    ghost.style.left = startCard.getBoundingClientRect().left + 'px';
    ghost.style.width = startCard.offsetWidth + 'px';
    ghost.style.opacity = '0.8';
    ghost.style.zIndex = '9999';
    ghost.style.pointerEvents = 'none';
    ghost.style.transform = 'translateY(-10px)';
    ghost.style.boxShadow = '0 20px 40px rgba(0,0,0,0.2)';
    document.body.appendChild(ghost);
    startCard.style.opacity = '0.3';

    var targetIdx = startIdx;

    function onMove(e) {
      ghost.style.top = (e.clientY - 20) + 'px';

      var container = document.getElementById('menuBody');
      if (!container) return;
      var cards = container.querySelectorAll('> .space-y-3 > [data-drag-kind="options"]');
      if (!cards.length) cards = container.querySelectorAll('[data-drag-kind="options"]');
      cards.forEach(function(c) { c.classList.remove('ring-2', 'ring-blue-400'); });

      targetIdx = startIdx;
      for (var i = 0; i < cards.length; i++) {
        if (cards[i] === startCard) continue;
        var rect = cards[i].getBoundingClientRect();
        var midY = rect.top + rect.height / 2;
        if (e.clientY < midY) {
          targetIdx = i;
          cards[i].classList.add('ring-2', 'ring-blue-400');
          return;
        }
      }

      if (cards.length > 0) {
        targetIdx = cards.length - 1;
        cards[cards.length - 1].classList.add('ring-2', 'ring-blue-400');
      }
    }

    function onUp() {
      ghost.remove();
      startCard.style.opacity = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);

      var container = document.getElementById('menuBody');
      if (container) {
        var cards = container.querySelectorAll('> .space-y-3 > [data-drag-kind="options"]');
        if (!cards.length) cards = container.querySelectorAll('[data-drag-kind="options"]');
        cards.forEach(function(c) { c.classList.remove('ring-2', 'ring-blue-400'); });
      }

      if (targetIdx !== startIdx) {
        var item = source.splice(startIdx, 1)[0];
        var adjustedTarget = targetIdx > startIdx ? targetIdx - 1 : targetIdx;
        source.splice(adjustedTarget, 0, item);
        reassignSortOrder(kind, source);
        markDirtyAndRender();
      }
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function reassignSortOrder(kind, source) {
    for (var i = 0; i < source.length; i++) {
      source[i].sortOrder = (i + 1) * 10;
    }
  }

  function renderCategoryOptions(selectedId, includeAll) {
    var html = includeAll ? optionHtml('all', '全部分類', selectedId) : '';
    fullMenuState.categories.forEach(function(category) {
      html += optionHtml(category.id, category.name, selectedId);
    });
    return html;
  }

  function optionHtml(value, label, selectedValue) {
    return '<option value="' + escapeAttribute(value) + '"' + (String(value) === String(selectedValue) ? ' selected' : '') + '>' + escapeHtml(label) + '</option>';
  }

  function upsert(list, value) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === value.id) {
        list[i] = value;
        return;
      }
    }
    list.push(value);
  }

  function findById(list, id) {
    return (list || []).find(function(item) { return item.id === id; });
  }

  function findCategoryIdByName(categories, name) {
    var matched = categories.find(function(category) { return category.name === name; });
    return matched ? matched.id : '';
  }

  function getValue(id) {
    var el = document.getElementById(id);
    return el ? el.value : '';
  }

  function isChecked(id) {
    var el = document.getElementById(id);
    return !!(el && el.checked);
  }

  function nextSort(list) {
    var max = 0;
    (list || []).forEach(function(item) {
      max = Math.max(max, parseNumber(item.sortOrder, 0));
    });
    return max + 10;
  }

  function parseBoolean(value, defaultValue) {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1' || value === '是') return true;
    if (value === false || value === 'FALSE' || value === 'false' || value === 0 || value === '0' || value === '否') return false;
    return defaultValue;
  }

  function parseNumber(value, defaultValue) {
    var parsed = Number(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  function compareBySortThenName(a, b) {
    var aSort = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
    var bSort = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
    if (aSort !== bSort) return aSort - bSort;
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
  }

  function compareItems(a, b) {
    if (a.categoryId !== b.categoryId) return String(a.category || '').localeCompare(String(b.category || ''), 'zh-Hant');
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
  }

  function makeId(prefix, value, index) {
    var base = String(value || 'item').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\u4e00-\u9fff-]/g, '').replace(/-+/g, '-');
    if (!base) base = 'item';
    return prefix + '-' + base + '-' + (index + 1);
  }

  function unique(values) {
    var seen = {};
    return values.filter(function(value) {
      if (seen[value]) return false;
      seen[value] = true;
      return true;
    });
  }

  function uniqueStrings(values) {
    var seen = {};
    var result = [];
    (values || []).forEach(function(value) {
      var normalized = String(value || '').trim();
      if (!normalized || seen[normalized]) return;
      seen[normalized] = true;
      result.push(normalized);
    });
    return result;
  }

  function trim(value) {
    return String(value || '').trim();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeAttribute(value) {
    return escapeHtml(value);
  }

  return {
    load: load,
    switchTab: switchTab,
    setSearch: setSearch,
    setCategoryFilter: setCategoryFilter,
    setStatusFilter: setStatusFilter,
    toggleSelected: toggleSelected,
    toggleAll: toggleAll,
    batchSetEnabled: batchSetEnabled,
    batchDelete: batchDelete,
    openCategoryForm: openCategoryForm,
    openProductForm: openProductForm,
    openOptionForm: openOptionForm,
    deleteCategory: deleteCategory,
    deleteProduct: deleteProduct,
    deleteOption: deleteOption,
    closeDialog: closeDialog,
    saveAll: saveAll,
    openUploadDialog: openUploadDialog,
    downloadSettings: downloadSettings,
    _test: {
      normalizeMenuState: normalizeMenuState,
      filterProducts: filterProducts,
      validateProductInput: validateProductInput,
      previewImportRows: previewImportRows,
      applyImportPreview: applyImportPreview,
      buildTemplateSheets: buildTemplateSheets
    }
  };
})();
