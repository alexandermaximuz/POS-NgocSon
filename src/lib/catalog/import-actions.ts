"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/actions";
import { requireOwner } from "@/lib/auth/session";
import { importReasonMessage, rpcErrorMessage } from "@/lib/errors";
import { importPricesResultSchema } from "@/lib/pricing/schema";
import { getPriceMatrix, orderedPriceColumns, priceKey } from "@/lib/pricing/queries";
import { createClient } from "@/lib/supabase/server";
import { parsePriceWorkbook, parseProductWorkbook } from "./excel";
import { existingSkus, productsBySku, summarize } from "./import-lookup";
import { validateProductRow } from "./import-validate";
import {
  priceImportPayloadSchema,
  productImportPayloadSchema,
  type ImportOutcome,
  type ImportPreview,
  type PriceImportRow,
  type PreviewRow,
  type ProductImportRow,
} from "./import-schema";
import { importProductsResultSchema } from "./schema";
import { listItemGroups, listSupplierRefs, listUoms } from "./queries";

/**
 * Import Excel: đọc file → preview từng dòng → người dùng xác nhận → ghi.
 *
 * Preview KHÔNG ghi gì. Nó chỉ đối chiếu từng dòng với dữ liệu đang có và nói rõ
 * dòng nào hỏng vì sao. Danh sách dòng hợp lệ đi ngược về client rồi quay lại ở
 * bước xác nhận — không tin nó, RPC kiểm lại toàn bộ và vẫn tự bỏ qua SKU trùng.
 */

const MAX_FILE_BYTES = 4 * 1024 * 1024;
const PRODUCT_BATCH = 100;
const PRICE_BATCH = 200;

async function readUpload(formData: unknown): Promise<ArrayBuffer | string> {
  if (!(formData instanceof FormData)) return "Không nhận được file.";

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return "Chọn một file .xlsx để import.";
  if (file.size > MAX_FILE_BYTES) return "File quá lớn (tối đa 4MB). Tách nhỏ rồi thử lại.";

  return file.arrayBuffer();
}

// ---------------------------------------------------------------------------
// Sản phẩm
// ---------------------------------------------------------------------------

export async function previewProductImport(
  formData: unknown
): Promise<ActionResult<ImportPreview<ProductImportRow>>> {
  await requireOwner();

  const buffer = await readUpload(formData);
  if (typeof buffer === "string") return actionError(buffer);

  let rows: ProductImportRow[];
  try {
    rows = await parseProductWorkbook(buffer);
  } catch {
    return actionError("Không đọc được file. Kiểm tra lại đúng định dạng .xlsx.");
  }

  if (rows.length === 0) return actionError("File không có dòng dữ liệu nào.");
  if (rows.length > 3000) return actionError("File quá 3.000 dòng. Tách nhỏ rồi import lại.");

  const [groups, uoms, suppliers] = await Promise.all([
    listItemGroups(),
    listUoms(),
    listSupplierRefs(),
  ]);
  const groupCodes = new Set(groups.map((g) => g.code));
  const uomCodes = new Set(uoms.map((u) => u.code));
  const supplierCodes = new Set(suppliers.map((s) => s.code));
  const existing = await existingSkus(rows.map((r) => r.sku));

  const seen = new Set<string>();
  const preview: PreviewRow[] = [];
  const payload: ProductImportRow[] = [];

  for (const row of rows) {
    const reason = validateProductRow(row, {
      groupCodes,
      uomCodes,
      supplierCodes,
      seen,
    });

    if (reason !== null) {
      preview.push({ row: row.row, sku: row.sku, label: row.name, ...reason });
      continue;
    }

    seen.add(row.sku);

    if (existing.has(row.sku)) {
      preview.push({
        row: row.row,
        sku: row.sku,
        label: row.name,
        level: "warning",
        reason: importReasonMessage("DUPLICATE_SKU"),
      });
      continue;
    }

    preview.push({ row: row.row, sku: row.sku, label: row.name, level: "ok", reason: "" });
    payload.push(row);
  }

  return actionOk(summarize(preview, payload));
}

export async function runProductImport(input: unknown): Promise<ActionResult<ImportOutcome>> {
  const parsed = productImportPayloadSchema.safeParse(input);
  if (!parsed.success) return actionError("Danh sách dòng gửi lên không hợp lệ.");

  await requireOwner();
  const supabase = await createClient();
  const outcome: ImportOutcome = { created: 0, skipped: 0, failed: 0, rows: [] };

  for (let i = 0; i < parsed.data.rows.length; i += PRODUCT_BATCH) {
    const batch = parsed.data.rows.slice(i, i + PRODUCT_BATCH);
    const { data, error } = await supabase.rpc("rpc_import_products", {
      p_payload: {
        rows: batch.map((row) => ({
          row: row.row,
          sku: row.sku,
          name: row.name,
          group_code: row.groupCode,
          base_uom_code: row.baseUomCode,
          brand: row.brand,
          supplier_code: row.supplierCode,
          safety_stock: row.safetyStock,
          colors: row.colors,
          uoms: row.uoms.map((u) => ({ code: u.code, factor: u.factor })),
        })),
      },
    });

    if (error !== null) return actionError(rpcErrorMessage(error));

    const result = importProductsResultSchema.parse(data);
    outcome.created += result.created;
    outcome.skipped += result.skipped;
    outcome.failed += result.failed;
    for (const row of result.results) {
      // Dòng ghi được thì không có gì để nói. Liệt kê cả 157 dòng thành công với
      // ô "Lý do" trống làm bảng kết quả trông như một bảng lỗi.
      if (row.status === "created") continue;
      outcome.rows.push({
        row: row.row,
        sku: row.sku,
        status: row.status,
        reason: importReasonMessage(row.code),
      });
    }
  }

  revalidatePath("/san-pham");
  return actionOk(outcome);
}

