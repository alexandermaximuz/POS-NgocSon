import "server-only";

import ExcelJS from "exceljs";
import type { PriceImportRow, ProductImportRow } from "./import-schema";

/**
 * Đọc và sinh file .xlsx. CHỈ chạy ở server (`server-only`): gói exceljs nặng
 * ~1MB, không có lý do gì để nó đi vào bundle của máy đứng bán hàng.
 *
 * Cấu trúc file mẫu chốt ở phase-3.md §5: một dòng là một sản phẩm, các màu gộp
 * trong một ô ngăn bằng `|`. Mã vạch KHÔNG nằm trong file.
 */

export const PRODUCT_COLUMNS = [
  "Mã sản phẩm",
  "Tên sản phẩm",
  "Mã nhóm",
  "Mã đơn vị gốc",
  "Thương hiệu",
  "Mã nhà cung cấp",
  "Tồn tối thiểu",
  "Màu (ngăn bằng dấu |)",
  "Đơn vị lớn 1",
  "Hệ số 1",
  "Đơn vị lớn 2",
  "Hệ số 2",
] as const;

export interface RefLists {
  groups: { code: string; name: string }[];
  uoms: { code: string; name: string }[];
  suppliers: { code: string; name: string }[];
}

export async function buildProductTemplate(refs: RefLists): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("San pham");

  ws.addRow([...PRODUCT_COLUMNS]);
  ws.getRow(1).font = { bold: true };
  ws.columns = PRODUCT_COLUMNS.map((header) => ({ width: Math.max(14, header.length + 2) }));

  // Một dòng ví dụ, để người điền thấy ngay cách viết ô màu và cặp đơn vị/hệ số.
  ws.addRow(["TH40", "Thau nhựa Duy Thành 40cm", "NHUA", "CAI", "Duy Thành", "NCC01", 10, "Xanh dương|Đỏ|Trắng", "CHUC", 10, "THUNG", 12]);

  addReferenceSheet(wb, refs);
  return toBytes(await wb.xlsx.writeBuffer());
}

export async function buildPriceTemplate(
  columns: { label: string }[],
  sample: { sku: string; name: string } | null
): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Bang gia");

  const header = ["Mã sản phẩm", "Tên sản phẩm (chỉ để đối chiếu)", ...columns.map((c) => c.label)];
  ws.addRow(header);
  ws.getRow(1).font = { bold: true };
  ws.columns = header.map((h) => ({ width: Math.max(16, h.length + 2) }));

  if (sample !== null) {
    ws.addRow([sample.sku, sample.name, ...columns.map(() => "")]);
  }

  const note = wb.addWorksheet("Huong dan");
  note.addRow(["Cột giá phải giữ nguyên thứ tự bên dưới. Ô để trống nghĩa là không đổi giá."]);
  note.addRow([]);
  note.addRow(["Thứ tự cột", "Bảng giá"]);
  columns.forEach((c, i) => note.addRow([i + 3, c.label]));
  note.getColumn(2).width = 40;

  return toBytes(await wb.xlsx.writeBuffer());
}

function addReferenceSheet(wb: ExcelJS.Workbook, refs: RefLists): void {
  const ws = wb.addWorksheet("Ma tham chieu");
  ws.addRow(["Loại", "Mã", "Tên"]);
  ws.getRow(1).font = { bold: true };
  ws.columns = [{ width: 18 }, { width: 16 }, { width: 40 }];

  for (const g of refs.groups) ws.addRow(["Nhóm hàng", g.code, g.name]);
  for (const u of refs.uoms) ws.addRow(["Đơn vị", u.code, u.name]);
  for (const s of refs.suppliers) ws.addRow(["Nhà cung cấp", s.code, s.name]);
}

// ---------------------------------------------------------------------------
// Đọc file
// ---------------------------------------------------------------------------

