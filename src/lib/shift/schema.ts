import { z } from "zod";

/**
 * Ranh giới kiểu giữa RPC và giao diện.
 *
 * RPC trả `jsonb`, mà `Json` của supabase-js là kiểu mở — không parse thì mọi chỗ
 * dùng đều phải ép kiểu, và một lần đổi payload ở SQL sẽ không làm `tsc` kêu ở
 * đâu cả. Parse ở đúng một chỗ này để lỗi nổ ngay tại ranh giới.
 */

/** Số tiền hiển thị đi qua Postgres numeric → có thể về dạng chuỗi "4800000.00". */
const money = z.coerce.number().finite();

export const openShiftResultSchema = z.object({
  shift_id: z.uuid(),
  opening_float: money,
});

export const closeShiftResultSchema = z.object({
  shift_id: z.uuid(),
  expected_cash: money,
  counted_cash: money,
  variance: money,
  held_orders: z.coerce.number().int(),
});

export const cashTxnResultSchema = z.object({
  cash_txn_id: z.uuid(),
  expected_cash: money,
});

export const currentShiftSchema = z.discriminatedUnion("has_open_shift", [
  z.object({ has_open_shift: z.literal(false) }),
  z.object({
    has_open_shift: z.literal(true),
    shift_id: z.uuid(),
    opened_at: z.string(),
    opening_float: money,
    holder_name: z.string(),
    is_mine: z.boolean(),
    expected_cash: money,
  }),
]);

export type CurrentShift = z.infer<typeof currentShiftSchema>;
export type OpenShiftResult = z.infer<typeof openShiftResultSchema>;
export type CloseShiftResult = z.infer<typeof closeShiftResultSchema>;
export type CashTxnResult = z.infer<typeof cashTxnResultSchema>;

// ---------------------------------------------------------------------------
// Form
//
// Tiền đi qua <MoneyInput> nên tới đây đã là số nguyên dương. Vẫn kiểm lại: form
// có thể bị submit bằng bàn phím trước khi component kịp chuẩn hoá.
// ---------------------------------------------------------------------------

export const openShiftFormSchema = z.object({
  openingFloat: z
    .number({ error: "Nhập số tiền đầu ca" })
    .int()
    .min(0, "Tiền đầu ca không được âm")
    .max(999_999_999_999, "Số tiền quá lớn"),
});

export const closeShiftFormSchema = z.object({
  countedCash: z
    .number({ error: "Nhập số tiền thực đếm" })
    .int()
    .min(0, "Tiền thực đếm không được âm")
    .max(999_999_999_999, "Số tiền quá lớn"),
  note: z.string().max(500, "Ghi chú tối đa 500 ký tự").optional(),
});

export const cashTxnFormSchema = z.object({
  type: z.enum(["in", "out"]),
  amount: z
    .number({ error: "Nhập số tiền" })
    .int()
    .positive("Số tiền phải lớn hơn 0")
    .max(999_999_999_999, "Số tiền quá lớn"),
  reason: z.string().trim().min(1, "Nhập lý do").max(200, "Lý do tối đa 200 ký tự"),
});

export type OpenShiftForm = z.infer<typeof openShiftFormSchema>;
export type CloseShiftForm = z.infer<typeof closeShiftFormSchema>;
export type CashTxnForm = z.infer<typeof cashTxnFormSchema>;
