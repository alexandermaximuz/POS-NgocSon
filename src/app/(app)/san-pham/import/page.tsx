import { ImportWizard } from "@/components/common/import-wizard";
import { PageHeader } from "@/components/common/page-header";
import { requireOwner } from "@/lib/auth/session";
import { previewProductImport, runProductImport } from "@/lib/catalog/import-actions";

export default async function ImportSanPhamPage() {
  await requireOwner();

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Import sản phẩm từ Excel"
        description="Một dòng là một sản phẩm. Mã đã có trong hệ thống sẽ bị bỏ qua, không ghi đè."
      />
      <ImportWizard
        templateHref="/san-pham/import/mau"
        hint="Tải file mẫu, điền theo đúng cột, rồi chọn lại file ở đây. Sheet Ma tham chieu trong file mẫu liệt kê sẵn mã nhóm hàng, mã đơn vị và mã nhà cung cấp đang dùng. Ô màu gộp nhiều màu bằng dấu | — ví dụ Xanh dương|Đỏ|Trắng. Mã vạch không nằm trong file, thêm sau ở màn chi tiết sản phẩm."
        onPreview={previewProductImport}
        onRun={runProductImport}
        doneHref="/san-pham"
        doneLabel="Về danh sách sản phẩm"
      />
    </div>
  );
}
