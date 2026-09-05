/**
 * Khung cho màn đăng nhập và chọn cửa hàng: nền teal đậm của thương hiệu, nội
 * dung là một thẻ trắng ở giữa. Không có sidebar/topbar — lúc này chưa biết người
 * dùng là ai hoặc chưa biết họ đứng ở cửa hàng nào.
 */
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-sidebar px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-xl font-semibold text-sidebar-foreground">POS Ngọc Sơn</p>
          <p className="mt-1 text-sm text-sidebar-foreground/70">Hệ thống bán hàng</p>
        </div>
        {children}
      </div>
    </div>
  );
}
