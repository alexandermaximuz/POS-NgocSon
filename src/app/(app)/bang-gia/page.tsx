import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { ListFilters } from "@/components/common/list-filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import { requireOwner } from "@/lib/auth/session";
import { listItemGroups, listProducts, listUoms } from "@/lib/catalog/queries";
import { getPriceMatrix, orderedPriceColumns, priceKey } from "@/lib/pricing/queries";
import { PriceGrid } from "./price-grid";

/**
 * Lưới bảng giá: `Sản phẩm │ Lẻ CH1 │ Sỉ CH1 │ Lẻ CH2 │ Sỉ CH2`.
 *
 * Chỉ owner vào được — `layout.tsx` của segment này gọi `requireOwner()` từ
 * Phase 2, và RLS chỉ cho ghi `price_list_items` của đúng cửa hàng mình sở hữu.
 * `staff` tra giá ở màn chi tiết sản phẩm (phase-3.md §3).
 */
export default async function BangGiaPage({ searchParams }: PageProps<"/bang-gia">) {
  const session = await requireOwner();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const groupId = typeof params.nhom === "string" && params.nhom !== "" ? params.nhom : null;
  const page = Number.parseInt(typeof params.trang === "string" ? params.trang : "1", 10);

  const [groups, uoms, columns] = await Promise.all([
    listItemGroups(),
    listUoms(),
    orderedPriceColumns(session.memberships),
  ]);

  const result = await listProducts(
    { q, groupId, status: null, page: Number.isFinite(page) ? page : 1 },
    null
  );

  const matrix = await getPriceMatrix(
    columns.map((c) => c.id),
    result.rows.map((r) => r.id)
  );

  const uomCodes = new Map(uoms.map((u) => [u.id, u.code]));

  const queryParams: Record<string, string> = {};
  if (q !== "") queryParams.q = q;
  if (groupId !== null) queryParams.nhom = groupId;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Bảng giá"
        description="Sửa giá tạo dòng mới có ngày hiệu lực, không ghi đè giá cũ. Lịch sử giá giữ nguyên."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="pos" asChild>
              <Link href="/bang-gia/import">Import Excel</Link>
            </Button>
          </div>
        }
      />

      <ListFilters
        action="/bang-gia"
        q={q}
        placeholder="Tìm theo tên hoặc mã, gõ không dấu cũng được"
        fields={[
          {
            name: "nhom",
            label: "Nhóm hàng",
            value: groupId ?? "",
            options: [
              { value: "", label: "Tất cả nhóm" },
              ...groups.map((g) => ({ value: g.id, label: g.name })),
            ],
          },
        ]}
      />

      {columns.length === 0 ? (
        <EmptyState
          title="Chưa có bảng giá nào"
          hint="Mỗi cửa hàng cần một bảng giá lẻ và một bảng giá sỉ. Báo người dựng hệ thống tạo giúp."
        />
      ) : result.rows.length === 0 ? (
        <EmptyState
          title="Không tìm thấy sản phẩm"
          hint={
            q === "" && groupId === null
              ? "Thêm sản phẩm ở màn Sản phẩm trước, rồi quay lại đây đặt giá."
              : "Thử bỏ bớt bộ lọc, hoặc gõ ít chữ hơn."
          }
          action={
            q === "" && groupId === null ? (
              <Button size="pos" asChild>
                <Link href="/san-pham/moi">Thêm sản phẩm</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <PriceGrid
          columns={columns}
          rows={result.rows.map((row) => ({
            id: row.id,
            sku: row.sku,
            name: row.name,
            baseUomCode: uomCodes.get(row.baseUomId) ?? "",
            prices: columns.map((c) => matrix.get(priceKey(c.id, row.id)) ?? null),
          }))}
        />
      )}

      <Pagination
        basePath="/bang-gia"
        params={queryParams}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}
