"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Thông báo xác nhận sau khi ghi chứng từ (05-giao-dien.md §"Xác nhận thao tác").
 *
 * Khác bản mẫu của shadcn ở hai điểm:
 *
 * - Bỏ `next-themes`. Ứng dụng chạy trên màn hình cố định ở quầy và chỉ có light
 *   theme (globals.css), nên kéo cả một thư viện theme vào chỉ để đọc ra "light"
 *   là thừa.
 * - `bottom-center`, chữ to hơn mặc định. Người bán đứng cách màn hình một sải tay
 *   và đang nhìn vào giữa màn hình, không nhìn góc phải. Không đặt `top-center` vì
 *   nó che đúng ô tiền két trên topbar — thứ người dùng muốn đối chiếu ngay sau khi
 *   ghi phiếu.
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      richColors
      duration={4000}
      className="toaster group"
      toastOptions={{ classNames: { toast: "text-sm", title: "font-medium" } }}
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}
