"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/common/money-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { closeShift } from "@/lib/shift/actions";
import { cn } from "@/lib/utils";
import { CloseShiftConfirm } from "./close-shift-confirm";

/**
 * `expectedCash` do server tính (`fn_shift_expected_cash`) và chỉ dùng để HIỂN THỊ
 * chênh lệch tại chỗ. Lúc submit, server tính lại từ đầu — con số client cầm có thể
 * đã cũ nếu vừa có phiếu chi từ máy khác.
 */
export function CloseShiftForm({ expectedCash }: { expectedCash: number }) {
  const router = useRouter();
  const [countedCash, setCountedCash] = useState(0);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const variance = countedCash - expectedCash;

  function confirm(): void {
    setError(null);
    startTransition(async () => {
      const result = await closeShift({ countedCash, note: note.trim() || undefined });
      if (!result.ok) {
        setConfirming(false);
        setError(result.message);
        return;
      }

      const { variance: posted, heldOrders, redirectTo } = result.data;
      toast.success("Đã đóng ca", {
        description:
          posted === 0
            ? `Khớp sổ, không lệch. Tiền két ${formatMoney(result.data.countedCash)}`
            : `Lệch ${posted > 0 ? "+" : ""}${formatMoney(posted)} so với dự kiến`,
      });
      // Đơn treo không chặn đóng ca, nhưng người dùng cần biết chúng còn đó.
      if (heldOrders > 0) {
        toast.warning(`Còn ${String(heldOrders)} đơn treo chưa thanh toán`);
      }
      router.push(redirectTo);
    });
  }

  return (
    <>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          // Không đóng ca thẳng từ đây: đây là hành động không hoàn tác được nên
          // phải đi qua bước xác nhận có hiện số (05-giao-dien.md).
          setError(null);
          setConfirming(true);
        }}
      >
        {error !== null && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-baseline justify-between rounded-lg bg-muted px-4 py-3">
          <span className="text-sm text-muted-foreground">Tiền mặt dự kiến</span>
          <span className="text-lg font-semibold tabular-nums">{formatMoney(expectedCash)}</span>
        </div>

        <div
          onBlur={() => {
            setTouched(true);
          }}
        >
          <MoneyInput
            label="Tiền thực đếm"
            value={countedCash}
            onChange={setCountedCash}
            autoFocus
            disabled={pending}
          />
        </div>

        {/* Chênh lệch hiện ngay khi gõ, không đợi submit — người đếm cần biết để đếm lại. */}
        <div className="flex items-baseline justify-between rounded-lg border border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">Chênh lệch</span>
          <span
            className={cn(
              "text-lg font-semibold tabular-nums",
              variance === 0 ? "text-foreground" : "text-destructive"
            )}
          >
            {variance > 0 ? "+" : ""}
            {formatMoney(variance)}
          </span>
        </div>

        {variance !== 0 && touched && (
          <p className="text-xs text-muted-foreground">
            Lệch không chặn đóng ca — hệ thống chỉ ghi nhận lại. Nên nhập lý do bên dưới.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="close-note">Ghi chú {variance === 0 && "(không bắt buộc)"}</Label>
          <Input
            id="close-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Lý do lệch, bàn giao ca…"
            maxLength={500}
            disabled={pending}
            className="h-11 text-base"
          />
        </div>

        <Button type="submit" size="pos" className="w-full" disabled={pending}>
          Đóng ca
        </Button>
      </form>

      <CloseShiftConfirm
        open={confirming}
        onOpenChange={setConfirming}
        expectedCash={expectedCash}
        countedCash={countedCash}
        pending={pending}
        onConfirm={confirm}
      />
    </>
  );
}
