import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  /** Nói rõ bước tiếp theo là gì, không chỉ "chưa có dữ liệu". */
  hint: string;
  action?: ReactNode;
}

/**
 * Trạng thái rỗng bắt buộc của mọi màn hình có dữ liệu (05-giao-dien.md §"Bốn
 * trạng thái"). Không bao giờ hiện số minh hoạ thay cho dữ liệu thật.
 */
export function EmptyState({ title, hint, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{hint}</p>
      {action !== undefined && <div className="mt-3">{action}</div>}
    </div>
  );
}
