/**
 * sheet-menu.js
 * 菜單資料讀取模組
 * 職責：從 Google Sheets 讀取菜單資料（分類、品項、價格、客製化選項）
 */

/**
 * 新版資料表：
 * - Categories: categoryId, name, sortOrder, enabled
 * - Products: productId, categoryId, name, description, price, soldOut, sortOrder, enabled
 * - OptionGroups: groupId, name, type, required, sortOrder, enabled
 * - OptionItems: optionItemId, groupId, name, sortOrder, enabled
 * - ProductOptions: productId, groupId, sortOrder, enabled
 *
 * 若新版資料表不存在，會回退讀取舊版單一「菜單」工作表。
 */

/**
 * 讀取所有啟用中的餐點資料
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} sheetName - 工作表名稱（預設為 "菜單"）
 * @returns {Array<Object>} 餐點資料陣列
 */
function readMenuItems(spreadsheetId, sheetName) {
  sheetName = sheetName || '菜單';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    if (hasNormalizedMenuSheets(ss)) {
      return readNormalizedMenuItems(ss);
    }

    var sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error('找不到工作表: ' + sheetName);
    }
    
    var data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return [];
    }
    
    var headers = data[0];
    var menuItems = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var item = {
        category: row[0],
        name: row[1],
        price: row[2],
        description: row[3],
        customizationOptions: parseCustomizationOptions(row[4]),
        inStock: row[5] === true || row[5] === 'TRUE',
        enabled: row[6] === true || row[6] === 'TRUE'
      };
      
      if (item.enabled) {
        menuItems.push(item);
      }
    }
    
    return menuItems;
    
  } catch (e) {
    Logger.log('readMenuItems 錯誤: ' + e.toString());
    throw new Error('讀取菜單資料失敗: ' + e.toString());
  }
}

/**
 * 取得所有不重複的分類列表
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} sheetName - 工作表名稱
 * @returns {Array<string>} 分類列表
 */
function getCategories(spreadsheetId, sheetName) {
  sheetName = sheetName || '菜單';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    if (hasNormalizedMenuSheets(ss)) {
      return readNormalizedCategories(ss).map(function(category) {
        return category.name;
      });
    }

    var menuItems = readMenuItems(spreadsheetId, sheetName);
    var categories = [];
    var seen = {};
    
    for (var i = 0; i < menuItems.length; i++) {
      var cat = menuItems[i].category;
      if (cat && !seen[cat]) {
        seen[cat] = true;
        categories.push(cat);
      }
    }
    
    return categories;
    
  } catch (e) {
    Logger.log('getCategories 錯誤: ' + e.toString());
    throw new Error('讀取分類失敗: ' + e.toString());
  }
}

/**
 * 依分類篩選餐點
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} category - 分類名稱
 * @param {string} sheetName - 工作表名稱
 * @returns {Array<Object>} 過濾後的餐點資料
 */
function getMenuItemsByCategory(spreadsheetId, category, sheetName) {
  sheetName = sheetName || '菜單';
  
  try {
    var menuItems = readMenuItems(spreadsheetId, sheetName);
    var filtered = [];
    
    for (var i = 0; i < menuItems.length; i++) {
      if (menuItems[i].category === category) {
        filtered.push(menuItems[i]);
      }
    }
    
    return filtered;
    
  } catch (e) {
    Logger.log('getMenuItemsByCategory 錯誤: ' + e.toString());
    throw new Error('依分類篩選餐點失敗: ' + e.toString());
  }
}

/**
 * 解析客製化選項欄位
 * 支援 JSON 格式或簡單字串格式
 * @param {string|Object} rawData - 原始資料
 * @returns {Array<Object>} 解析後的客製化選項
 */
function parseCustomizationOptions(rawData) {
  if (!rawData || rawData === '') {
    return [];
  }
  
  if (typeof rawData === 'object') {
    return normalizeCustomizationOptions(Array.isArray(rawData) ? rawData : [rawData]);
  }
  
  try {
    var parsed = JSON.parse(rawData);
    return normalizeCustomizationOptions(Array.isArray(parsed) ? parsed : [parsed]);
  } catch (e) {
    Logger.log('parseCustomizationOptions 解析失敗: ' + rawData);
    return [];
  }
}

