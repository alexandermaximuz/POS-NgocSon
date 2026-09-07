import { requireOwner } from "@/lib/auth/session";
import { listItemGroups, listSupplierRefs, listUoms } from "@/lib/catalog/queries";
import { buildProductTemplate } from "@/lib/catalog/excel";

/**
 * Tải file mẫu import sản phẩm.
 *
 * Sinh ở server rồi trả về, không dựng sẵn một file tĩnh trong repo: file mẫu kèm
 * sheet liệt kê mã nhóm hàng, mã đơn vị và mã nhà cung cấp ĐANG CÓ. File tĩnh sẽ
 * cũ đi ngay lần đầu chủ cửa hàng thêm một nhóm mới, và người điền không có cách
 * nào biết.
 */
export async function GET(): Promise<Response> {
  await requireOwner();

  const [groups, uoms, suppliers] = await Promise.all([
    listItemGroups(),
    listUoms(),
    listSupplierRefs(),
  ]);

  const bytes = await buildProductTemplate({
    groups: groups.map((g) => ({ code: g.code, name: g.name })),
    uoms: uoms.map((u) => ({ code: u.code, name: u.name })),
    suppliers: suppliers.map((s) => ({ code: s.code, name: s.name })),
  });

  return new Response(bytes as BodyInit, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="mau-san-pham.xlsx"',
      "cache-control": "no-store",
    },
  });
}
