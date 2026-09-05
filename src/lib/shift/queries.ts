import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { currentShiftSchema, type CurrentShift } from "./schema";

/**
 * Ca đang mở của MỘT CỬA HÀNG (không phải của người đang đăng nhập).
 *
 * Một nguồn số duy nhất cho cả topbar ("tiền két hiện tại") lẫn màn đóng ca
 * ("tiền mặt dự kiến"). Hai chỗ đó không được tự cộng trừ lại, nếu không sẽ có
 * ngày lệch nhau mà không ai biết bên nào đúng.
 */
export const getCurrentShift = cache(async (storeId: string): Promise<CurrentShift> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_current_shift", {
    p_payload: { store_id: storeId },
  });

  // Không nuốt lỗi thành "chưa có ca": giao diện sẽ hiện nút Mở ca, người dùng bấm
  // và nhận lỗi thứ hai khó hiểu hơn.
  if (error !== null) {
    throw new Error(`rpc_current_shift thất bại: ${error.message}`);
  }
  return currentShiftSchema.parse(data);
});

/**
 * Cửa chặn của khu bán hàng. Đặt ở layout chứ không ở middleware: middleware chạy
 * trên Edge cho mọi request, thêm một vòng truy vấn database vào đó làm chậm toàn
 * bộ ứng dụng. Layout vẫn là server — không bypass được bằng DevTools.
 *
 * `next` giữ lại chỗ người dùng định vào, để mở ca xong quay lại đúng đó thay vì
 * luôn về trang mặc định.
 */
export async function requireOpenShift(storeId: string, next: string): Promise<string> {
  const state = await getCurrentShift(storeId);
  if (!state.has_open_shift) {
    redirect(`/ca/mo?next=${encodeURIComponent(next)}`);
  }
  return state.shift_id;
}
