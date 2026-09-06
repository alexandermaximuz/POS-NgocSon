import { redirect } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requireStore } from "@/lib/auth/session";
import { getCurrentShift } from "@/lib/shift/queries";
import { OpenShiftForm } from "./open-shift-form";

export default async function MoCaPage({ searchParams }: PageProps<"/ca/mo">) {
  const session = await requireStore();
  const shift = await getCurrentShift(session.storeId);

  const params = await searchParams;
  const raw = typeof params.next === "string" ? params.next : "/ban-hang";
  // `next` đến từ query string, tức là từ người dùng — chỉ nhận đường dẫn nội bộ.
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/ban-hang";

  // Đã có ca rồi thì không có gì để làm ở đây. Đi thẳng tới chỗ người dùng định vào.
  if (shift.has_open_shift) redirect(next);

  return (
    <div className="mx-auto max-w-md">
      <PageHeader
        title="Mở ca"
        description={`${session.store.storeName} · ${session.fullName}`}
      />
      <Card>
        <CardContent className="pt-6">
          <OpenShiftForm next={next} />
        </CardContent>
      </Card>
    </div>
  );
}
