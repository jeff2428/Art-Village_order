# LIFF 登入模塊任務

## 目標

初始化 LINE LIFF，取得顧客 LINE 身分，供訂單送出時綁定顧客資料。

## 子任務

- [x] 建立 LIFF 初始化流程
- [x] 檢查顧客是否已登入 LINE
- [x] 未登入時導向 LINE 登入
- [x] 登入後取得 LINE user id 與顯示名稱
- [x] 將 LINE profile 暫存在前端狀態
- [x] 處理 LIFF 初始化失敗錯誤

## 驗收

- [x] 顧客開啟頁面後可完成 LINE 登入
- [x] 系統可取得 LINE user id
- [x] 訂單送出資料包含 LINE user id
