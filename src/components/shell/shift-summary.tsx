import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney, formatTime } from "@/lib/format";
import type { CurrentShift } from "@/lib/shift/schema";
import { CashTxnDialog } from "./cash-txn-dialog";

/**
 * Khối ca làm việc trên topbar: ca đang mở, người trực, tiền két hiện tại
 * (phase-2.md:40).
 *
 * `expected_cash` tính ở server bởi `fn_shift_expected_cash`. Không cộng trừ lại ở
 * đây — hai công thức song song là hai công thức sẽ lệch nhau.
 */
export function ShiftSummary({ shift }: { shift: CurrentShift }) {
  if (!shift.has_open_shift) {
    return (
      <div className="flex items-center gap-2">
        <span className="pill pill--orange">Chưa mở ca</span>
        <Button asChild variant="outline" size="sm" className="h-8">
          <Link href="/ca/mo">Mở ca</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex flex-col leading-tight">
        <span className="text-xs text-muted-foreground">
          Ca {formatTime(shift.opened_at)} · {shift.holder_name}
          {!shift.is_mine && " (không phải ca của bạn)"}
        </span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          Két: {formatMoney(shift.expected_cash)}
        </span>
      </div>

      {shift.is_mine && (
        <div className="flex items-center gap-1.5">
          <CashTxnDialog type="in" />
          <CashTxnDialog type="out" />
        </div>
      )}

      <Button asChild variant="outline" size="sm" className="h-8">
        <Link href="/ca/dong">Đóng ca</Link>
      </Button>
    </div>
  );
}
