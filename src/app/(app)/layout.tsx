import type { ReactNode } from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { requireStore } from "@/lib/auth/session";
import { getCurrentShift } from "@/lib/shift/queries";

/**
 * Khung ứng dụng. Mọi màn hình nghiệp vụ nằm dưới đây, nên cũng chỉ có đúng một
 * chỗ đảm bảo "đã đăng nhập VÀ đã chọn cửa hàng".
 *
 * Bố cục `h-screen` + vùng nội dung tự cuộn: sidebar và topbar phải đứng yên khi
 * cuộn danh sách hàng dài. Tối ưu 1366×768.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireStore();
  const shift = await getCurrentShift(session.storeId);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar role={session.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar session={session} shift={shift} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4">{children}</main>
      </div>
    </div>
  );
}
