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
};

const FALLBACK = "Không thực hiện được. Thử lại, nếu vẫn lỗi thì báo chủ cửa hàng.";

/**
 * `detail` của SHIFT_ALREADY_OPEN chứa tên người đang giữ ca — thông tin duy nhất
 * giúp người dùng biết phải đi tìm ai.
 */
export function rpcErrorMessage(error: PostgrestError | null): string {
  if (error === null) return FALLBACK;

  const code = error.message.trim();
  const base = MESSAGES[code];
  if (base === undefined) return FALLBACK;

  if (code === "SHIFT_ALREADY_OPEN" && typeof error.details === "string" && error.details !== "") {
    return `Ca của ${error.details} đang mở. Đóng ca đó trước khi mở ca mới.`;
  }
  return base;
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
