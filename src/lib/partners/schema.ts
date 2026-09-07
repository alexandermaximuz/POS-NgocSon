import { z } from "zod";

const CODE_RE = /^[A-Za-z0-9._-]+$/;

/**
 * Khách hàng và nhà cung cấp giữ đúng các trường ở 04-erpnext-mapping.md.
 *
 * KHÔNG thêm `credit_limit`, `payment_terms`, `default_price_list` — cả ba đã bị
 * loại có lý do ở 0003:41-50. `default_price_list` đặc biệt không được thêm lại:
 * `customers` là bảng dùng chung còn `price_lists` có `store_id`, trỏ từ đây sang
 * đó là rò rỉ ranh giới cửa hàng.
 */

const phone = z
  .string()
  .trim()
  .max(20, "Số điện thoại tối đa 20 ký tự")
  .refine((v) => v === "" || /^[0-9+\s.-]+$/.test(v), "Số điện thoại chỉ gồm chữ số và dấu + - .");

export const customerFormSchema = z.object({
  id: z.uuid().nullable(),
  code: z
    .string()
    .trim()
    .min(1, "Nhập mã khách")
    .max(20, "Mã khách tối đa 20 ký tự")
    .regex(CODE_RE, "Mã khách chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới"),
  name: z.string().trim().min(1, "Nhập tên khách").max(150, "Tên tối đa 150 ký tự"),
  phone,
  address: z.string().trim().max(300, "Địa chỉ tối đa 300 ký tự"),
  customerGroup: z.enum(["retail", "wholesale"]),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự"),
  isActive: z.boolean(),
});

export const supplierFormSchema = z.object({
  id: z.uuid().nullable(),
  code: z
    .string()
    .trim()
    .min(1, "Nhập mã nhà cung cấp")
    .max(20, "Mã tối đa 20 ký tự")
    .regex(CODE_RE, "Mã chỉ gồm chữ, số, dấu chấm, gạch ngang, gạch dưới"),
  name: z.string().trim().min(1, "Nhập tên nhà cung cấp").max(150, "Tên tối đa 150 ký tự"),
  phone,
  address: z.string().trim().max(300, "Địa chỉ tối đa 300 ký tự"),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự"),
  isActive: z.boolean(),
});

export type CustomerForm = z.infer<typeof customerFormSchema>;
export type SupplierForm = z.infer<typeof supplierFormSchema>;
