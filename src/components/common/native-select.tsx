import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * `<select>` thuần, style theo token của dự án.
 *
 * Dùng thay cho Select của shadcn ở form và thanh lọc: người bán thao tác bằng bàn
 * phím, và select gốc của trình duyệt gõ chữ cái đầu là nhảy tới đúng dòng —
 * combobox dựng bằng div thì phải viết lại từng phím một, và thường viết thiếu.
 * Danh mục ở đây chỉ vài chục dòng nên không cần ô tìm trong dropdown.
 */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-11 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  );
}
