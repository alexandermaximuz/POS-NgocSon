import { requireOwner } from "@/lib/auth/session";
import { buildPriceTemplate } from "@/lib/catalog/excel";
import { orderedPriceColumns } from "@/lib/pricing/queries";
import { createClient } from "@/lib/supabase/server";

/**
 * Tải file mẫu import bảng giá.
 *
 * Cột giá sinh theo `orderedPriceColumns` — cùng hàm mà lúc đọc file dùng để hiểu
 * cột thứ n là bảng giá nào. Một nguồn thứ tự duy nhất, nếu không giá sỉ CH1 có
 * ngày chui vào cột giá lẻ CH2 mà không có gì báo.
 */
export async function GET(): Promise<Response> {
  const session = await requireOwner();
  const columns = await orderedPriceColumns(session.memberships);

  // Một dòng ví dụ lấy từ dữ liệu thật để người điền thấy đúng dạng mã.
  const supabase = await createClient();
  const { data } = await supabase.from("products").select("sku, name").order("sku").limit(1);
  const sample = data?.[0] ?? null;

  const bytes = await buildPriceTemplate(
    columns.map((c) => ({ label: c.label })),
    sample === undefined || sample === null ? null : { sku: sample.sku, name: sample.name }
  );

  return new Response(bytes as BodyInit, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="mau-bang-gia.xlsx"',
      "cache-control": "no-store",
    },
  });
}
