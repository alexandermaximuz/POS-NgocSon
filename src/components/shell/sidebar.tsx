"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import type { StoreRole } from "@/lib/auth/session";
import { cn } from "@/lib/utils";
import { visibleNavItems } from "./nav-items";

/**
 * Sidebar cố định 192px, nền teal đậm `--sidebar` (#033a3a).
 *
 * Ẩn mục vượt quyền, nhưng đó chỉ là phép lịch sự với người dùng — chốt chặn thật
 * nằm ở `requireOwner()` trong layout của từng route (05-giao-dien.md:98).
 */
export function Sidebar({ role }: { role: StoreRole }) {
  const pathname = usePathname();
  const items = visibleNavItems(role);

  return (
    <nav
      aria-label="Điều hướng chính"
      className="flex w-48 shrink-0 flex-col gap-0.5 overflow-y-auto bg-sidebar px-2 py-3"
    >
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href as Route}
            aria-current={active ? "page" : undefined}
            className={cn(
              // 44px: máy ở quầy có thể là màn cảm ứng.
              "flex h-11 items-center gap-2.5 rounded-md px-3 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
