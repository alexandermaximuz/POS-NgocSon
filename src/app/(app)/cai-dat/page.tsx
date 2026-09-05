import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOwner } from "@/lib/auth/session";
import { formatMoney, formatDateTime } from "@/lib/format";
import { getCurrentShift } from "@/lib/shift/queries";

/**
 * Cài đặt. Ở Phase 2 mới có khối ca làm việc — đây là chỗ thông báo lỗi
 * `SHIFT_NOT_OPEN` chỉ người dùng tới ("Vào Cài đặt → Mở ca", 05-giao-dien.md:67),
 * nên nó phải có thật ngay từ bây giờ.
 */
export default async function CaiDatPage() {
  const session = await requireOwner();
  const shift = await getCurrentShift(session.storeId);

  return (
    <>
      <PageHeader
        title="Cài đặt"
        description={`${session.store.storeName} · ${session.store.storeCode}`}
      />

      <Card className="max-w-xl">
        <CardHeader>
          <CardTitle className="text-base">Ca làm việc</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {shift.has_open_shift ? (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
                <dt className="text-muted-foreground">Người trực</dt>
                <dd className="font-medium">{shift.holder_name}</dd>
                <dt className="text-muted-foreground">Mở lúc</dt>
                <dd className="tabular-nums">{formatDateTime(shift.opened_at)}</dd>
                <dt className="text-muted-foreground">Tiền đầu ca</dt>
                <dd className="tabular-nums">{formatMoney(shift.opening_float)}</dd>
                <dt className="text-muted-foreground">Tiền két hiện tại</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(shift.expected_cash)}</dd>
              </dl>
              <Button asChild size="pos">
                <Link href="/ca/dong">Đóng ca</Link>
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Chưa có ca nào đang mở ở cửa hàng này. Phải mở ca mới bán hàng được.
              </p>
              <Button asChild size="pos">
                <Link href="/ca/mo">Mở ca</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </>
  );
}
