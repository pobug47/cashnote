const fs = require("node:fs");
const path = require("node:path");
const XLSX = require("xlsx");

const inputPath = "C:/Users/User/Downloads/2026.05 가계부.xlsx";
const projectOutputDir = path.join(__dirname, "..", "downloads");
const projectOutputPath = path.join(projectOutputDir, "호정_지출_업로드용.xlsx");
const userDownloadPath = "C:/Users/User/Downloads/호정_지출_업로드용.xlsx";

function parseAmount(value) {
  return Number(String(value || "").replace(/[^0-9.-]/g, ""));
}

function normalizeDate(value) {
  const text = String(value || "").trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!match) return text;

  let year = Number(match[3]);
  if (year < 100) year += 2000;
  return `${year}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
}

function paymentMethod(paymentName) {
  const value = String(paymentName || "").trim();
  if (!value) return "";
  if (value.includes("우체국")) return "체크카드";
  if (value.includes("신한") || value.includes("현대")) return "신용카드";
  if (value.includes("카드")) return "신용카드";
  if (value.includes("은행") || value.includes("뱅크") || value.includes("미래에셋") || value.includes("기업") || value.includes("토스")) {
    return "계좌이체";
  }
  if (value.includes("포인트")) return "기타";
  return "기타";
}

fs.mkdirSync(projectOutputDir, { recursive: true });

const sourceWorkbook = XLSX.readFile(inputPath, { cellDates: true });
const sourceSheet = sourceWorkbook.Sheets["호정 지출"];
if (!sourceSheet) throw new Error("호정 지출 시트를 찾을 수 없습니다.");

const sourceRows = XLSX.utils.sheet_to_json(sourceSheet, { defval: "", raw: false });
const outputRows = [["날짜", "유형", "카테고리", "금액", "결제/이체 수단", "카드/은행/증권사명", "메모"]];

sourceRows.forEach((row) => {
  const date = normalizeDate(row["날짜"]);
  const amount = parseAmount(row["금액"]);
  const category = String(row["구분1"] || row["사용"] || "기타").trim();
  if (!date || !amount || !category) return;

  const memo = [row["사용"], row["구분2"], row["비고"]]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" · ");

  outputRows.push([
    date,
    "지출",
    category,
    amount,
    paymentMethod(row["결제"]),
    String(row["결제"] || "").trim(),
    memo
  ]);
});

const outputWorkbook = XLSX.utils.book_new();
const outputSheet = XLSX.utils.aoa_to_sheet(outputRows);
outputSheet["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 20 }, { wch: 48 }];
outputSheet["!autofilter"] = { ref: `A1:G${outputRows.length}` };
for (let rowIndex = 2; rowIndex <= outputRows.length; rowIndex += 1) {
  const amountCell = outputSheet[`D${rowIndex}`];
  if (amountCell) amountCell.z = "#,##0";
}

XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, "거래내역");
XLSX.writeFile(outputWorkbook, projectOutputPath);
fs.copyFileSync(projectOutputPath, userDownloadPath);

console.log(JSON.stringify({
  rows: outputRows.length - 1,
  projectOutputPath,
  userDownloadPath
}, null, 2));
