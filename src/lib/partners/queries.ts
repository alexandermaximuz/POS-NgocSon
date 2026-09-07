import type { Tables } from "@/lib/db/types";
import { likePattern } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

/**
 * Khách hàng và nhà cung cấp: bảng dùng chung, mọi user đã đăng nhập đọc được
 * (0013). Tìm kiếm bỏ dấu chạy trên `name_normalized`, cùng cơ chế với sản phẩm.
 */

export const PARTNER_PAGE_SIZE = 20;

export interface PartnerFilter {
  q: string;
  page: number;
}

export interface PartnerPage<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type CustomerRow = Tables<"customers">;
export type SupplierRow = Tables<"suppliers">;

export async function listCustomers(filter: PartnerFilter): Promise<PartnerPage<CustomerRow>> {
  const supabase = await createClient();
  const page = Math.max(1, filter.page);
  const from = (page - 1) * PARTNER_PAGE_SIZE;

  let query = supabase.from("customers").select("*", { count: "exact" });

  const term = filter.q.trim();
  if (term !== "") {
    const pattern = likePattern(term);
    // Số điện thoại không bỏ dấu nên tìm thẳng trên cột gốc.
    query = query.or(
      `name_normalized.ilike.${pattern},code.ilike.${pattern},phone.ilike.${pattern}`
    );
  }

  const { data, error, count } = await query
    .order("name")
    .range(from, from + PARTNER_PAGE_SIZE - 1);

  if (error !== null) throw new Error(`Không đọc được danh sách khách hàng: ${error.message}`);

  return { rows: data, total: count ?? 0, page, pageSize: PARTNER_PAGE_SIZE };
}

export async function listSuppliers(filter: PartnerFilter): Promise<PartnerPage<SupplierRow>> {
  const supabase = await createClient();
  const page = Math.max(1, filter.page);
  const from = (page - 1) * PARTNER_PAGE_SIZE;

  let query = supabase.from("suppliers").select("*", { count: "exact" });

  const term = filter.q.trim();
  if (term !== "") {
    const pattern = likePattern(term);
    query = query.or(
      `name_normalized.ilike.${pattern},code.ilike.${pattern},phone.ilike.${pattern}`
    );
  }

  const { data, error, count } = await query
    .order("name")
    .range(from, from + PARTNER_PAGE_SIZE - 1);

  if (error !== null) throw new Error(`Không đọc được danh sách nhà cung cấp: ${error.message}`);

  return { rows: data, total: count ?? 0, page, pageSize: PARTNER_PAGE_SIZE };
}

/**
 * Mã gợi ý cho bản ghi mới: `KH09`, `NCC04`. Chỉ là GỢI Ý — người dùng sửa được,
 * và unique index mới là thứ quyết định. Hai người bấm "Thêm" cùng lúc sẽ nhận
 * cùng một gợi ý, người thứ hai bị báo trùng và đổi mã; với hai người dùng thì
 * đó là cái giá đúng để không phải dựng thêm một dãy số nữa.
 */
export async function suggestPartnerCode(
  table: "customers" | "suppliers",
  prefix: string
): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("code")
    .ilike("code", `${prefix}%`)
    .order("code", { ascending: false })
    .limit(1);

  if (error !== null || data.length === 0) return `${prefix}01`;

  const digits = data[0]?.code.slice(prefix.length).replace(/\D/g, "") ?? "";
  const next = digits === "" ? 1 : Number.parseInt(digits, 10) + 1;
  return `${prefix}${String(next).padStart(Math.max(2, digits.length), "0")}`;
}
