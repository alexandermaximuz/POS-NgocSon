import { redirect } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireStore } from "@/lib/auth/session";
import { formatDateTime, formatMoney } from "@/lib/format";
import { getCurrentShift } from "@/lib/shift/queries";
import { CloseShiftForm } from "./close-shift-form";

export default async function DongCaPage() {
  const session = await requireStore();
  const shift = await getCurrentShift(session.storeId);

  // Không có ca thì không có gì để đóng. Đưa tới bước tiếp theo người dùng thực sự
  // cần, thay vì hiện màn trống. `staff` không vào được /cai-dat (requireOwner), nên
  // đá họ về đó là đá vào tường.
  if (!shift.has_open_shift) redirect(session.role === "owner" ? "/cai-dat" : "/ca/mo");

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Đóng ca"
        description={`${session.store.storeName} · ${shift.holder_name} · mở lúc ${formatDateTime(shift.opened_at)}`}
      />
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-muted-foreground">
            Tiền đầu ca {formatMoney(shift.opening_float)}. Đếm tiền thật trong két rồi nhập
            vào ô bên dưới.
          </p>
          <CloseShiftForm expectedCash={shift.expected_cash} />
        </CardContent>
      </Card>
    </div>
  );
}
