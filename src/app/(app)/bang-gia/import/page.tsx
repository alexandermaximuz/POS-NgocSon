import { ImportWizard } from "@/components/common/import-wizard";
import { PageHeader } from "@/components/common/page-header";
import { requireOwner } from "@/lib/auth/session";
import { previewPriceImport, runPriceImport } from "@/lib/catalog/import-actions";
import { orderedPriceColumns } from "@/lib/pricing/queries";

export default async function ImportBangGiaPage() {
  const session = await requireOwner();
  const columns = await orderedPriceColumns(session.memberships);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Import bảng giá từ Excel"
        description="Mỗi giá khác giá hiện tại sẽ tạo một dòng mới có ngày hiệu lực hôm nay. Giá cũ giữ nguyên trong lịch sử."
      />
      <ImportWizard
        templateHref="/bang-gia/import/mau"
        hint={`Cột giá theo đúng thứ tự: ${columns.map((c) => c.label).join(" · ")}. Ô để trống nghĩa là không đổi giá bảng đó. Mã sản phẩm chưa có trong hệ thống sẽ báo lỗi dòng — thêm sản phẩm trước rồi import giá sau.`}
        onPreview={previewPriceImport}
        onRun={runPriceImport}
        doneHref="/bang-gia"
        doneLabel="Về bảng giá"
      />
    </div>
  );
}
