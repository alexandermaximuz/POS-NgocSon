import { PageHeader } from "@/components/common/page-header";
import { listItemGroups } from "@/lib/catalog/queries";
import { createClient } from "@/lib/supabase/server";
import { ItemGroupManager } from "./item-group-manager";

/**
 * Nhóm hàng: cây phân cấp, chỉ owner.
 *
 * Số sản phẩm mỗi nhóm đọc ở đây chứ không ở client: người dùng cần biết nhóm nào
 * còn hàng TRƯỚC khi bấm xoá, thay vì bấm rồi mới nhận lỗi `GROUP_IN_USE`.
 */
export default async function NhomHangPage() {
  const groups = await listItemGroups();

  const supabase = await createClient();
  const { data: products, error } = await supabase.from("products").select("item_group_id");
  if (error !== null) throw new Error(`Không đếm được sản phẩm theo nhóm: ${error.message}`);

  const counts: Record<string, number> = {};
  for (const row of products) {
    counts[row.item_group_id] = (counts[row.item_group_id] ?? 0) + 1;
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nhóm hàng"
        description="Dùng chung cho cả hai cửa hàng. Không xoá được nhóm còn sản phẩm hoặc còn nhóm con."
      />
      <ItemGroupManager groups={groups} productCounts={counts} />
    </div>
  );
}
