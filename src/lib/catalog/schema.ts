import { z } from "zod";

/**
 * Ranh giới kiểu giữa RPC danh mục và giao diện. Cùng khuôn với
 * `src/lib/shift/schema.ts`: nửa trên là kết quả RPC (snake_case, đúng như SQL
 * trả về), nửa dưới là form (camelCase, thông báo lỗi tiếng Việt).
 */

/** numeric của Postgres có thể về dạng chuỗi "40000.00" qua PostgREST. */
const numeric = z.coerce.number().finite();

// ---------------------------------------------------------------------------
// Kết quả RPC
// ---------------------------------------------------------------------------

export const saveProductResultSchema = z.object({
  product_id: z.uuid(),
  sku: z.string(),
  name: z.string(),
  created: z.boolean(),
  uom_count: z.coerce.number().int(),
  variant_count: z.coerce.number().int(),
  barcode_count: z.coerce.number().int(),
});

export const deleteProductResultSchema = z.object({
  product_id: z.uuid(),
  sku: z.string(),
  name: z.string(),
});

export const deleteItemGroupResultSchema = z.object({
  item_group_id: z.uuid(),
  name: z.string(),
});

export const addBarcodeResultSchema = z.object({
  variant_id: z.uuid(),
  barcode: z.string(),
});

export const importProductsResultSchema = z.object({
  created: z.coerce.number().int(),
  skipped: z.coerce.number().int(),
  failed: z.coerce.number().int(),
  results: z.array(
    z.object({
      row: z.coerce.number().int(),
      sku: z.string().nullable(),
      status: z.enum(["created", "skipped", "error"]),
      code: z.string().nullable(),
    })
  ),
});

export type ImportProductsResult = z.infer<typeof importProductsResultSchema>;
export type SaveProductResult = z.infer<typeof saveProductResultSchema>;
export type DeleteProductResult = z.infer<typeof deleteProductResultSchema>;
export type DeleteItemGroupResult = z.infer<typeof deleteItemGroupResultSchema>;
export type AddBarcodeResult = z.infer<typeof addBarcodeResultSchema>;

// ---------------------------------------------------------------------------
// Form sản phẩm
// ---------------------------------------------------------------------------

const CODE_RE = /^[A-Za-z0-9._-]+$/;

export const productUomRowSchema = z.object({
  uomId: z.uuid({ error: "Chọn đơn vị" }),
  /*
   * Hệ số phải KHÁC 1: dòng hệ số 1 là của đơn vị gốc và đã được RPC tự ghi.
   * Gõ thêm một đơn vị hệ số 1 sẽ đụng ux_product_uoms_base và nổ 23505 — chặn ở
   * đây để người dùng đọc được câu tiếng Việt thay vì mã lỗi Postgres.
   */
  factor: z
    .number({ error: "Nhập hệ số quy đổi" })
    .positive("Hệ số phải lớn hơn 0")
    .max(100_000, "Hệ số quá lớn")
    .refine((v) => v !== 1, "Hệ số phải khác 1 — đơn vị gốc đã có hệ số 1"),
});

export const productVariantRowSchema = z.object({
  id: z.uuid().nullable(),
  variantCode: z
    .string()
    .trim()
    .min(1, "Nhập mã biến thể")
    .max(60, "Mã biến thể tối đa 60 ký tự")
    .regex(CODE_RE, "Mã biến thể chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới"),
  attrColor: z.string().trim().max(60, "Tên màu tối đa 60 ký tự"),
  isDefault: z.boolean(),
  status: z.enum(["active", "inactive"]),
});

export const productBarcodeRowSchema = z.object({
  variantCode: z.string().trim().min(1, "Chọn biến thể"),
  barcode: z
    .string()
    .trim()
    .min(4, "Mã vạch tối thiểu 4 ký tự")
    .max(40, "Mã vạch tối đa 40 ký tự"),
  source: z.enum(["manufacturer", "internal"]),
});