// ---------------------------------------------------------------------------
// Bảng giá
// ---------------------------------------------------------------------------

export async function previewPriceImport(
  formData: unknown
): Promise<ActionResult<ImportPreview<PriceImportRow>>> {
  const session = await requireOwner();

  const buffer = await readUpload(formData);
  if (typeof buffer === "string") return actionError(buffer);

  const columns = await orderedPriceColumns(session.memberships);
  if (columns.length === 0) return actionError("Chưa có bảng giá nào để import.");

  let rows: PriceImportRow[];
  try {
    rows = await parsePriceWorkbook(buffer, columns.map((c) => c.id));
  } catch {
    return actionError("Không đọc được file. Kiểm tra lại đúng định dạng .xlsx.");
  }

  if (rows.length === 0) return actionError("File không có dòng dữ liệu nào.");

  const products = await productsBySku(rows.map((r) => r.sku));
  const matrix = await getPriceMatrix(
    columns.map((c) => c.id),
    [...products.values()]
  );

  const preview: PreviewRow[] = [];
  const payload: PriceImportRow[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const productId = products.get(row.sku);

    if (row.sku === "") {
      preview.push({ row: row.row, sku: "", label: "", level: "error", reason: "Thiếu mã sản phẩm" });
      continue;
    }
    if (seen.has(row.sku)) {
      preview.push({
        row: row.row,
        sku: row.sku,
        label: "",
        level: "error",
        reason: "Mã này đã xuất hiện ở dòng trên trong cùng file",
      });
      continue;
    }
    seen.add(row.sku);

    if (productId === undefined) {
      preview.push({
        row: row.row,
        sku: row.sku,
        label: "",
        level: "error",
        reason: importReasonMessage("PRODUCT_NOT_FOUND"),
      });
      continue;
    }
    if (row.prices.some((p) => p.price < 0)) {
      preview.push({ row: row.row, sku: row.sku, label: "", level: "error", reason: "Giá không được âm" });
      continue;
    }

    const changed = row.prices.filter(
      (p) => matrix.get(priceKey(p.priceListId, productId)) !== p.price
    );

    if (changed.length === 0) {
      preview.push({
        row: row.row,
        sku: row.sku,
        label: "",
        level: "warning",
        reason:
          row.prices.length === 0 ? "Dòng không có giá nào" : "Giá không đổi so với hiện tại",
      });
      continue;
    }

    preview.push({
      row: row.row,
      sku: row.sku,
      label: `${changed.length} giá thay đổi`,
      level: "ok",
      reason: "",
    });
    payload.push({ row: row.row, sku: row.sku, prices: changed });
  }

  return actionOk(summarize(preview, payload));
}

export async function runPriceImport(input: unknown): Promise<ActionResult<ImportOutcome>> {
  const parsed = priceImportPayloadSchema.safeParse(input);
  if (!parsed.success) return actionError("Danh sách dòng gửi lên không hợp lệ.");

  await requireOwner();
  const supabase = await createClient();

  // Một dòng Excel có tới 4 giá; RPC nhận danh sách phẳng từng (sản phẩm, bảng giá).
  const flat = parsed.data.rows.flatMap((row) =>
    row.prices.map((p) => ({ row: row.row, sku: row.sku, price_list_id: p.priceListId, price: p.price }))
  );

  const outcome: ImportOutcome = { created: 0, skipped: 0, failed: 0, rows: [] };

  for (let i = 0; i < flat.length; i += PRICE_BATCH) {
    const { data, error } = await supabase.rpc("rpc_import_prices", {
      p_payload: { rows: flat.slice(i, i + PRICE_BATCH) },
    });

    if (error !== null) return actionError(rpcErrorMessage(error));

    const result = importPricesResultSchema.parse(data);
    outcome.created += result.created;
    outcome.skipped += result.unchanged;
    outcome.failed += result.failed;
    for (const row of result.results) {
      if (row.status === "created") continue;
      outcome.rows.push({
        row: row.row,
        sku: row.sku,
        status: row.status,
        reason:
          row.status === "unchanged" ? "Giá không đổi" : importReasonMessage(row.code),
      });
    }
  }

  revalidatePath("/bang-gia");
  return actionOk(outcome);
}
