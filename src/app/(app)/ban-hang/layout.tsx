import type { ReactNode } from "react";
import { requireStore } from "@/lib/auth/session";
import { requireOpenShift } from "@/lib/shift/queries";

/**
 * Cửa chặn duy nhất của khu bán hàng (phase-2.md:29).
 *
 * Đặt ở layout của segment nên MỌI route con (`/ban-hang/...` thêm ở phase sau) tự
 * động nằm sau cửa này — không có đường vòng nào vào được khi chưa mở ca.
 *
 * Không đặt ở middleware: middleware chạy trên Edge cho mọi request, thêm một vòng
 * truy vấn database vào đó làm chậm toàn bộ ứng dụng. Layout vẫn là server, người
 * dùng không bỏ qua được bằng DevTools.
 */
export default async function BanHangLayout({ children }: { children: ReactNode }) {
  const session = await requireStore();
  await requireOpenShift(session.storeId, "/ban-hang");
  return <>{children}</>;
}
