"use client";

import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/common/money-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { openShift } from "@/lib/shift/actions";

export function OpenShiftForm({ next }: { next: string }) {
  const [openingFloat, setOpeningFloat] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(): void {
    setError(null);
    startTransition(async () => {
      // openShift redirect khi thành công, nên chỉ nhánh lỗi quay về đây.
      const result = await openShift({ openingFloat }, next);
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

      <MoneyInput
        label="Tiền đầu ca"
        value={openingFloat}
        onChange={setOpeningFloat}
        hint="Tiền mặt có sẵn trong két lúc bắt đầu ca. Để 0 nếu két rỗng."
        autoFocus
        disabled={pending}
      />

      <Button type="submit" size="pos" className="w-full" disabled={pending}>
        {pending ? "Đang mở ca…" : "Mở ca"}
      </Button>
    </form>
  );
}
