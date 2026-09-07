import { z } from "zod";

/**
 * Kiểu dữ liệu của một dòng Excel sau khi đã đọc và chuẩn hoá.
 *
 * File Excel được đọc Ở SERVER, không phải ở client như bản kế hoạch đầu: gói
 * `exceljs` nặng ~1MB và bản chạy trên trình duyệt phụ thuộc vào việc bundler đọc
 * đúng trường `browser` trong package.json. Đọc ở server thì dùng thẳng bản Node,
 * không có gì để đoán, và bundle của người đứng bán hàng không phải gánh thêm 1MB.
 * Luồng người dùng nhìn thấy vẫn y hệt: chọn file → xem preview từng dòng → xác nhận.
 *
 * Client giữ lại mảng dòng đã parse để gửi lại lúc xác nhận. Không tin mảng đó:
 * RPC kiểm lại toàn bộ, preview chỉ để người dùng nhìn trước.
 */

export const productImportRowSchema = z.object({
  /** Số dòng trong file Excel, để preview chỉ đúng dòng cần sửa. */
  row: z.number().int().min(1),
  sku: z.string().max(40),
  name: z.string().max(200),
  groupCode: z.string().max(20),
  baseUomCode: z.string().max(20),
  brand: z.string().max(100),
  supplierCode: z.string().max(20),
  safetyStock: z.number().min(0).max(9_999_999),
  colors: z.array(z.string().max(60)).max(50),
  uoms: z
    .array(z.object({ code: z.string().max(20), factor: z.number().finite() }))
    .max(6),
});

export const priceImportRowSchema = z.object({
  row: z.number().int().min(1),
  sku: z.string().max(40),
  prices: z
    .array(z.object({ priceListId: z.uuid(), price: z.number().finite() }))
    .max(8),
});

export const productImportPayloadSchema = z.object({
  rows: z.array(productImportRowSchema).max(3000, "File quá lớn, tách nhỏ rồi import lại"),
});

export const priceImportPayloadSchema = z.object({
  rows: z.array(priceImportRowSchema).max(3000, "File quá lớn, tách nhỏ rồi import lại"),
});

export type ProductImportRow = z.infer<typeof productImportRowSchema>;
export type PriceImportRow = z.infer<typeof priceImportRowSchema>;

/** Ba mức của màn preview (phase-3.md §5): hợp lệ / cảnh báo / lỗi. */
export type PreviewLevel = "ok" | "warning" | "error";

export interface PreviewRow {
  row: number;
  sku: string;
  label: string;
  level: PreviewLevel;
  /** Lý do cụ thể, đã là tiếng Việt. Rỗng khi hợp lệ. */
  reason: string;
}

export interface ImportPreview<T> {
  rows: PreviewRow[];
  /** Chỉ những dòng `ok` — đây là thứ gửi đi khi người dùng bấm xác nhận. */
  payload: T[];
  ok: number;
  warning: number;
  error: number;
}

export interface ImportOutcomeRow {
  row: number;
  sku: string | null;
  status: string;
  reason: string;
}

export interface ImportOutcome {
  created: number;
  /** Sản phẩm: SKU đã tồn tại. Bảng giá: giá không đổi. */
  skipped: number;
  failed: number;
  rows: ImportOutcomeRow[];
}