function normalizeCustomizationOptions(options) {
  return (options || []).map(function(option) {
    if (!option) return null;
    var normalized = {};
    for (var key in option) {
      if (Object.prototype.hasOwnProperty.call(option, key)) {
        normalized[key] = option[key];
      }
    }
    normalized.choices = uniqueStrings(option.choices || []);
    return normalized;
  }).filter(function(option) {
    return option && String(option.name || '').trim();
  });
}

/**
 * 取得完整菜單資料（含分類結構）
 * @param {string} spreadsheetId - Google Sheet 的 ID
 * @param {string} sheetName - 工作表名稱
 * @returns {Object} { categories: [...], items: [...] }
 */
function getFullMenu(spreadsheetId, sheetName) {
  sheetName = sheetName || '菜單';
  
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    var items;
    var categories;

    if (hasNormalizedMenuSheets(ss)) {
      items = readNormalizedMenuItems(ss);
      categories = readNormalizedCategories(ss).map(function(category) {
        return category.name;
      });
    } else {
      items = readMenuItems(spreadsheetId, sheetName);
      categories = getCategories(spreadsheetId, sheetName);
    }
    
    return {
      categories: categories,
      items: items
    };
    
  } catch (e) {
    Logger.log('getFullMenu 錯誤: ' + e.toString());
    throw new Error('取得完整菜單失敗: ' + e.toString());
  }
}

function hasNormalizedMenuSheets(ss) {
  return !!(
    ss.getSheetByName('Categories') &&
    ss.getSheetByName('Products') &&
    ss.getSheetByName('OptionGroups') &&
    ss.getSheetByName('OptionItems') &&
    ss.getSheetByName('ProductOptions')
  );
}

function readNormalizedCategories(ss) {
  var rows = readSheetRows(ss, 'Categories');
  var categories = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!isTruthy(row[3])) continue;

    categories.push({
      id: String(row[0]),
      name: String(row[1] || ''),
      sortOrder: parseNumber(row[2], 0)
    });
  }

  categories.sort(compareBySortThenName);
  return categories;
}

function readNormalizedMenuItems(ss) {
  var categoryMap = {};
  var categories = readNormalizedCategories(ss);
  for (var i = 0; i < categories.length; i++) {
    categoryMap[categories[i].id] = categories[i];
  }

  var optionGroups = readOptionGroups(ss);
  var optionItemsByGroup = readOptionItemsByGroup(ss);
  var productOptionsByProduct = readProductOptionsByProduct(ss);
  var rows = readSheetRows(ss, 'Products');
  var items = [];

  for (var j = 0; j < rows.length; j++) {
    var row = rows[j];
    var productId = String(row[0]);
    var category = categoryMap[String(row[1])];
    var soldOut = isTruthy(row[5]);
    var enabled = isTruthy(row[7]);

    if (!category || !enabled || soldOut) continue;

    items.push({
      id: productId,
      category: category.name,
      categoryId: category.id,
      name: String(row[2] || ''),
      description: String(row[3] || ''),
      price: parseNumber(row[4], 0),
      sortOrder: parseNumber(row[6], 0),
      soldOut: false,
      inStock: true,
      imageUrl: String(row[8] || ''),
      customizationOptions: buildCustomizationOptions(
        productOptionsByProduct[productId] || [],
        optionGroups,
        optionItemsByGroup
      )
    });
  }

  items.sort(function(a, b) {
    if (a.categoryId !== b.categoryId) {
      return compareBySortThenName(categoryMap[a.categoryId], categoryMap[b.categoryId]);
    }
    if (a.sortOrder !== b.sortOrder) {
      return a.sortOrder - b.sortOrder;
    }
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
  });

  return items;
}

function readOptionGroups(ss) {
  var rows = readSheetRows(ss, 'OptionGroups');
  var groups = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!isTruthy(row[5])) continue;

    groups[String(row[0])] = {
      id: String(row[0]),
      name: String(row[1] || ''),
      type: String(row[2] || 'single'),
      required: isTruthy(row[3]),
      sortOrder: parseNumber(row[4], 0)
    };
  }

  return groups;
}

function readOptionItemsByGroup(ss) {
  var rows = readSheetRows(ss, 'OptionItems');
  var byGroup = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!isTruthy(row[4])) continue;

    var groupId = String(row[1]);
    var itemName = String(row[2] || '').trim();
    if (!itemName) continue;

    if (!byGroup[groupId]) byGroup[groupId] = [];
    byGroup[groupId].push({
      name: itemName,
      sortOrder: parseNumber(row[3], 0)
    });
  }

  for (var key in byGroup) {
    byGroup[key].sort(compareBySortThenName);
    byGroup[key] = dedupeOptionItems(byGroup[key]);
  }

  return byGroup;
}

