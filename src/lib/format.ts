/**
 * Định dạng hiển thị theo 05-giao-dien.md §"Ngôn ngữ & định dạng".
 *
 * Máy ở quầy đặt múi giờ nào cũng được — mọi mốc thời gian đều ép về
 * Asia/Ho_Chi_Minh, khớp với `fn_today_vn()` ở database.
 */

const TZ = "Asia/Ho_Chi_Minh";

const money = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 });

const dateFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("vi-VN", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `1234567` → `"1.234.567"`. Không kèm ký tự `đ`. */
export function formatMoney(value: number | string | null | undefined): string {
  const n = toNumber(value);
  return n === null ? "0" : money.format(Math.round(n));
}

/**
 * `"1.234.567"` → `1234567`. Bỏ mọi ký tự không phải chữ số.
 *
 * Chỉ nhận số nguyên dương: tiền Việt không có xu, và mọi ô nhập tiền trong hệ
 * thống này đều là số dương. Chuỗi rỗng trả `0`, không phải `NaN`.
 */
export function parseMoney(input: string): number {
  const digits = input.replace(/\D/g, "");
  return digits === "" ? 0 : Number.parseInt(digits, 10);
}

/** `5` chứ không phải `5,000`. Bỏ số 0 thừa sau dấu thập phân. */
export function formatQty(value: number | string | null | undefined): string {
  const n = toNumber(value);
  if (n === null) return "0";
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 3 }).format(n);
}

/** `dd/MM/yyyy` */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d === null ? "" : dateFmt.format(d);
}

/** `HH:mm` */
export function formatTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d === null ? "" : timeFmt.format(d);
}

/** `HH:mm dd/MM/yyyy` — giờ trước, vì ca làm việc thường xem trong ngày. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  return d === null ? "" : `${timeFmt.format(d)} ${dateFmt.format(d)}`;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
