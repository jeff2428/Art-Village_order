# 優化待辦清單

最後更新：2026-05-18

## P0 - 立即修復（高風險/核心錯誤）

- [x] 【P0-安全性】修正 Admin Token fallback 為 fail-closed (admin-api.js validateAdminToken)
- [ ] 【P0-安全性】加入 HTML escape 工具函式，替換所有 innerHTML 為 textContent
- [x] 【P0-程式碼】修正訂單驗證器 checkOrderTimeLimit 邏輯錯誤
- [x] 【P0-效能】Google Sheets 批次寫入（setValues 取代 appendRow 迴圈）

## P1 - 安全與核心功能

- [ ] 【P1-安全性】加入輸入驗證與 sanitization（後端 admin-api.js、employee-auth.js）
- [ ] 【P1-安全性】PIN 碼 hash 儲存 + 失敗鎖定機制
- [ ] 【P1-安全性】機密資訊移至 config 檔（API URL、Admin Token、LIFF ID）
- [ ] 【P1-功能】防重複送出機制（前端鎖定 + 後端去重）
- [ ] 【P1-功能】購物車 localStorage 持久化 + 頁面恢復
- [ ] 【P1-程式碼】統一錯誤處理格式（{success: false, message}）
- [ ] 【P1-程式碼】抽離重複程式碼為共用工具模組（isTruthy、escapeHTML 等）

## P2 - 功能增強與體驗優化

- [ ] 【P2-功能】訂單搜尋功能（姓名/電話/訂單編號）
- [ ] 【P2-功能】訂單分頁機制（後端 50 筆/頁 + 前端分頁 UI）
- [ ] 【P2-UI/UX】側邊欄加入 active 狀態高亮
- [ ] 【P2-UI/UX】所有 API 呼叫加入 loading 狀態/spinner
- [ ] 【P2-UI/UX】錯誤處理改為 inline error banner + retry 按鈕
- [ ] 【P2-UI/UX】後台 modal 表單取代 prompt() 對話框
- [ ] 【P2-UI/UX】購物車單品數量上限（20 份）前後端雙重驗證
- [ ] 【P2-效能】API 超時設定（AbortController 30 秒）+ retry 機制
- [ ] 【P2-效能】快取管理完整化（所有設定資料快取失效機制） ✅ 已完成
- [ ] 【P2-程式碼】折扣重疊邏輯明確化（加入 stackable 旗標）
- [ ] 【P2-程式碼】appState 封裝為模組（getter/setter + Object.freeze）
- [ ] 【P2-程式碼】函式命名修正（decreaseCartItem 語意混淆）
- [ ] 【P2-程式碼】星期幾常數化（取代魔法數字）
- [ ] 【P2-安全性】加入 CSRF token 驗證

## P3 - 進階優化與文件

- [ ] 【P3-功能】顧客「我的訂單」頁面（依 LIFF userId 查詢）
- [ ] 【P3-UI/UX】圖片 lazy loading + srcset + 固定尺寸
- [ ] 【P3-UI/UX】圖片載入失敗 fallback 處理
- [ ] 【P3-UI/UX】未儲存變更警告（beforeunload）
- [ ] 【P3-UI/UX】深色模式支援（prefers-color-scheme）
- [ ] 【P3-UI/UX】無障礙支援（ARIA 標籤、鍵盤導航、焦點管理）
- [ ] 【P3-程式碼】加入 JSDoc 型別註解
- [ ] 【P3-測試】新增折扣計算器完整測試
- [ ] 【P3-測試】新增 admin-menu 模組測試
- [ ] 【P3-測試】新增 admin-employee 模組測試
- [ ] 【P3-測試】新增 admin-discount 模組測試
- [ ] 【P3-測試】新增 admin-schedule 模組測試
- [ ] 【P3-文件】撰寫 README.md（專案概述、架構圖、安裝部署指南）
- [ ] 【P3-文件】建立統一 API 參考文件（端點、請求/回應格式、錯誤碼）
- [ ] 【P3-文件】建立部署指南（GAS ScriptProperties、Google Sheets 設定）

---

## 已完成功能

- [x] 訂單狀態管理（已成立/已接單/已完成三狀態 + LINE 推播）
- [x] 折扣功能（整單/單品/滿額/時段折扣）
- [x] 員工權限管理（PIN 碼登入 + 操作紀錄）
- [x] 快取管理完整化（公告/營業時間/庫存更新時清除快取 + 前台自動刷新）
