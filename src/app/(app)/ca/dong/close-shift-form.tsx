"use client";

import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/common/money-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney } from "@/lib/format";
import { closeShift } from "@/lib/shift/actions";
import { cn } from "@/lib/utils";

/**
 * `expectedCash` do server tính (`fn_shift_expected_cash`) và chỉ dùng để HIỂN THỊ
 * chênh lệch tại chỗ. Lúc submit, server tính lại từ đầu — con số client cầm có thể
 * đã cũ nếu vừa có phiếu chi từ máy khác.
 */
export function CloseShiftForm({ expectedCash }: { expectedCash: number }) {
  const [countedCash, setCountedCash] = useState(0);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const variance = countedCash - expectedCash;

  function submit(): void {
    setError(null);
    startTransition(async () => {
      const result = await closeShift({ countedCash, note: note.trim() || undefined });
      if (!result.ok) setError(result.message);
    });
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
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
        {pending ? "Đang đóng ca…" : "Xác nhận đóng ca"}
      </Button>
    </form>
  );
}
