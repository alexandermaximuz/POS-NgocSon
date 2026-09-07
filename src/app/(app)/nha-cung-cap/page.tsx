import { EmptyState } from "@/components/common/empty-state";
import { ListFilters } from "@/components/common/list-filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { requireStore } from "@/lib/auth/session";
import { listSuppliers, suggestPartnerCode } from "@/lib/partners/queries";
import { SupplierManager } from "./supplier-manager";

/**
 * Nhà cung cấp — bảng dùng chung, chỉ `owner` được thêm/sửa/xoá.
 *
 * Không có ngoại lệ như `customers`: khách mới tới quầy là chuyện hằng ngày, còn
 * nhà cung cấp mới thì chủ cửa hàng tự nhập.
 */
export default async function NhaCungCapPage({ searchParams }: PageProps<"/nha-cung-cap">) {
  const session = await requireStore();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const page = Number.parseInt(typeof params.trang === "string" ? params.trang : "1", 10);

  const result = await listSuppliers({ q, page: Number.isFinite(page) ? page : 1 });
  const suggestedCode = await suggestPartnerCode("suppliers", "NCC");
  const canEdit = session.role === "owner";

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Nhà cung cấp"
        description="Dùng chung hai cửa hàng. Công nợ nhà cung cấp tính riêng từng cửa hàng, thuộc màn Nhập kho."
      />

      <ListFilters action="/nha-cung-cap" q={q} placeholder="Tên, mã hoặc số điện thoại" />

      <SupplierManager
        rows={result.rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          phone: row.phone,
          address: row.address,
          note: row.note,
          isActive: row.is_active,
        }))}
        canEdit={canEdit}
        suggestedCode={suggestedCode}
      />

      {result.rows.length === 0 && (
        <EmptyState
          title={q === "" ? "Chưa có nhà cung cấp nào" : "Không tìm thấy nhà cung cấp"}
          hint={
            q === ""
              ? "Thêm nhà cung cấp để gán làm NCC mặc định cho sản phẩm và lập phiếu nhập."
              : "Thử gõ ít chữ hơn, hoặc tìm bằng số điện thoại."
          }
        />
      )}

      <Pagination
        basePath="/nha-cung-cap"
        params={q === "" ? {} : { q }}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}
