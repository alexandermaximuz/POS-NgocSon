import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  getProductDetail,
  getProductPrices,
  listItemGroups,
  listPriceLists,
  listSupplierRefs,
  listUoms,
} from "@/lib/catalog/queries";
import { formatMoney, formatQty } from "@/lib/format";
import { DeleteProductButton } from "./delete-product-button";
import { VariantBarcodes } from "./variant-barcodes";

/**
 * Chi tiết sản phẩm. Đây là màn `staff` dùng để TRA GIÁ — `/bang-gia` chỉ owner
 * vào được (phase-3.md §3), nên khối "Giá theo đơn vị" bên dưới phải hiện đủ giá
 * lẻ và giá sỉ của cửa hàng đang chọn.
 *
 * Giá gắn ở SẢN PHẨM, không gắn ở biến thể, nên cột giá trong bảng biến thể lặp
 * lại cùng một con số cho mọi màu. Đó không phải lỗi hiển thị — đó chính là mô
 * hình dữ liệu, và là thứ acceptance criteria của Phase 3 đòi nhìn thấy.
 */
export default async function ChiTietSanPhamPage({ params }: PageProps<"/san-pham/[id]">) {
  const session = await requireStore();
  const { id } = await params;

  const detail = await getProductDetail(id);
  if (detail === null) notFound();

  const [groups, uoms, suppliers, priceLists, prices] = await Promise.all([
    listItemGroups(),
    listUoms(),
    listSupplierRefs(),
    listPriceLists(),
    getProductPrices(id),
  ]);

  const { product, variants, barcodes } = detail;
  const uomById = new Map(uoms.map((u) => [u.id, u]));
  const isOwner = session.role === "owner";

  // Đơn vị gốc trước, rồi tới đơn vị lớn theo hệ số tăng dần.
  const unitRows = [...detail.uoms].sort((a, b) => a.factor - b.factor);
  const storeLists = priceLists
    .filter((pl) => pl.store_id === session.storeId)
    .sort((a, b) => Number(a.kind === "wholesale") - Number(b.kind === "wholesale"));

  const retailList = storeLists.find((pl) => pl.kind === "retail");
  const retailBase = retailList === undefined ? undefined : prices.get(retailList.id);
  const biggest = unitRows[unitRows.length - 1];
  const biggestLabel =
    retailBase === undefined || biggest === undefined
      ? null
      : `${formatMoney(retailBase * biggest.factor)}/${uomById.get(biggest.uomId)?.name.toLowerCase() ?? ""}`;

  const barcodesByVariant = new Map<string, typeof barcodes>();
  for (const barcode of barcodes) {
    const list = barcodesByVariant.get(barcode.variant_id) ?? [];
    list.push(barcode);
    barcodesByVariant.set(barcode.variant_id, list);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <PageHeader
        title={`${product.sku} · ${product.name}`}
        description={[
          groups.find((g) => g.id === product.item_group_id)?.name,
          product.brand,
          product.status === "active" ? "Đang bán" : "Ngừng bán",
        ]
          .filter((v) => v !== null && v !== undefined && v !== "")
          .join(" · ")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="pos" asChild>
              <Link href="/san-pham">Về danh sách</Link>
            </Button>
            {isOwner && (
              <>
                <Button size="pos" asChild>
                  <Link href={`/san-pham/${product.id}/sua`}>Sửa</Link>
                </Button>
                <DeleteProductButton
                  productId={product.id}
                  sku={product.sku}
                  name={product.name}
                  variantCount={variants.length}
                />
              </>
            )}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Giá theo đơn vị · {session.store.storeName}</CardTitle>
        </CardHeader>
        <CardContent>
          {storeLists.length === 0 || unitRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Cửa hàng này chưa có bảng giá. Vào Bảng giá để đặt giá cho sản phẩm.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Bảng giá</TableHead>
                    {unitRows.map((unit) => (
                      <TableHead key={unit.uomId} className="text-right">
                        {uomById.get(unit.uomId)?.name ?? "?"}
                        {unit.factor !== 1 && (
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            ×{formatQty(unit.factor)}
                          </span>
                        )}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {storeLists.map((list) => {
                    const base = prices.get(list.id);
                    return (
                      <TableRow key={list.id}>
                        <TableCell className="font-medium">
                          {list.kind === "retail" ? "Giá lẻ" : "Giá sỉ"}
                        </TableCell>
                        {unitRows.map((unit) => (
                          <TableCell key={unit.uomId} className="text-right tabular-nums">
                            {base === undefined ? (
                              <span className="text-muted-foreground">chưa đặt</span>
                            ) : (
                              formatMoney(base * unit.factor)
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Giá gắn ở sản phẩm, mọi biến thể màu dùng chung một giá. Giá theo đơn vị lớn = giá
            đơn vị gốc × hệ số quy đổi.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Biến thể và mã vạch</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Mã biến thể</TableHead>
                  <TableHead className="w-32">Màu</TableHead>
                  <TableHead className="w-24">Mặc định</TableHead>
                  {biggestLabel !== null && <TableHead className="w-40 text-right">Giá lẻ</TableHead>}
                  <TableHead>Mã vạch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {variants.map((variant) => (
                  <TableRow key={variant.id}>
                    <TableCell className="font-medium">
                      {variant.variant_code}
                      {variant.status === "inactive" && (
                        <span className="ml-2 pill pill--slate">Ngừng bán</span>
                      )}
                    </TableCell>
                    <TableCell>{variant.attr_color ?? "—"}</TableCell>
                    <TableCell>
                      {variant.is_default ? <span className="pill pill--teal">Mặc định</span> : ""}
                    </TableCell>
                    {biggestLabel !== null && (
                      <TableCell className="text-right tabular-nums">{biggestLabel}</TableCell>
                    )}
                    <TableCell>
                      <VariantBarcodes
                        variantId={variant.id}
                        barcodes={(barcodesByVariant.get(variant.id) ?? []).map((b) => ({
                          id: b.id,
                          barcode: b.barcode,
                          source: b.source,
                        }))}
                        canEdit={isOwner}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin khác</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Đơn vị gốc</dt>
            <dd>{uomById.get(product.base_uom_id)?.name ?? "—"}</dd>
            <dt className="text-muted-foreground">Nhà cung cấp mặc định</dt>
            <dd>
              {suppliers.find((s) => s.id === product.default_supplier_id)?.name ?? "Chưa chọn"}
            </dd>
            <dt className="text-muted-foreground">Tồn tối thiểu</dt>
            <dd className="tabular-nums">{formatQty(product.safety_stock)}</dd>
            {product.description !== null && product.description !== "" && (
              <>
                <dt className="text-muted-foreground">Mô tả</dt>
                <dd className="whitespace-pre-line">{product.description}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
