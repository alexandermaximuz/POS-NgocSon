import type { ProductImportRow } from "./import-schema";

/**
 * Kiểm tra một dòng Excel sản phẩm.
 *
 * Tách khỏi `import-actions.ts` (file `"use server"`, chỉ được export hàm async)
 * để chạy và kiểm chứng được bằng script thường — luật ở đây quyết định dòng nào
 * vào database, nên nó phải soi được mà không cần dựng cả Next.js.
 *
 * Lý do trả về LUÔN nêu đúng giá trị gõ sai. "Mã nhóm hàng không tồn tại" không
 * giúp được ai khi file có 161 dòng; "Mã nhóm hàng NHỰA không tồn tại" thì người
 * dùng biết ngay là mình gõ dấu, và sheet tham chiếu ghi NHUA.
 */

export interface CatalogCodes {
  groupCodes: Set<string>;
  uomCodes: Set<string>;
  supplierCodes: Set<string>;
  /** Mã đã gặp ở các dòng TRƯỚC trong cùng file. Hàm này không tự thêm vào. */
  seen: Set<string>;
}

export interface RowRejection {
  level: "error";
  reason: string;
}

export function validateProductRow(
  row: ProductImportRow,
  refs: CatalogCodes
): RowRejection | null {
  if (row.sku === "") return reject("Thiếu mã sản phẩm");
  if (!/^[A-Za-z0-9._-]+$/.test(row.sku)) {
    return reject(`Mã sản phẩm ${row.sku} có ký tự không hợp lệ`);
  }
  if (row.name === "") return reject("Thiếu tên sản phẩm");
  if (refs.seen.has(row.sku)) {
    return reject(`Mã ${row.sku} đã xuất hiện ở dòng trên trong cùng file`);
  }
  if (!refs.groupCodes.has(row.groupCode)) {
    return reject(
      row.groupCode === ""
        ? "Thiếu mã nhóm hàng"
        : `Mã nhóm hàng ${row.groupCode} không tồn tại`
    );
  }
  if (!refs.uomCodes.has(row.baseUomCode)) {
    return reject(
      row.baseUomCode === ""
        ? "Thiếu mã đơn vị gốc"
        : `Mã đơn vị ${row.baseUomCode} không tồn tại`
    );
  }
  if (row.supplierCode !== "" && !refs.supplierCodes.has(row.supplierCode)) {
    return reject(`Mã nhà cung cấp ${row.supplierCode} không tồn tại`);
  }

  for (const uom of row.uoms) {
    if (!refs.uomCodes.has(uom.code)) {
      return reject(`Mã đơn vị lớn ${uom.code} không tồn tại`);
    }
    if (uom.code === row.baseUomCode) {
      return reject(`Đơn vị lớn ${uom.code} trùng với đơn vị gốc`);
    }
    if (uom.factor <= 0) return reject(`Hệ số của ${uom.code} phải lớn hơn 0`);
    if (uom.factor === 1) {
      return reject(`Hệ số của ${uom.code} phải khác 1 — hệ số 1 là của đơn vị gốc`);
    }
  }

  if (row.uoms.length === 2 && row.uoms[0]?.code === row.uoms[1]?.code) {
    return reject(`Hai đơn vị lớn trùng nhau (${row.uoms[0]?.code ?? ""})`);
  }
  if (row.safetyStock < 0) return reject("Tồn tối thiểu không được âm");

  return null;
}

function reject(reason: string): RowRejection {
  return { level: "error", reason };
}
