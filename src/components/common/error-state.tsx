"use client";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  /** Đã dịch sang tiếng Việt. Không bao giờ truyền message thô của Postgres vào đây. */
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "Không tải được dữ liệu", message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      {onRetry !== undefined && (
        <Button variant="outline" size="pos" className="mt-3" onClick={onRetry}>
          Thử lại
        </Button>
      )}
    </div>
  );
}
