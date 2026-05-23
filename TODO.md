# 星空x藝素村線上點餐系統 - 開發待辦清單

## Phase 1: 後台管理修改

### 1. 移除批量修改（bindings）分頁
- **檔案**: `src/admin/admin-menu.js`
- **內容**:
  - 從 TABS 陣列移除 `{ id: 'bindings', label: '批量修改' }`
  - 移除 `renderBindings()` 函式
  - 移除 `renderTab()` 中呼叫 `renderBindings()` 的條件
  - 移除 `openBatchProductSettings()` 函式
  - 移除 `applyBatchProductSettings()` 函式
  - 移除 `getCheckedBatchOptionIds()` 函式
  - 移除 `renderToolbar()` 中 bindings 相關的 toolbars
  - 移除 `admin/index.html` 側邊導航的「操作紀錄」連結（如果需要）

### 2. 分類管理/附加屬性群組改為表格格式，勾選框在來源前
- **檔案**: `src/admin/admin-menu.js`
- **內容**:
  - `renderCategories()`: 改為表格格式，勾選框在「來源」欄位前
  - `renderOptions()`: 改為表格格式，勾選框在「來源」欄位前
  - 確保全選勾選框功能正常

---

## Phase 2: 客戶端登入流程重構

### 3. 登入頁面重構為訂位資訊表單（日曆格子顯示營業日期）
- **檔案**: `src/frontend/index.html`, `src/frontend/reservation.js`
- **內容**:
  - 重構登入畫面為訂位資訊表單
  - 欄位：訂位人姓名、電話、人數、日期、時間
  - 新增日曆格子視覺化顯示營業日期（有營業可點擊、無營業灰顯）
  - 日曆需根據 `getBusinessHours()` API 資料動態渲染

### 4. 新增現場點餐/線上點餐選擇
- **檔案**: `src/frontend/reservation.js`, `src/frontend/index.html`
- **內容**:
  - 完成訂位資訊後顯示兩個按鈕：「現場點餐」「線上點餐」
  - 現場點餐 → 跳出訂位成功畫面
  - 線上點餐 → 跳轉到點餐系統

### 5. 線上點餐跳轉時帶入全部預約資料
- **檔案**: `src/frontend/index.html`, `src/frontend/reservation.js`
- **內容**:
  - 線上點餐跳轉時，將姓名、電話、人數、日期、時間全部帶入
  - 點餐系統中預填這些資料，結帳時直接使用

---

## Phase 3: 分享功能

### 6. 新增分享按鈕（Web Share API / 複製連結）
- **檔案**: `src/frontend/index.html`, 新增 `src/frontend/share.js`
- **內容**:
  - 在點餐畫面新增分享按鈕
  - 使用 Web Share API（支援時）或 fallback 到複製連結
  - 連結格式：`?reserver=姓名&phone=電話&guestCount=人數&diningDate=日期&diningTime=時間`

### 7. 分享連結解析：鎖定訂位代表人，新使用者填自己的資料
- **檔案**: `src/frontend/index.html`, `src/frontend/liff-auth.js`, `src/frontend/reservation.js`
- **內容**:
  - 偵測 URL 中的 `reserver` 參數
  - 如果有 reserver → 鎖定顯示訂位代表人（不可更改）
  - 新使用者仍需填寫自己的姓名、電話、人數、日期、時間
  - 如果沒有 reserver → 正常登入流程

---

## Phase 4: 個人訂單查看

### 8. LINE 登入後可查看個人歷史訂單
- **檔案**: `src/frontend/index.html`, `src/frontend/api.js`, `src/gas/api-router.js`, `src/gas/sheet-order.js`
- **內容**:
  - 新增 API：`getOrdersByUserId`（根據 LIFF userId 查詢訂單）
  - GAS 後端新增對應 handler
  - 前端新增「我的訂單」頁面/彈窗
  - 顯示訂單編號、日期、狀態、明細

---

## Phase 5: 餐點備註功能

### 9. 餐點增加備註欄位（購物車/結帳時可填寫）
- **檔案**: `src/frontend/index.html`, `src/frontend/menu.js`, `src/frontend/order-submit.js`
- **內容**:
  - 購物車中每個項目新增備註輸入框
  - 結帳時將備註帶入訂單資料
  - GAS 後端儲存備註到訂單記錄

---

## 檔案影響總覽

```
修改:
  src/admin/admin-menu.js        (移除 bindings tab + options 表格化)
  src/frontend/index.html         (登入畫面重構 + 分享按鈕 + 我的訂單)
  src/frontend/reservation.js     (日曆選擇 + 點餐模式選擇 + 分享連結解析)
  src/frontend/liff-auth.js       (分享連結時鎖定 reserver)
  src/frontend/api.js             (新增 getOrdersByUserId API)
  src/gas/api-router.js           (新增 getOrdersByUserId handler)
  src/gas/sheet-order.js          (新增查詢個人訂單邏輯)

新增:
  src/frontend/share.js           (分享功能模組)
```

---

## 執行順序

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
```

每個 Phase 完成後暫停確認，再繼續下一個。
