import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/jeff2/Documents/Art-Village_order/outputs/art-village-sheet";
const outputPath = path.join(outputDir, "藝素村線上點餐資料庫.xlsx");

const workbook = Workbook.create();

const sheets = [
  {
    name: "Categories",
    rows: [
      ["categoryId", "name", "sortOrder", "enabled"],
      ["cat-noodle", "麵食", 10, true],
      ["cat-rice", "飯食", 20, true],
    ],
  },
  {
    name: "Products",
    rows: [
      ["productId", "categoryId", "name", "description", "price", "soldOut", "sortOrder", "enabled", "imageUrl"],
      ["p-beef-noodle", "cat-noodle", "紅燒麵", "湯麵", 120, false, 10, true, ""],
      ["p-dry-noodle", "cat-noodle", "乾拌麵", "乾麵", 100, false, 20, true, ""],
      ["p-fried-rice", "cat-rice", "炒飯", "香炒", 100, false, 10, true, ""],
    ],
  },
  {
    name: "OptionGroups",
    rows: [
      ["groupId", "name", "type", "required", "sortOrder", "enabled"],
      ["g-noodle", "麵條", "single", true, 10, true],
      ["g-spicy", "辣度", "single", false, 20, true],
    ],
  },
  {
    name: "OptionItems",
    rows: [
      ["optionItemId", "groupId", "name", "sortOrder", "enabled"],
      ["i-ramen", "g-noodle", "拉麵", 10, true],
      ["i-thin", "g-noodle", "細麵", 20, true],
      ["i-no-spicy", "g-spicy", "不辣", 10, true],
      ["i-mild", "g-spicy", "小辣", 20, true],
      ["i-hot", "g-spicy", "大辣", 30, true],
    ],
  },
  {
    name: "ProductOptions",
    rows: [
      ["productId", "groupId", "sortOrder", "enabled"],
      ["p-beef-noodle", "g-noodle", 10, true],
      ["p-beef-noodle", "g-spicy", 20, true],
      ["p-dry-noodle", "g-noodle", 10, true],
      ["p-fried-rice", "g-spicy", 10, true],
    ],
  },
  {
    name: "BusinessHours",
    rows: [
      ["type", "openTime", "closeTime", "enabled"],
      ["default", "11:00", "21:00", true],
    ],
  },
  {
    name: "Holidays",
    rows: [["date", "reason", "enabled"]],
  },
  {
    name: "Announcements",
    rows: [
      ["position", "content", "enabled"],
      ["header", "", false],
      ["popup", "", false],
      ["checkout", "訂單送出後不可修改或取消，如需調整請致電或透過官方 LINE 聯繫。", true],
    ],
  },
  {
    name: "Orders",
    rows: [["orderId", "timestamp", "liffUserId", "customerName", "phone", "guestCount", "diningDate", "diningTime", "totalAmount", "status"]],
  },
  {
    name: "OrderItems",
    rows: [["orderId", "itemName", "quantity", "unitPrice", "customizationText", "lineTotal"]],
  },
];

function colName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

for (const spec of sheets) {
  const sheet = workbook.worksheets.add(spec.name);
  const rowCount = spec.rows.length;
  const colCount = Math.max(...spec.rows.map((row) => row.length));
  const lastCol = colName(colCount - 1);

  sheet.getRange(`A1:${lastCol}${rowCount}`).values = spec.rows;
  sheet.getRange(`A1:${lastCol}1`).format = {
    fill: "#166534",
    font: { bold: true, color: "#FFFFFF" },
  };
  sheet.freezePanes.freezeRows(1);
  sheet.getRange(`A1:${lastCol}${Math.max(rowCount, 2)}`).format.autofitColumns();
}

await fs.mkdir(outputDir, { recursive: true });

const overview = await workbook.inspect({
  kind: "sheet,table",
  maxChars: 6000,
  tableMaxRows: 5,
  tableMaxCols: 8,
});
console.log(overview.ndjson);

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

for (const sheetName of ["Categories", "Products", "OptionGroups", "OptionItems", "ProductOptions", "BusinessHours", "Announcements", "Orders", "OrderItems"]) {
  await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
}

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(outputPath);
