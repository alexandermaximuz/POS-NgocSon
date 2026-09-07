import { EmptyState } from "@/components/common/empty-state";
import { ListFilters } from "@/components/common/list-filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { requireStore } from "@/lib/auth/session";
import { listCustomers, suggestPartnerCode } from "@/lib/partners/queries";
import { CustomerManager } from "./customer-manager";

/**
 * Khách hàng — bảng dùng chung cho cả hai cửa hàng.
 *
 * `staff` THÊM được khách mới (khách sỉ mới tới quầy) nhưng không sửa, không xoá
 * khách cũ. Đó là ngoại lệ có chủ đích của 02-phan-quyen.md §4.2, và RLS ở 0013
 * là nơi thi hành nó.
 *
 * Công nợ KHÔNG hiển thị ở đây: nó là số riêng của từng cửa hàng, tính động từ
 * orders + receipt_allocations, và thuộc màn Công nợ ở Phase 7.
 */
export default async function KhachHangPage({ searchParams }: PageProps<"/khach-hang">) {
  const session = await requireStore();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const page = Number.parseInt(typeof params.trang === "string" ? params.trang : "1", 10);

  const result = await listCustomers({ q, page: Number.isFinite(page) ? page : 1 });
  const suggestedCode = await suggestPartnerCode("customers", "KH");

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Khách hàng"
        description="Dùng chung hai cửa hàng. Công nợ tính riêng từng cửa hàng, xem ở màn Công nợ."
      />

      <ListFilters
        action="/khach-hang"
        q={q}
        placeholder="Tên, mã hoặc số điện thoại"
      />

      <CustomerManager
        rows={result.rows.map((row) => ({
          id: row.id,
          code: row.code,
          name: row.name,
          phone: row.phone,
          address: row.address,
          customerGroup: row.customer_group,
          note: row.note,
          isActive: row.is_active,
        }))}
        canEdit={session.role === "owner"}
        suggestedCode={suggestedCode}
      />

      {result.rows.length === 0 && (
        <EmptyState
          title={q === "" ? "Chưa có khách hàng nào" : "Không tìm thấy khách hàng"}
          hint={
            q === ""
              ? "Thêm khách sỉ đầu tiên. Khách lẻ mua tại quầy không cần tạo hồ sơ."
              : "Thử gõ ít chữ hơn, hoặc tìm bằng số điện thoại."
          }
        />
      )}

      <Pagination
        basePath="/khach-hang"
        params={q === "" ? {} : { q }}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}
