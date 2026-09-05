import type { StoreSession } from "@/lib/auth/session";
import type { CurrentShift } from "@/lib/shift/schema";
import { ShiftSummary } from "./shift-summary";
import { StoreSwitcher } from "./store-switcher";
import { SyncBadge } from "./sync-badge";
import { UserMenu } from "./user-menu";

interface TopbarProps {
  session: StoreSession;
  shift: CurrentShift;
}

export function Topbar({ session, shift }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-3">
      <StoreSwitcher memberships={session.memberships} currentStoreId={session.storeId} />

      <div className="ml-auto flex items-center gap-3">
        <ShiftSummary shift={shift} />
        <SyncBadge />
        <UserMenu
          fullName={session.fullName}
          email={session.email}
          roleLabel={session.role === "owner" ? "Chủ cửa hàng" : "Nhân viên"}
        />
      </div>
    </header>
  );
}
