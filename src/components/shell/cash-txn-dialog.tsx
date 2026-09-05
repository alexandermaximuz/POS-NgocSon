"use client";

import { Minus, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/common/money-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCashTxn } from "@/lib/shift/actions";
import type { Enums } from "@/lib/db/types";

type CashTxnType = Enums<"cash_txn_type">;

/**
 * Phiếu thu/chi tiền mặt ngoài bán hàng (phase-2.md:33).
 *
 * `clientUuid` sinh MỘT LẦN mỗi lần mở hộp thoại và giữ nguyên qua mọi lần bấm
 * lại: bấm đúp hoặc mạng chập chờn không được tạo hai phiếu. Đóng hộp thoại rồi mở
 * lại là một ý định mới, nên sinh uuid mới.
 */
export function CashTxnDialog({ type }: { type: CashTxnType }) {
  const [open, setOpen] = useState(false);
  const [clientUuid, setClientUuid] = useState<string>("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isIn = type === "in";
  const title = isIn ? "Thu khác" : "Chi khác";

  /**
   * Đặt lại ngay trong handler mở/đóng, không dùng useEffect: mở hộp thoại là một
   * sự kiện của người dùng, không phải trạng thái cần đồng bộ với hệ thống bên ngoài.
   */
  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);
    if (nextOpen) {
      setClientUuid(crypto.randomUUID());
      setAmount(0);
      setReason("");
      setError(null);
    }
  }

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await createCashTxn({ type, amount, reason }, clientUuid);
      if (result.ok) setOpen(false);
      else setError(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          {isIn ? <Plus className="size-3.5" aria-hidden /> : <Minus className="size-3.5" aria-hidden />}
          {title}
        </Button>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-sm"
        onKeyDown={(e) => {
          // Enter ở ô lý do là submit — luồng này phải làm được bằng bàn phím.
          if (e.key === "Enter" && !pending) {
            e.preventDefault();
            submit();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isIn
              ? "Tiền mặt vào két không phải từ bán hàng."
              : "Tiền mặt ra khỏi két không phải từ trả hàng."}
          </DialogDescription>
        </DialogHeader>

        {error !== null && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <MoneyInput label="Số tiền" value={amount} onChange={setAmount} autoFocus disabled={pending} />
          <div className="space-y-1.5">
            <Label htmlFor="cash-txn-reason">Lý do</Label>
            <Input
              id="cash-txn-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isIn ? "Chủ bù thêm tiền lẻ" : "Mua nước, trả tiền xe"}
              maxLength={200}
              disabled={pending}
              className="h-11 text-base"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="pos"
            onClick={() => {
              setOpen(false);
            }}
            disabled={pending}
          >
            Huỷ
          </Button>
          <Button size="pos" onClick={submit} disabled={pending || amount <= 0 || reason.trim() === ""}>
            {pending ? "Đang lưu…" : "Lưu phiếu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
