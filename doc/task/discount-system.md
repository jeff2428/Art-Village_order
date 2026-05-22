# 折扣功能模塊任務

## 目標

支援多種折扣類型：整單折扣、單品折扣、贈品折扣、時段折扣、滿額折扣。

## 折扣類型定義

| 類型 | 說明 | 觸發條件 |
|------|------|----------|
| order_percent | 整單百分比折扣 | 符合條件時套用整單 |
| order_fixed | 整單定額折扣 | 符合條件時扣固定金額 |
| item_percent | 單品百分比折扣 | 特定餐點 |
| item_fixed | 單品定額折扣 | 特定餐點 |
| free_item | 贈品折扣 | 符合條件時贈送 |
| time_period | 時段折扣 | 特定時段自動套用 |
| min_amount | 滿額折扣 | 訂單總額達門檻 |

## Sheets 結構

### Discounts Sheet

| 欄位 | 說明 |
|------|------|
| discountId | 折扣 ID |
| name | 折扣名稱 |
| type | 折扣類型 |
| value | 折扣值（百分比或金額） |
| minAmount | 最低消費門檻 |
| applicableItems | 適用品項（JSON 陣列或 * 代表全部） |
| timeStart | 生效時間（HH:mm） |
| timeEnd | 截止時間（HH:mm） |
| dateStart | 生效日期 |
| dateEnd | 截止日期 |
| enabled | 是否啟用 |
| priority | 優先順序（數字越小越優先） |

## 子任務

- [ ] 建立 Discounts Sheet 結構
- [ ] 實作 `getDiscounts` 讀取折扣設定
- [ ] 實作 `calculateDiscount` 計算折扣邏輯
- [ ] 實作 `validateDiscountRules` 驗證折扣規則
- [ ] 訂單處理時自動套用符合條件的折扣
- [ ] LINE 推播訊息包含折扣資訊
- [ ] 管理後台增加折扣管理介面
- [ ] 前台訂單送出時顯示折扣明細

## 驗收

- [ ] 可設定整單百分比折扣
- [ ] 可設定滿額折扣
- [ ] 可設定时段折扣
- [ ] 訂單自動套用符合條件的折扣
- [ ] LINE 推播顯示折扣後金額
- [ ] 管理後台可新增/修改/停用折扣
