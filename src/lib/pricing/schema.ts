import { z } from "zod";

const money = z.coerce.number().finite();

export const updatePriceResultSchema = z.object({
  price_list_item_id: z.uuid(),
  price_list_id: z.uuid(),
  product_id: z.uuid(),
  sku: z.string(),
  /** `null` khi sản phẩm chưa từng có giá ở bảng này. */
  previous_price: money.nullable(),
  price_per_base_unit: money,
  effective_from: z.string(),
});

export const importPricesResultSchema = z.object({
  created: z.coerce.number().int(),
  unchanged: z.coerce.number().int(),
  failed: z.coerce.number().int(),
  results: z.array(
    z.object({
      row: z.coerce.number().int(),
      sku: z.string().nullable(),
      status: z.enum(["created", "unchanged", "error"]),
      code: z.string().nullable(),
    })
  ),
});

export type UpdatePriceResult = z.infer<typeof updatePriceResultSchema>;
export type ImportPricesResult = z.infer<typeof importPricesResultSchema>;

export const updatePriceFormSchema = z.object({
  priceListId: z.uuid(),
  productId: z.uuid(),
  price: z
    .number({ error: "Nhập giá" })
    .int()
    .min(0, "Giá không được âm")
    .max(999_999_999_999, "Giá quá lớn"),
});

export type UpdatePriceForm = z.infer<typeof updatePriceFormSchema>;
