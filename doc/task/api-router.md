# API 路由模塊任務

## 目標

在 Google Apps Script Web App 中根據請求類型分派到對應處理流程。

## 子任務

- [x] 建立 `doGet` 入口
- [x] 建立 `doPost` 入口
- [x] 定義 action 或 path 分派規則
- [x] 將 `menu` 請求導向菜單查詢 API
- [x] 將 `announcements` 請求導向公告查詢 API
- [x] 將 `schedule` 請求導向營業排程查詢 API
- [x] 將 `order` 請求導向訂單處理流程
- [x] 統一輸出 JSON response

## 驗收

- [x] 各 API 請求可被正確分派
- [x] 未知請求會回傳明確錯誤