export async function parseProductWorkbook(buffer: ArrayBuffer): Promise<ProductImportRow[]> {
  const sheet = await firstSheet(buffer);
  const rows: ProductImportRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // dòng tiêu đề

    const sku = text(row, 1);
    const name = text(row, 2);
    if (sku === "" && name === "") return; // dòng trống ở cuối file

    rows.push({
      row: rowNumber,
      sku: sku.toUpperCase().slice(0, 40),
      name: name.slice(0, 200),
      groupCode: text(row, 3).toUpperCase().slice(0, 20),
      baseUomCode: text(row, 4).toUpperCase().slice(0, 20),
      brand: text(row, 5).slice(0, 100),
      supplierCode: text(row, 6).toUpperCase().slice(0, 20),
      safetyStock: number(row, 7) ?? 0,
      colors: splitColors(text(row, 8)),
      uoms: [
        bulkUom(text(row, 9), number(row, 10)),
        bulkUom(text(row, 11), number(row, 12)),
      ].filter((u): u is { code: string; factor: number } => u !== null),
    });
  });

  return rows;
}

export async function parsePriceWorkbook(
  buffer: ArrayBuffer,
  priceListIds: string[]
): Promise<PriceImportRow[]> {
  const sheet = await firstSheet(buffer);
  const rows: PriceImportRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const sku = text(row, 1);
    if (sku === "") return;

    const prices: { priceListId: string; price: number }[] = [];
    priceListIds.forEach((priceListId, index) => {
      // Cột 1 là mã, cột 2 là tên đối chiếu, giá bắt đầu từ cột 3.
      const value = number(row, index + 3);
      if (value !== null) prices.push({ priceListId, price: value });
    });

    rows.push({ row: rowNumber, sku: sku.toUpperCase().slice(0, 40), prices });
  });

  return rows;
}

async function firstSheet(buffer: ArrayBuffer): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (sheet === undefined) throw new Error("File không có sheet nào");
  return sheet;
}

function splitColors(raw: string): string[] {
  return raw
    .split("|")
    .map((c) => c.trim().slice(0, 60))
    .filter((c) => c !== "")
    .slice(0, 50);
}

function bulkUom(code: string, factor: number | null): { code: string; factor: number } | null {
  const trimmed = code.trim().toUpperCase();
  if (trimmed === "" || factor === null) return null;
  return { code: trimmed.slice(0, 20), factor };
}

function text(row: ExcelJS.Row, column: number): string {
  const value = row.getCell(column).value;
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();

  // Ô có công thức hoặc rich text: exceljs trả về object.
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return String(value.result).trim();
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
    if ("text" in value && typeof value.text === "string") return value.text.trim();
  }
  return "";
}

/**
 * Đọc một ô số. Ô do Excel lưu dạng số thì dùng thẳng — đó là trường hợp thường
 * gặp vì file mẫu định dạng sẵn.
 *
 * Ô dạng chữ mới cần đoán: người dùng dán từ file cũ có thể ra "40.000" (bốn mươi
 * nghìn) hoặc "1.5" (một phẩy năm). Quy tắc: nhóm ba chữ số sau dấu phân cách cuối
 * cùng thì đó là dấu ngăn nghìn, ngược lại là dấu thập phân. Sai ở đây thì giá sai
 * 1000 lần, nên màn preview luôn hiện lại con số đã hiểu để người dùng đối chiếu.
 */
function number(row: ExcelJS.Row, column: number): number | null {
  const raw = row.getCell(column).value;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;

  const str = text(row, column);
  if (str === "") return null;

  const cleaned = str.replace(/[^\d.,-]/g, "");
  if (cleaned === "" || cleaned === "-") return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const lastSep = Math.max(lastDot, lastComma);

  let normalized: string;
  if (lastSep === -1) {
    normalized = cleaned;
  } else {
    const decimals = cleaned.length - lastSep - 1;
    normalized =
      decimals === 3
        ? cleaned.replace(/[.,]/g, "")
        : cleaned.slice(0, lastSep).replace(/[.,]/g, "") + "." + cleaned.slice(lastSep + 1);
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBytes(buffer: ExcelJS.Buffer): Uint8Array {
  return new Uint8Array(buffer as ArrayBuffer);
}