function readProductOptionsByProduct(ss) {
  var rows = readSheetRows(ss, 'ProductOptions');
  var byProduct = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    if (!isTruthy(row[3])) continue;

    var productId = String(row[0]);
    if (!byProduct[productId]) byProduct[productId] = [];
    byProduct[productId].push({
      groupId: String(row[1]),
      sortOrder: parseNumber(row[2], 0)
    });
  }

  for (var key in byProduct) {
    byProduct[key].sort(compareBySortThenName);
  }

  return byProduct;
}

function buildCustomizationOptions(productOptions, optionGroups, optionItemsByGroup) {
  var options = [];

  for (var i = 0; i < productOptions.length; i++) {
    var group = optionGroups[productOptions[i].groupId];
    if (!group) continue;

    var optionItems = optionItemsByGroup[group.id] || [];
    options.push({
      name: group.name,
      type: group.type,
      required: group.required,
      choices: uniqueStrings(optionItems.map(function(item) {
        return item.name;
      }))
    });
  }

  return options;
}

function readSheetRows(ss, sheetName) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];

  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];

  return values.slice(1);
}

function isTruthy(value) {
  return value === true || value === 'TRUE' || value === 'true' || value === 1 || value === '1';
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

function uniqueStrings(values) {
  var seen = {};
  var output = [];
  for (var i = 0; i < (values || []).length; i++) {
    var value = String(values[i] || '').trim();
    if (!value || seen[value]) continue;
    seen[value] = true;
    output.push(value);
  }
  return output;
}

function dedupeOptionItems(items) {
  var seen = {};
  var output = [];
  for (var i = 0; i < (items || []).length; i++) {
    var name = String(items[i].name || '').trim();
    if (!name || seen[name]) continue;
    seen[name] = true;
    output.push({
      name: name,
      sortOrder: items[i].sortOrder
    });
  }
  return output;
}

function getFullMenuState(spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  if (hasNormalizedMenuSheets(ss)) {
    return getNormalizedMenuState(ss);
  }

  var sheet = ss.getSheetByName('菜單');
  
  if (!sheet) {
    return { categories: [], options: [], items: [] };
  }
  
  var data = sheet.getDataRange().getValues();
  var items = [];
  var categoriesSet = {};
  var categories = [];
  var globalOptionsMap = {};
  
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var category = row[0];
    var name = row[1];
    var price = row[2];
    var desc = row[3];
    var opts = parseCustomizationOptions(row[4]);
    var inStock = row[5] === true || row[5] === 'TRUE';
    var enabled = row[6] === true || row[6] === 'TRUE';
    var imageUrl = row[7] || '';
    
    // 如果品名為空，可能是用來佔位儲存獨立的分類或選項
    if (name) {
      items.push({
        id: 'item_' + i,
        category: category,
        name: name,
        price: price,
        description: desc,
        customizationOptions: opts,
        inStock: inStock,
        enabled: enabled,
        imageUrl: imageUrl
      });
    }
    
    if (category && !categoriesSet[category]) {
      categoriesSet[category] = true;
      categories.push({ id: 'cat_' + i, name: category });
    }
    
    // 收集獨立的 Global Options (若有人只寫在品名為空的行，或從商品中抽取)
    opts.forEach(function(opt) {
      var key = opt.name;
      if (!globalOptionsMap[key]) {
        globalOptionsMap[key] = {
          id: 'opt_' + i + '_' + key,
          name: opt.name,
          type: opt.type || 'single',
          required: opt.required || false,
          choices: uniqueStrings(opt.choices || [])
        };
      } else {
        // 合併選項
        uniqueStrings(opt.choices || []).forEach(function(c) {
          if (globalOptionsMap[key].choices.indexOf(c) === -1) {
            globalOptionsMap[key].choices.push(c);
          }
        });
      }
    });
  }
  
  var options = [];
  for (var k in globalOptionsMap) {
    options.push(globalOptionsMap[k]);
  }
  
  return {
    categories: categories,
    options: options,
    items: items
  };
}

