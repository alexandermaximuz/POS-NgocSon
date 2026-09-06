"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

interface CloseShiftConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expectedCash: number;
  countedCash: number;
  pending: boolean;
  onConfirm: () => void;
}

/**
 * Bước xác nhận trước khi đóng ca (05-giao-dien.md §"Xác nhận thao tác").
 *
 * Hộp thoại hiện đúng ba con số sẽ được ghi, không phải một câu "Bạn có chắc không?"
 * trống rỗng — câu hỏi trống rỗng bị bấm qua theo phản xạ sau ngày thứ hai và lúc đó
 * nó không còn bảo vệ ai. Ba con số thì buộc mắt phải dừng lại đọc.
 *
 * Nút huỷ đứng trước, và không tự động focus vào nút xác nhận: luồng đóng ca đi bằng
 * bàn phím, Enter theo phản xạ không được biến thành hành động không hoàn tác.
 */
export function CloseShiftConfirm({
  open,
  onOpenChange,
  expectedCash,
  countedCash,
  pending,
  onConfirm,
}: CloseShiftConfirmProps) {
  const variance = countedCash - expectedCash;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Đóng ca?</DialogTitle>
          <DialogDescription>Kiểm lại số tiền trước khi chốt sổ.</DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg bg-muted px-4 py-3 text-sm">
          <dt className="text-muted-foreground">Tiền mặt dự kiến</dt>
          <dd className="text-right tabular-nums">{formatMoney(expectedCash)}</dd>
          <dt className="text-muted-foreground">Tiền thực đếm</dt>
          <dd className="text-right tabular-nums">{formatMoney(countedCash)}</dd>
          <dt className="font-medium">Chênh lệch</dt>
          <dd
            className={cn(
              "text-right font-semibold tabular-nums",
              variance === 0 ? "text-foreground" : "text-destructive"
            )}
          >
            {variance > 0 ? "+" : ""}
            {formatMoney(variance)}
          </dd>
        </dl>

        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <span>
            Đóng ca xong <span className="font-medium text-foreground">không mở lại được</span>.
            Muốn bán tiếp thì phải mở ca mới.
          </span>
        </p>

        <DialogFooter>
          <Button
            variant="outline"
            size="pos"
            disabled={pending}
            onClick={() => {
              onOpenChange(false);
            }}
          >
            Huỷ
          </Button>
          <Button size="pos" disabled={pending} onClick={onConfirm}>
            {pending ? "Đang đóng ca…" : "Đóng ca"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
