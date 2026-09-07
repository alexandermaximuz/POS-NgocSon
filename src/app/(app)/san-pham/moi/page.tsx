import { PageHeader } from "@/components/common/page-header";
import { requireOwner } from "@/lib/auth/session";
import { listItemGroups, listSupplierRefs, listUoms } from "@/lib/catalog/queries";
import type { ProductForm as ProductFormValues } from "@/lib/catalog/schema";
import { ProductForm } from "../product-form";

/**
 * Thêm sản phẩm. `requireOwner()` ở đây là cửa chặn tầng route — sửa danh mục là
 * quyền của owner (02-phan-quyen.md §1), và RLS ở database là lớp chặn thật.
 */
export default async function ThemSanPhamPage() {
  await requireOwner();

  const [groups, uoms, suppliers] = await Promise.all([
    listItemGroups(),
    listUoms(),
    listSupplierRefs(),
  ]);

  const defaultValues: ProductFormValues = {
    id: null,
    sku: "",
    name: "",
    itemGroupId: "",
    baseUomId: "",
    brand: "",
    defaultSupplierId: null,
    safetyStock: 0,
    status: "active",
    description: "",
    uoms: [],
    variants: [],
    barcodes: [],
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Thêm sản phẩm"
        description="Kích thước là sản phẩm riêng, màu là biến thể. Giá đặt ở màn Bảng giá sau khi lưu."
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
