# 員工權限管理模塊任務

## 目標

建立員工帳號系統，支援 PIN 碼登入後台，記錄所有操作日誌，實現權限分級管理。

## 權限等級定義

| 等級 | 名稱 | 權限範圍 |
|------|------|----------|
| 1 | admin | 所有功能（含員工管理） |
| 2 | manager | 菜單、訂單、公告、排程管理 |
| 3 | staff | 訂單查看、庫存管理 |

## Sheets 結構

### Employees Sheet

| 欄位 | 說明 |
|------|------|
| employeeId | 員工 ID |
| name | 員工姓名 |
| pinCode | PIN 碼（4-6 位數字） |
| role | 權限等級 |
| enabled | 是否啟用 |
| createdAt | 建立時間 |
| lastLogin | 最後登入時間 |

### AuditLog Sheet

| 欄位 | 說明 |
|------|------|
| logId | 紀錄 ID |
| timestamp | 時間戳記 |
| employeeId | 操作員工 ID |
| action | 操作動作 |
| target | 操作目標 |
| details | 詳細內容（JSON） |
| ipAddress | IP 位址 |

## 子任務

- [ ] 建立 Employees Sheet 結構
- [ ] 建立 AuditLog Sheet 結構
- [ ] 實作 `loginEmployee` PIN 碼驗證
- [ ] 實作 `logAction` 操作紀錄
- [ ] 實作 `checkPermission` 權限檢查
- [ ] 後台增加登入畫面
- [ ] 後台增加操作紀錄查看頁面
- [ ] 所有 admin-api action 加入權限驗證
- [ ] 管理後台增加員工管理介面

## 驗收

- [ ] 員工可使用 PIN 碼登入後台
- [ ] 不同權限等級看到不同功能選單
- [ ] 所有操作記錄到 AuditLog Sheet
- [ ] 管理者可查看操作日誌
- [ ] 可新增/停用員工帳號
- [ ] 未登入無法訪問後台功能
