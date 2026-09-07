import { notFound } from "next/navigation";
import { PageHeader } from "@/components/common/page-header";
import { requireOwner } from "@/lib/auth/session";
import {
  getProductDetail,
  listItemGroups,
  listSupplierRefs,
  listUoms,
} from "@/lib/catalog/queries";
import type { ProductForm as ProductFormValues } from "@/lib/catalog/schema";
import { ProductForm } from "../../product-form";

export default async function SuaSanPhamPage({ params }: PageProps<"/san-pham/[id]/sua">) {
  await requireOwner();
  const { id } = await params;

  const [detail, groups, uoms, suppliers] = await Promise.all([
    getProductDetail(id),
    listItemGroups(),
    listUoms(),
    listSupplierRefs(),
  ]);

  if (detail === null) notFound();

  const codeById = new Map(detail.variants.map((v) => [v.id, v.variant_code]));

  const defaultValues: ProductFormValues = {
    id: detail.product.id,
    sku: detail.product.sku,
    name: detail.product.name,
    itemGroupId: detail.product.item_group_id,
    baseUomId: detail.product.base_uom_id,
    brand: detail.product.brand ?? "",
    defaultSupplierId: detail.product.default_supplier_id,
    safetyStock: Number(detail.product.safety_stock),
    status: detail.product.status,
    description: detail.product.description ?? "",
    // Dòng hệ số 1 là của đơn vị gốc, RPC tự ghi lại mỗi lần lưu — không đưa ra form.
    uoms: detail.uoms
      .filter((u) => u.uomId !== detail.product.base_uom_id)
      .map((u) => ({ uomId: u.uomId, factor: u.factor })),
    variants: detail.variants.map((v) => ({
      id: v.id,
      variantCode: v.variant_code,
      attrColor: v.attr_color ?? "",
      isDefault: v.is_default,
      status: v.status,
    })),
    barcodes: detail.barcodes.map((b) => ({
      variantCode: codeById.get(b.variant_id) ?? "",
      barcode: b.barcode,
      source: b.source,
    })),
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`Sửa ${detail.product.sku}`}
        description="Bỏ một biến thể đã có phát sinh kho sẽ bị từ chối — chuyển biến thể đó sang Ngừng bán."
      />
      <ProductForm
        groups={groups}
        uoms={uoms}
        suppliers={suppliers}
        defaultValues={defaultValues}
      />
    </div>
  );
}
