import type { PostgrestError } from "@supabase/supabase-js";

/**
 * Dịch mã lỗi RPC sang tiếng Việt có ngữ cảnh (05-giao-dien.md §"Thông báo lỗi
 * nghiệp vụ").
 *
 * Không bao giờ để lọt message thô của Postgres ra màn hình: người đứng bán hàng
 * đọc "null value in column user_id violates not-null constraint" thì không biết
 * phải làm gì tiếp.
 */

/** Mã do RPC của dự án raise. Bảng này lớn dần theo từng phase. */
const MESSAGES: Record<string, string> = {
  PERMISSION_DENIED: "Bạn không có quyền thực hiện thao tác này.",
  INVALID_PAYLOAD: "Dữ liệu nhập chưa hợp lệ. Kiểm tra lại các ô đã nhập.",
  SHIFT_NOT_OPEN: "Chưa mở ca. Vào Cài đặt → Mở ca để bắt đầu bán hàng.",
  SHIFT_NOT_FOUND: "Không tìm thấy ca làm việc.",
  SHIFT_ALREADY_OPEN: "Cửa hàng này đã có ca đang mở.",

  // Phase 3 — danh mục
  DUPLICATE_SKU: "Mã sản phẩm này đã có rồi.",
  DUPLICATE_VARIANT_CODE: "Mã biến thể này đã thuộc về sản phẩm khác.",
  DUPLICATE_BARCODE: "Mã vạch này đã gắn cho hàng khác.",
  MISSING_DEFAULT_VARIANT: "Sản phẩm phải có đúng một biến thể mặc định.",
  MISSING_BASE_UOM: "Đơn vị gốc phải có đúng một dòng hệ số 1.",
  VARIANT_IN_USE: "Không xoá được biến thể đã có phát sinh kho.",
  PRODUCT_IN_USE:
    "Không xoá được sản phẩm đã có phát sinh. Chuyển sang trạng thái Ngừng bán thay vì xoá.",
  GROUP_IN_USE: "Không xoá được nhóm này vì còn dữ liệu bên trong.",
  GROUP_CYCLE: "Nhóm không thể là nhóm con của chính nó hoặc của nhóm con của nó.",
  IMPORT_BATCH_TOO_LARGE: "Lô import quá lớn. Tải lại trang rồi thử lại.",
  PRODUCT_NOT_FOUND: "Không tìm thấy sản phẩm.",
};

/**
 * Mã lỗi có `detail` mang thông tin người dùng cần để xử lý tiếp — tên hàng, mã
 * trùng, số lượng còn vướng. Câu chung chung ở `MESSAGES` là bản dự phòng khi RPC
 * không kèm detail.
 */
const WITH_DETAIL: Record<string, (detail: string) => string> = {
  SHIFT_ALREADY_OPEN: (d) => `Ca của ${d} đang mở. Đóng ca đó trước khi mở ca mới.`,
  DUPLICATE_SKU: (d) => `Mã sản phẩm ${d} đã có rồi. Dùng mã khác, hoặc sửa sản phẩm cũ.`,
  DUPLICATE_VARIANT_CODE: (d) => `Mã biến thể ${d} đã thuộc về sản phẩm khác.`,
  DUPLICATE_BARCODE: (d) => `Mã vạch ${d} đã gắn cho hàng khác.`,
  VARIANT_IN_USE: (d) =>
    `Không xoá được biến thể ${d}: đã có phát sinh kho. Chuyển biến thể sang Ngừng bán thay vì xoá.`,
  PRODUCT_IN_USE: (d) =>
    `Không xoá được ${d}: đã có phát sinh kho hoặc đang nằm trong bảng giá. Chuyển sang Ngừng bán.`,
  GROUP_IN_USE: (d) => `Không xoá được nhóm này: còn ${d} bên trong.`,
};

const FALLBACK = "Không thực hiện được. Thử lại, nếu vẫn lỗi thì báo chủ cửa hàng.";

export function rpcErrorMessage(error: PostgrestError | null): string {
  if (error === null) return FALLBACK;

  const code = error.message.trim();
  const base = MESSAGES[code];
  if (base === undefined) return FALLBACK;

  const withDetail = WITH_DETAIL[code];
  if (withDetail !== undefined && typeof error.details === "string" && error.details !== "") {
    return withDetail(error.details);
  }
  return base;
}

/**
 * Lỗi khi GHI THẲNG vào bảng (nhóm hàng, khách hàng, nhà cung cấp) thay vì qua RPC.
 *
 * Ở đó không có chỗ nào raise mã lỗi của dự án, chỉ có SQLSTATE của Postgres. Đây
 * là nơi duy nhất dịch chúng — đừng để `error.message` thô ra màn hình, người đứng
 * bán đọc "duplicate key value violates unique constraint" thì không biết làm gì.
 */
export function writeErrorMessage(
  error: PostgrestError | null,
  duplicateMessage: string
): string {
  if (error === null) return FALLBACK;

  switch (error.code) {
    case "23505":
      return duplicateMessage;
    case "23503":
      return "Không xoá được vì còn dữ liệu khác đang tham chiếu tới bản ghi này.";
    case "23514":
      return "Dữ liệu nhập chưa hợp lệ. Kiểm tra lại các ô đã nhập.";
    case "42501":
      return MESSAGES.PERMISSION_DENIED ?? FALLBACK;
    default:
      return FALLBACK;
  }
}

/**
 * Lý do một DÒNG import bị bỏ qua hoặc hỏng. Khác `rpcErrorMessage`: chỗ này nằm
 * trong bảng preview, mỗi dòng một câu ngắn, người dùng đọc để biết phải sửa gì
 * trong file Excel rồi import lại.
 */
const IMPORT_REASONS: Record<string, string> = {
  DUPLICATE_SKU: "Mã sản phẩm đã có trong hệ thống — bỏ qua dòng này",
  GROUP_NOT_FOUND: "Mã nhóm hàng không tồn tại",
  UOM_NOT_FOUND: "Mã đơn vị không tồn tại",
  SUPPLIER_NOT_FOUND: "Mã nhà cung cấp không tồn tại",
  PRODUCT_NOT_FOUND: "Mã sản phẩm chưa có trong hệ thống",
  DUPLICATE_VARIANT_CODE: "Mã biến thể trùng với sản phẩm khác",
  DUPLICATE_BARCODE: "Mã vạch trùng với hàng khác",
  INVALID_PAYLOAD: "Dữ liệu dòng không hợp lệ",
  PERMISSION_DENIED: "Không có quyền ghi vào bảng giá của cửa hàng này",
};

export function importReasonMessage(code: string | null | undefined): string {
  if (code === null || code === undefined || code === "") return "";
  return IMPORT_REASONS[code] ?? "Không ghi được dòng này";
}

/** Lỗi đăng nhập của Supabase Auth — message tiếng Anh, cố định theo mã. */
export function authErrorMessage(code: string | undefined, message: string): string {
  switch (code) {
    case "invalid_credentials":
      return "Email hoặc mật khẩu không đúng.";
    case "email_not_confirmed":
      return "Tài khoản chưa được xác nhận. Báo chủ cửa hàng.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Thử quá nhiều lần. Đợi một phút rồi thử lại.";
    case "user_banned":
      return "Tài khoản đã bị khoá. Báo chủ cửa hàng.";
    default:
      // Mất mạng là ca thường gặp nhất ở cửa hàng, và nó không có mã.
      return message.toLowerCase().includes("fetch")
        ? "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại."
        : "Không đăng nhập được. Thử lại, nếu vẫn lỗi thì báo chủ cửa hàng.";
  }
}
