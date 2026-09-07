import Link from "next/link";
import { EmptyState } from "@/components/common/empty-state";
import { ListFilters } from "@/components/common/list-filters";
import { PageHeader } from "@/components/common/page-header";
import { Pagination } from "@/components/common/pagination";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireStore } from "@/lib/auth/session";
import {
  listItemGroups,
  listPriceLists,
  listProducts,
  listUoms,
  type ProductFilter,
} from "@/lib/catalog/queries";
import { formatMoney } from "@/lib/format";

/**
 * Danh sách sản phẩm. Phân trang và lọc chạy Ở SERVER: hơn 2.000 mã, tải hết về
 * rồi lọc bằng JavaScript là cách chắc chắn làm máy ở quầy giật.
 *
 * `staff` xem được toàn bộ màn này (danh mục dùng chung), chỉ không thấy nút sửa.
 */
export default async function SanPhamPage({ searchParams }: PageProps<"/san-pham">) {
  const session = await requireStore();
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q : "";
  const groupId = typeof params.nhom === "string" && params.nhom !== "" ? params.nhom : null;
  const statusParam = typeof params.trang_thai === "string" ? params.trang_thai : "";
  const status = statusParam === "active" || statusParam === "inactive" ? statusParam : null;
  const page = Number.parseInt(typeof params.trang === "string" ? params.trang : "1", 10);

  const filter: ProductFilter = {
    q,
    groupId,
    status,
    page: Number.isFinite(page) ? page : 1,
  };

  const [groups, uoms, priceLists] = await Promise.all([
    listItemGroups(),
    listUoms(),
    listPriceLists(),
  ]);

  const retailList = priceLists.find(
    (pl) => pl.store_id === session.storeId && pl.kind === "retail"
  );
  const result = await listProducts(filter, retailList?.id ?? null);

  const groupNames = new Map(groups.map((g) => [g.id, g.name]));
  const uomCodes = new Map(uoms.map((u) => [u.id, u.code]));
  const isOwner = session.role === "owner";

  const queryParams: Record<string, string> = {};
  if (q !== "") queryParams.q = q;
  if (groupId !== null) queryParams.nhom = groupId;
  if (status !== null) queryParams.trang_thai = status;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Sản phẩm"
        description={`Danh mục dùng chung cho cả hai cửa hàng · giá hiển thị của ${session.store.storeName}`}
        action={
          isOwner ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="pos" asChild>
                <Link href="/nhom-hang">Nhóm hàng</Link>
              </Button>
              <Button variant="outline" size="pos" asChild>
                <Link href="/san-pham/import">Import Excel</Link>
              </Button>
              <Button size="pos" asChild>
                <Link href="/san-pham/moi">Thêm sản phẩm</Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      <ListFilters
        action="/san-pham"
        q={q}
        placeholder="Gõ không dấu cũng ra: thau duy thanh"
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
          {
            name: "trang_thai",
            label: "Trạng thái",
            value: status ?? "",
            options: [
              { value: "", label: "Tất cả" },
              { value: "active", label: "Đang bán" },
              { value: "inactive", label: "Ngừng bán" },
            ],
          },
        ]}
      />

      {result.rows.length === 0 ? (
        <EmptyState
          title={q === "" && groupId === null ? "Chưa có sản phẩm nào" : "Không tìm thấy sản phẩm"}
          hint={
            q === "" && groupId === null
              ? "Thêm sản phẩm đầu tiên, hoặc import bảng giá Excel sẵn có."
              : "Thử bỏ bớt bộ lọc, hoặc gõ ít chữ hơn."
          }
          action={
            isOwner && q === "" ? (
              <Button size="pos" asChild>
                <Link href="/san-pham/moi">Thêm sản phẩm</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Mã</TableHead>
                <TableHead>Tên hàng</TableHead>
                <TableHead className="w-40">Nhóm</TableHead>
                <TableHead className="w-20">ĐVT</TableHead>
                <TableHead className="w-24 text-right">Biến thể</TableHead>
                <TableHead className="w-32 text-right">Giá lẻ</TableHead>
                <TableHead className="w-28">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    <Link href={`/san-pham/${row.id}`} className="hover:underline">
                      {row.sku}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/san-pham/${row.id}`} className="hover:underline">
                      {row.name}
                    </Link>
                    {row.brand !== null && row.brand !== "" && (
                      <span className="ml-2 text-xs text-muted-foreground">{row.brand}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {groupNames.get(row.itemGroupId) ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {uomCodes.get(row.baseUomId) ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{row.variantCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.retailPrice === null ? (
                      <span className="text-muted-foreground">chưa đặt</span>
                    ) : (
                      formatMoney(row.retailPrice)
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={row.status === "active" ? "pill pill--green" : "pill pill--slate"}>
                      {row.status === "active" ? "Đang bán" : "Ngừng bán"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        basePath="/san-pham"
        params={queryParams}
        page={result.page}
        pageSize={result.pageSize}
        total={result.total}
      />
    </div>
  );
}
