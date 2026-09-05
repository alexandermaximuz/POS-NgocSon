"use client";

import { Check, ChevronDown, Store } from "lucide-react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { selectStore } from "@/lib/auth/actions";
import type { Membership } from "@/lib/auth/session";

interface StoreSwitcherProps {
  memberships: Membership[];
  currentStoreId: string;
}

/**
 * Đổi cửa hàng đang chọn.
 *
 * Chỉ hiện khi người dùng thuộc nhiều hơn một cửa hàng — `staff` một cửa hàng thì
 * đây là nút không bấm được, chỉ tổ gây bối rối (AC: staff không có tuỳ chọn đổi
 * sang cửa hàng khác).
 */
export function StoreSwitcher({ memberships, currentStoreId }: StoreSwitcherProps) {
  const [pending, startTransition] = useTransition();
  const current = memberships.find((m) => m.storeId === currentStoreId);

  if (memberships.length < 2) {
    return (
      <span className="flex items-center gap-2 px-2 text-sm font-medium text-foreground">
        <Store className="size-4 text-muted-foreground" aria-hidden />
        {current?.storeName ?? "—"}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-9 gap-2 px-2" disabled={pending}>
          <Store className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-medium">{current?.storeName ?? "Chọn cửa hàng"}</span>
          <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {memberships.map((m) => (
          <DropdownMenuItem
            key={m.storeId}
            className="h-11 gap-2"
            onSelect={() => {
              if (m.storeId === currentStoreId) return;
              startTransition(async () => {
                // selectStore redirect khi thành công; nhánh lỗi duy nhất là mất
                // quyền vào cửa hàng đó, lúc đó tải lại trang là ra thông báo đúng.
                await selectStore(m.storeId);
              });
            }}
          >
            <Check
              className={m.storeId === currentStoreId ? "size-4" : "size-4 opacity-0"}
              aria-hidden
            />
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{m.storeName}</span>
              <span className="text-xs text-muted-foreground">{m.storeCode}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