function updateFullMenuState(spreadsheetId, menuState) {
  try {
    var ss = SpreadsheetApp.openById(spreadsheetId);
    if (hasNormalizedMenuSheets(ss) || ss.getSheetByName('Categories') || ss.getSheetByName('Products')) {
      return updateNormalizedMenuState(ss, menuState);
    }

    var sheet = ss.getSheetByName('菜單');
    if (!sheet) {
      sheet = ss.insertSheet('菜單');
    }
    
    sheet.clear();
    var rows = [['分類', '品名', '價格', '描述', '客製化選項', '庫存狀態', '啟用狀態', '圖片網址']];
    
    var items = menuState.items || [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var optsStr = Array.isArray(item.customizationOptions) ? JSON.stringify(item.customizationOptions) : '[]';
      rows.push([
        item.category || '',
        item.name || '',
        item.price || 0,
        item.description || '',
        optsStr,
        item.hasOwnProperty('inStock') ? item.inStock : true,
        item.hasOwnProperty('enabled') ? item.enabled : true,
        item.imageUrl || ''
      ]);
    }
    appendSheetRows(sheet, rows);
    
    // 清除快取
    CacheService.getScriptCache().remove('fullMenu');
    
    return { success: true, message: '菜單已全面更新' };
  } catch (e) {
    Logger.log('updateFullMenuState 錯誤: ' + e.toString());
    return { success: false, message: '菜單更新失敗: ' + e.toString() };
  }
}

function getNormalizedMenuState(ss) {
  var categoryRows = readSheetRows(ss, 'Categories');
  var categories = [];
  var categoryMap = {};

  for (var i = 0; i < categoryRows.length; i++) {
    var categoryRow = categoryRows[i];
    var category = {
      id: String(categoryRow[0] || ''),
      name: String(categoryRow[1] || ''),
      sortOrder: parseNumber(categoryRow[2], (i + 1) * 10),
      enabled: categoryRow[3] === undefined ? true : isTruthy(categoryRow[3])
    };
    if (!category.id && category.name) category.id = makeMenuId('cat', category.name, i);
    if (!category.name) continue;
    categories.push(category);
    categoryMap[category.id] = category;
  }
  categories.sort(compareBySortThenName);

  var optionGroups = readAllOptionGroups(ss);
  var optionItemsByGroup = readOptionItemsByGroup(ss);
  var options = [];
  for (var groupId in optionGroups) {
    var group = optionGroups[groupId];
    var groupItems = optionItemsByGroup[groupId] || [];
    options.push({
      id: group.id,
      name: group.name,
      type: group.type,
      required: group.required,
      sortOrder: group.sortOrder,
      enabled: group.enabled,
      choices: uniqueStrings(groupItems.map(function(item) { return item.name; }))
    });
  }
  options.sort(compareBySortThenName);

  var productOptionsByProduct = readProductOptionsByProduct(ss);
  var productRows = readSheetRows(ss, 'Products');
  var items = [];

  for (var j = 0; j < productRows.length; j++) {
    var productRow = productRows[j];
    var productId = String(productRow[0] || '');
    var categoryId = String(productRow[1] || '');
    var productOptionLinks = productOptionsByProduct[productId] || [];

    if (!productId && productRow[2]) productId = makeMenuId('item', productRow[2], j);

    items.push({
      id: productId,
      category: categoryMap[categoryId] ? categoryMap[categoryId].name : '',
      categoryId: categoryId,
      name: String(productRow[2] || ''),
      description: String(productRow[3] || ''),
      price: parseNumber(productRow[4], 0),
      soldOut: isTruthy(productRow[5]),
      inStock: !isTruthy(productRow[5]),
      sortOrder: parseNumber(productRow[6], (j + 1) * 10),
      enabled: productRow[7] === undefined ? true : isTruthy(productRow[7]),
      imageUrl: String(productRow[8] || ''),
      customizationOptions: buildCustomizationOptions(productOptionLinks, optionGroups, optionItemsByGroup)
    });
  }
  items.sort(function(a, b) {
    if (a.categoryId !== b.categoryId && categoryMap[a.categoryId] && categoryMap[b.categoryId]) {
      return compareBySortThenName(categoryMap[a.categoryId], categoryMap[b.categoryId]);
    }
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
  });

  return {
    categories: categories,
    options: options,
    items: items
  };
}

