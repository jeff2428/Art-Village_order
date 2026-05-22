# 訂單狀態管理模塊任務

## 目標

管理者可在後台切換訂單狀態（已成立 → 已接單 → 已完成），狀態變更時自動推播通知至 LINE 群組。

## 狀態定義

| 狀態 | 說明 | 可轉換至 |
|------|------|----------|
| pending | 已成立（顧客剛送出） | confirmed, cancelled |
| confirmed | 已接單（店家確認） | completed, cancelled |
| completed | 已完成（顧客已用餐） | - |
| cancelled | 已取消 | - |

## 子任務

- [ ] 增強 `updateOrderStatus` 支援狀態轉換驗證
- [ ] 狀態變更時觸發 LINE 推播通知
- [ ] 新增 `getOrdersByStatus` 查詢函式
- [ ] 新增 `getOrderStatusHistory` 紀錄查詢
- [ ] 後台訂單列表增加狀態切換按鈕
- [ ] 後台增加訂單狀態篩選功能
- [ ] LINE 推播訊息包含狀態變更資訊

## 驗收

- [ ] 管理者可將訂單從 pending 轉為 confirmed
- [ ] 管理者可將訂單從 confirmed 轉為 completed
- [ ] 管理者可取消 pending 或 confirmed 訂單
- [ ] 狀態變更時 LINE 群組收到通知
- [ ] 後台可依狀態篩選訂單
- [ ] 非法狀態轉換被拒絕（如 completed → pending）
