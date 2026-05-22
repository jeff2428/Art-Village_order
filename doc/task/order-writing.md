# 訂單寫入模塊任務

## 目標

將訂單主檔與訂單品項明細寫入 Google Sheets。

## 子任務

- [x] 開啟 Orders Sheet
- [x] 開啟 OrderItems Sheet
- [x] 寫入訂單主檔資料列
- [x] 寫入每一筆訂單品項資料列
- [x] 寫入失敗時回傳錯誤
- [x] 確保訂單主檔與明細使用相同訂單 ID

## 驗收

- [x] 成功訂單可在 Orders Sheet 查到
- [x] 成功訂單可在 OrderItems Sheet 查到品項
- [x] 寫入失敗時不回傳成功狀態
