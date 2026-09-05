import Link from "next/link";
import { redirect } from "next/navigation";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireStore } from "@/lib/auth/session";
import { formatDateTime, formatMoney } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

/**
 * Kết quả đóng ca.
 *
 * Đọc lại từ `cash_shifts` chứ không nhận số qua query string: số tiền hiển thị sau
 * khi chốt sổ phải là số đã nằm trong database, không phải số client tự mang theo.
 * RLS lo phần "ca này có thuộc quyền xem của bạn không".
 */
export default async function KetQuaCaPage({ searchParams }: PageProps<"/ca/ket-qua">) {
  const session = await requireStore();
  // `staff` không vào được /cai-dat (requireOwner), nên mọi lối thoát ở trang này
  // phải rẽ theo vai trò — nếu không sẽ đá họ vào tường.
  const backHref = session.role === "owner" ? "/cai-dat" : "/ban-hang";
  const backLabel = session.role === "owner" ? "Về Cài đặt" : "Về Bán hàng";

  const params = await searchParams;
  const shiftId = typeof params.shift === "string" ? params.shift : null;
  if (shiftId === null) redirect(backHref);

  const supabase = await createClient();
  const { data: shift } = await supabase
    .from("cash_shifts")
    .select("opened_at, closed_at, opening_float, expected_cash, counted_cash, variance, note")
    .eq("id", shiftId)
    .maybeSingle();

  if (shift === null) {
    return (
      <div className="mx-auto max-w-md">
        <PageHeader title="Kết quả đóng ca" />
        <EmptyState
          title="Không tìm thấy ca này"
          hint="Ca đã bị xoá, hoặc bạn không có quyền xem ca của cửa hàng khác."
          action={
            <Button asChild size="pos">
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const variance = Number(shift.variance ?? 0);

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Đã đóng ca" description={`Đóng lúc ${formatDateTime(shift.closed_at)}`} />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Mở lúc</dt>
            <dd className="text-right tabular-nums">{formatDateTime(shift.opened_at)}</dd>
            <dt className="text-muted-foreground">Tiền đầu ca</dt>
            <dd className="text-right tabular-nums">{formatMoney(shift.opening_float)}</dd>
            <dt className="text-muted-foreground">Tiền mặt dự kiến</dt>
            <dd className="text-right tabular-nums">{formatMoney(shift.expected_cash)}</dd>
            <dt className="text-muted-foreground">Tiền thực đếm</dt>
            <dd className="text-right tabular-nums">{formatMoney(shift.counted_cash)}</dd>
            <dt className="font-medium">Chênh lệch</dt>
            <dd
              className={cn(
                "text-right font-semibold tabular-nums",
                variance === 0 ? "text-foreground" : "text-destructive"
              )}
            >
              {variance > 0 ? "+" : ""}
              {formatMoney(variance)}
            </dd>
          </dl>

          {shift.note !== null && shift.note !== "" && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              {shift.note}
            </p>
          )}

          <div className="flex gap-2">
            <Button asChild size="pos" className="flex-1">
              <Link href="/ca/mo">Mở ca mới</Link>
            </Button>
            <Button asChild variant="outline" size="pos" className="flex-1">
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
