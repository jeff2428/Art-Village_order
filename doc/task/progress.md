# 任務總體進度

## P0 立即修復

- [x] Admin Token fail-closed：未設定 `ADMIN_TOKEN` 時拒絕後台請求
- [x] HTML escape 防 XSS：前台/後台主要動態 HTML 輸出加入 escape helper
- [x] 訂單驗證器邏輯錯誤：支援一週七天、多段營業時間並驗證日期、時間、餐點
- [x] Google Sheets 批次寫入：訂單主檔與明細改用 `setValues` 批次寫入

## P1 安全與核心功能

- [x] 輸入驗證與 sanitization：訂單與員工資料進入後端前做基本格式、長度與 trim 處理
- [x] PIN 碼 hash + 失敗鎖定：新員工 PIN 改存 salted hash，舊明文 PIN 登入後自動遷移，失敗達門檻會鎖定
- [x] 機密資訊移至 config：前台與後台 API 設定拆到 `config.js` / `admin-config.js`
- [x] 防重複送出：送單中再次點擊會被拒絕
- [x] 購物車持久化：購物車保存到 `localStorage`
- [x] 統一錯誤處理格式：前台與後台 API client 集中處理 JSON success/error
- [x] 抽離共用工具模組：前台與後台 HTML escape helper 拆成共用工具檔

## P2 後台體驗改善

- [x] 訂單搜尋：支援訂單編號、姓名、電話、用餐資訊與餐點名稱搜尋
- [x] 訂單分頁：支援每頁 5 / 10 / 20 筆與頁碼切換
- [x] active 高亮：側邊導航與訂單狀態篩選顯示目前選取狀態
- [x] loading 狀態：訂單讀取時顯示 skeleton loading
- [x] inline error：訂單載入與狀態更新錯誤顯示在頁面內
- [x] modal 確認：訂單狀態變更改為頁內 modal 確認
- [x] modal 表單：折扣與員工新增/編輯改為頁內 modal，表單驗證錯誤 inline 顯示
- [x] 公告與庫存體驗：公告/庫存載入狀態、空狀態、成功/錯誤訊息改為頁面內顯示
- [x] 營業排程體驗：營業時間/休假載入狀態、inline 訊息、休假刪除 modal、時段驗證

## 顧客端前端模塊

- [x] LIFF 登入模塊：`doc/task/liff-login.md`
- [x] 首頁公告模塊：`doc/task/home-announcement.md`
- [x] 彈窗公告模塊：`doc/task/popup-announcement.md`
- [x] 菜單分類模塊：`doc/task/menu-category.md`
- [x] 餐點列表模塊：`doc/task/product-list.md`
- [x] 客製化選項模塊：`doc/task/customization-options.md`
- [x] 購物籃模塊：`doc/task/cart.md`
- [x] 預約資訊模塊：`doc/task/reservation.md`
- [x] 結帳前提醒模塊：`doc/task/checkout-reminder.md`
- [x] 訂單送出模塊：`doc/task/order-submit.md`
- [x] 完成畫面模塊：`doc/task/completion-screen.md`

## 後端 API 模塊

- [x] API 路由模塊：`doc/task/api-router.md`
- [x] 菜單查詢 API 模塊：`doc/task/menu-query-api.md`
- [x] 公告查詢 API 模塊：`doc/task/announcement-query-api.md`
- [x] 營業排程查詢 API 模塊：`doc/task/schedule-query-api.md`
- [x] 訂單驗證模塊：`doc/task/order-validation.md`
- [x] 訂單處理模塊：`doc/task/order-processing.md`
- [x] 訂單寫入模塊：`doc/task/order-writing.md`
- [x] LINE 推播模塊：`doc/task/line-push.md`
- [x] 錯誤回應模塊：`doc/task/error-response.md`

## 管理後台模塊

- [x] 後台入口模塊：`doc/task/admin-entry.md`
- [x] 菜單分類管理模塊：`doc/task/admin-category.md`
- [x] 餐點管理模塊：`doc/task/admin-product.md`
- [x] 客製化選項管理模塊：`doc/task/admin-customization.md`
- [x] 庫存/完售管理模塊：`doc/task/admin-inventory.md`
- [x] 營業時間管理模塊：`doc/task/admin-business-hours.md`
- [x] 特殊休假管理模塊：`doc/task/admin-holidays.md`
- [x] 公告管理模塊：`doc/task/admin-announcements.md`
- [x] 訂單查看模塊：`doc/task/admin-orders.md`

## 資料儲存與 LINE 整合模塊

- [x] Google Sheets 資料結構：`doc/task/sheets-schema.md`
- [x] LIFF 身分整合：`doc/task/liff-identity.md`
- [x] Messaging API 整合：`doc/task/messaging-api.md`