function readAllOptionGroups(ss) {
  var rows = readSheetRows(ss, 'OptionGroups');
  var groups = {};

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var groupId = String(row[0] || '');
    if (!groupId && row[1]) groupId = makeMenuId('opt', row[1], i);

    groups[groupId] = {
      id: groupId,
      name: String(row[1] || ''),
      type: String(row[2] || 'single'),
      required: isTruthy(row[3]),
      sortOrder: parseNumber(row[4], (i + 1) * 10),
      enabled: row[5] === undefined ? true : isTruthy(row[5])
    };
  }

  return groups;
}

function updateNormalizedMenuState(ss, menuState) {
  var categories = menuState.categories || [];
  var options = menuState.options || [];
  var items = menuState.items || [];
  var categoryIdByName = {};
  var optionIdByName = {};

  var categoryRows = [['categoryId', 'name', 'sortOrder', 'enabled']];
  for (var i = 0; i < categories.length; i++) {
    var category = categories[i];
    var categoryId = category.id || makeMenuId('cat', category.name, i);
    categoryIdByName[category.name] = categoryId;
    categoryRows.push([
      categoryId,
      category.name || '',
      category.sortOrder !== undefined ? category.sortOrder : (i + 1) * 10,
      category.enabled !== false
    ]);
  }

  var optionGroupRows = [['groupId', 'name', 'type', 'required', 'sortOrder', 'enabled']];
  var optionItemRows = [['optionItemId', 'groupId', 'name', 'sortOrder', 'enabled']];
  for (var j = 0; j < options.length; j++) {
    var option = options[j];
    var optionId = option.id || makeMenuId('opt', option.name, j);
    optionIdByName[option.name] = optionId;
    optionGroupRows.push([
      optionId,
      option.name || '',
      option.type || 'single',
      option.required === true,
      option.sortOrder !== undefined ? option.sortOrder : (j + 1) * 10,
      option.enabled !== false
    ]);

    var choices = uniqueStrings(option.choices || []);
    for (var k = 0; k < choices.length; k++) {
      optionItemRows.push([
        makeMenuId('choice', optionId + '-' + choices[k], k),
        optionId,
        choices[k],
        (k + 1) * 10,
        true
      ]);
    }
  }

  var productRows = [['productId', 'categoryId', 'name', 'description', 'price', 'soldOut', 'sortOrder', 'enabled', 'imageUrl']];
  var productOptionRows = [['productId', 'groupId', 'sortOrder', 'enabled']];
  for (var p = 0; p < items.length; p++) {
    var item = items[p];
    var productId = item.id || makeMenuId('item', item.name, p);
    var categoryId = item.categoryId || categoryIdByName[item.category] || '';
    var soldOut = item.soldOut === true || item.inStock === false;

    productRows.push([
      productId,
      categoryId,
      item.name || '',
      item.description || '',
      parseNumber(item.price, 0),
      soldOut,
      item.sortOrder !== undefined ? item.sortOrder : (p + 1) * 10,
      item.enabled !== false,
      item.imageUrl || ''
    ]);

    var itemOptions = item.customizationOptions || [];
    for (var q = 0; q < itemOptions.length; q++) {
      var itemOption = itemOptions[q];
      var groupId = itemOption.id || optionIdByName[itemOption.name];
      if (!groupId) continue;
      productOptionRows.push([
        productId,
        groupId,
        (q + 1) * 10,
        true
      ]);
    }
  }

  replaceSheetValues(ss, 'Categories', categoryRows);
  replaceSheetValues(ss, 'Products', productRows);
  replaceSheetValues(ss, 'OptionGroups', optionGroupRows);
  replaceSheetValues(ss, 'OptionItems', optionItemRows);
  replaceSheetValues(ss, 'ProductOptions', productOptionRows);
  clearMenuCache();

  return { success: true, message: '菜單已全面更新' };
}

function replaceSheetValues(ss, sheetName, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) sheet = ss.insertSheet(sheetName);
  sheet.clear();
  appendSheetRows(sheet, rows);
}

function appendSheetRows(sheet, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  var startRow = sheet.getLastRow() + 1;
  sheet.getRange(startRow, 1, rows.length, rows[0].length).setValues(rows);
}

function makeMenuId(prefix, value, index) {
  var base = String(value || 'item')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-');
  if (!base) base = 'item';
  return prefix + '-' + base + '-' + (index + 1);
}
