const fs = require("node:fs");
const path = require("node:path");

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

function rowsToObjects(rows) {
  const headers = (rows[0] || []).map((header) => String(header || "").trim());
  return rows.slice(1).map((row) =>
    headers.reduce((item, header, index) => {
      if (header) item[header] = row?.[index] ?? "";
      return item;
    }, {})
  );
}

function excelCell(value, options = {}) {
  const cell = { value: value ?? "" };
  if (options.bold) cell.fontWeight = "bold";
  if (options.format) cell.format = options.format;
  return cell;
}

(async () => {
  const { default: readXlsxFile } = await import("read-excel-file/node");
  const { default: writeXlsxFile } = await import("write-excel-file/node");
  const sourceRows = rowsToObjects(await readXlsxFile(inputPath, { sheet: "호정 지출" }));
  const outputRows = [
    ["날짜", "유형", "카테고리", "금액", "결제/이체 수단", "카드/은행/증권사명", "메모"].map((value) => excelCell(value, { bold: true }))
  ];

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
      excelCell(date),
      excelCell("지출"),
      excelCell(category),
      excelCell(amount, { format: "#,##0" }),
      excelCell(paymentMethod(row["결제"])),
      excelCell(String(row["결제"] || "").trim()),
      excelCell(memo)
    ]);
  });

  const workbook = await writeXlsxFile([{ sheet: "거래내역", data: outputRows }], { buffer: true });
  const buffer = await workbook.toBuffer();
  fs.writeFileSync(projectOutputPath, buffer);
  fs.copyFileSync(projectOutputPath, userDownloadPath);

  console.log(JSON.stringify({
    rows: outputRows.length - 1,
    projectOutputPath,
    userDownloadPath
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
