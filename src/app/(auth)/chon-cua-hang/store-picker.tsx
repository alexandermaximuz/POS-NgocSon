"use client";

import { Store } from "lucide-react";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { selectStore } from "@/lib/auth/actions";
import type { Membership } from "@/lib/auth/session";

export function StorePicker({ memberships }: { memberships: Membership[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function choose(storeId: string): void {
    setError(null);
    setPendingId(storeId);
    startTransition(async () => {
      const result = await selectStore(storeId);
      if (!result.ok) {
        setError(result.message);
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-3">
      {error !== null && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {memberships.map((m) => (
        <Button
          key={m.storeId}
          variant="outline"
          size="pos"
          className="h-auto w-full justify-start gap-3 px-4 py-3"
          disabled={pendingId !== null}
          onClick={() => {
            choose(m.storeId);
          }}
        >
          <Store className="size-5 shrink-0 text-primary" aria-hidden />
          <span className="flex min-w-0 flex-col items-start">
            <span className="truncate font-medium">{m.storeName}</span>
            <span className="text-xs font-normal text-muted-foreground">
              {m.storeCode} · {m.role === "owner" ? "Chủ cửa hàng" : "Nhân viên"}
            </span>
          </span>
          {pendingId === m.storeId && (
            <span className="ml-auto text-xs text-muted-foreground">Đang vào…</span>
          )}
        </Button>
      ))}
    </div>
  );
}
