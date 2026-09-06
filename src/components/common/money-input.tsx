"use client";

import { useId, type ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatMoney, parseMoney } from "@/lib/format";

interface MoneyInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Gợi ý dưới ô nhập — ví dụ số tiền hệ thống đang tính. */
  hint?: string;
  error?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * Ô nhập tiền: hiện `1.234.567`, KHÔNG có ký tự `đ` bên trong ô
 * (05-giao-dien.md §"Ngôn ngữ & định dạng").
 *
 * Giữ giá trị dưới dạng số ở state cha, chỉ định dạng lúc hiển thị. Lưu chuỗi đã
 * định dạng rồi parse ngược khi submit là chỗ dễ mất số nhất.
 *
 * `inputMode="numeric"` để máy cảm ứng bật bàn phím số, nhưng `type="text"` chứ
 * không phải `type="number"`: number không cho hiện dấu chấm ngăn nghìn, và con
 * lăn chuột vô tình lăn qua sẽ đổi số tiền.
 */
export function MoneyInput({
  label,
  value,
  onChange,
  hint,
  error,
  autoFocus,
  disabled,
}: MoneyInputProps) {
  const id = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(parseMoney(event.target.value));
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value === 0 ? "" : formatMoney(value)}
        onChange={handleChange}
        inputMode="numeric"
        autoComplete="off"
        placeholder="0"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-invalid={error !== undefined}
        aria-describedby={hint !== undefined || error !== undefined ? `${id}-hint` : undefined}
        className="h-11 text-right text-base tabular-nums"
      />
      {(error ?? hint) !== undefined && (
        <p
          id={`${id}-hint`}
          className={cn("text-xs", error !== undefined ? "text-destructive" : "text-muted-foreground")}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}