export const productFormSchema = z
  .object({
    id: z.uuid().nullable(),
    sku: z
      .string()
      .trim()
      .min(1, "Nhập mã sản phẩm")
      .max(40, "Mã sản phẩm tối đa 40 ký tự")
      .regex(CODE_RE, "Mã sản phẩm chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới"),
    name: z.string().trim().min(1, "Nhập tên sản phẩm").max(200, "Tên tối đa 200 ký tự"),
    itemGroupId: z.uuid({ error: "Chọn nhóm hàng" }),
    baseUomId: z.uuid({ error: "Chọn đơn vị gốc" }),
    brand: z.string().trim().max(100, "Thương hiệu tối đa 100 ký tự"),
    defaultSupplierId: z.uuid().nullable(),
    safetyStock: z
      .number({ error: "Nhập tồn tối thiểu" })
      .min(0, "Tồn tối thiểu không được âm")
      .max(9_999_999, "Số quá lớn"),
    status: z.enum(["active", "inactive"]),
    description: z.string().trim().max(1000, "Mô tả tối đa 1000 ký tự"),
    uoms: z.array(productUomRowSchema).max(6, "Tối đa 6 đơn vị quy đổi"),
    variants: z.array(productVariantRowSchema).max(50, "Tối đa 50 biến thể"),
    barcodes: z.array(productBarcodeRowSchema).max(200, "Tối đa 200 mã vạch"),
  })
  .superRefine((form, ctx) => {
    addDuplicateIssue(ctx, form.uoms.map((u) => u.uomId), ["uoms"], "Đơn vị này đã có ở dòng trên");
    addDuplicateIssue(
      ctx,
      form.variants.map((v) => v.variantCode.toUpperCase()),
      ["variants"],
      "Mã biến thể này đã có ở dòng trên"
    );
    addDuplicateIssue(
      ctx,
      form.barcodes.map((b) => b.barcode.toUpperCase()),
      ["barcodes"],
      "Mã vạch này đã có ở dòng trên"
    );

    if (form.uoms.some((u) => u.uomId === form.baseUomId)) {
      ctx.addIssue({
        code: "custom",
        path: ["uoms"],
        message: "Đơn vị gốc đã có sẵn hệ số 1, không cần khai lại ở bảng quy đổi",
      });
    }

    // Mảng rỗng là hợp lệ: RPC tự tạo biến thể mặc định. Nhưng đã khai màu thì
    // phải có đúng một dòng mặc định, không để RPC đoán hộ.
    if (form.variants.length > 0 && form.variants.filter((v) => v.isDefault).length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["variants"],
        message: "Chọn đúng một biến thể mặc định",
      });
    }

    const codes = new Set(form.variants.map((v) => v.variantCode.trim()));
    for (const [i, row] of form.barcodes.entries()) {
      if (!codes.has(row.variantCode.trim())) {
        ctx.addIssue({
          code: "custom",
          path: ["barcodes", i, "variantCode"],
          message: "Biến thể này không còn trong danh sách",
        });
      }
    }
  });

function addDuplicateIssue(
  ctx: z.RefinementCtx,
  values: string[],
  path: (string | number)[],
  message: string
): void {
  const seen = new Set<string>();
  for (const [i, value] of values.entries()) {
    if (seen.has(value)) {
      ctx.addIssue({ code: "custom", path: [...path, i], message });
    }
    seen.add(value);
  }
}

export type ProductForm = z.infer<typeof productFormSchema>;
export type ProductUomRow = z.infer<typeof productUomRowSchema>;
export type ProductVariantRow = z.infer<typeof productVariantRowSchema>;
export type ProductBarcodeRow = z.infer<typeof productBarcodeRowSchema>;

// ---------------------------------------------------------------------------
// Form nhóm hàng
// ---------------------------------------------------------------------------

export const itemGroupFormSchema = z.object({
  id: z.uuid().nullable(),
  code: z
    .string()
    .trim()
    .min(1, "Nhập mã nhóm")
    .max(20, "Mã nhóm tối đa 20 ký tự")
    .regex(CODE_RE, "Mã nhóm chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới"),
  name: z.string().trim().min(1, "Nhập tên nhóm").max(100, "Tên nhóm tối đa 100 ký tự"),
  parentId: z.uuid().nullable(),
  sortOrder: z.number().int().min(0).max(9999),
});

export type ItemGroupForm = z.infer<typeof itemGroupFormSchema>;

// ---------------------------------------------------------------------------
// Giá theo đơn vị — dùng ở trang chi tiết sản phẩm và màn bảng giá
// ---------------------------------------------------------------------------

export const priceRowSchema = z.object({
  price_list_id: z.uuid(),
  product_id: z.uuid(),
  price_per_base_unit: numeric,
});

export type PriceRow = z.infer<typeof priceRowSchema>;
