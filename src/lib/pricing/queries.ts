import type { Membership } from "@/lib/auth/session";
import { listPriceLists } from "@/lib/catalog/queries";
import { createClient } from "@/lib/supabase/server";

/** Một cột của lưới bảng giá: `Ngọc Sơn 1 – Giá lẻ`. */
export interface PriceColumn {
  id: string;
  storeId: string;
  storeCode: string;
  kind: "retail" | "wholesale";
  label: string;
}

/**
 * Thứ tự cột của lưới bảng giá VÀ của file Excel import, quyết định ở đúng một
 * chỗ này.
 *
 * File mẫu sinh theo thứ tự này, và lúc đọc file cột thứ n được hiểu là bảng giá
 * thứ n. Hai nơi tự sắp xếp riêng là có ngày giá sỉ CH1 chui vào cột giá lẻ CH2 —
 * sai lặng lẽ, không có gì báo.
 */
export async function orderedPriceColumns(memberships: Membership[]): Promise<PriceColumn[]> {
  const lists = await listPriceLists();
  const stores = new Map(memberships.map((m) => [m.storeId, m]));

  return lists
    .flatMap((list) => {
      const store = stores.get(list.store_id);
      if (store === undefined) return [];
      return [
        {
          id: list.id,
          storeId: list.store_id,
          storeCode: store.storeCode,
          kind: list.kind,
          label: `${store.storeCode} – Giá ${list.kind === "retail" ? "lẻ" : "sỉ"}`,
        },
      ];
    })
    .sort((a, b) =>
      a.storeCode === b.storeCode
        ? Number(a.kind === "wholesale") - Number(b.kind === "wholesale")
        : a.storeCode.localeCompare(b.storeCode)
    );
}

/**
 * Giá đang hiệu lực của nhiều sản phẩm × nhiều bảng giá, cho lưới bảng giá.
 *
 * Khoá của Map là `${priceListId}:${productId}` — lưới tra theo cặp đó, và ghép
 * chuỗi ở một chỗ duy nhất tránh được cảnh mỗi component tự nghĩ ra một khoá.
 */
export function priceKey(priceListId: string, productId: string): string {
  return `${priceListId}:${productId}`;
}

export async function getPriceMatrix(
  priceListIds: string[],
  productIds: string[]
): Promise<Map<string, number>> {
  if (priceListIds.length === 0 || productIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_current_prices")
    .select("price_list_id, product_id, price_per_base_unit")
    .in("price_list_id", priceListIds)
    .in("product_id", productIds);

  if (error !== null) throw new Error(`Không đọc được bảng giá: ${error.message}`);

  const matrix = new Map<string, number>();
  for (const row of data) {
    if (row.price_list_id === null || row.product_id === null) continue;
    if (row.price_per_base_unit === null) continue;
    matrix.set(priceKey(row.price_list_id, row.product_id), Number(row.price_per_base_unit));
  }
  return matrix;
}

export interface PriceHistoryRow {
  id: string;
  priceListId: string;
  price: number;
  effectiveFrom: string;
  createdAt: string;
}

/**
 * Lịch sử giá của một sản phẩm. `price_list_items` là append-only nên đây chính
 * là lý do bảng đó tồn tại — không có màn này thì không ai kiểm chứng được rằng
 * sửa giá không ghi đè lịch sử.
 */
export async function getPriceHistory(
  productId: string,
  limit = 20
): Promise<PriceHistoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_list_items")
    .select("id, price_list_id, price_per_base_unit, effective_from, created_at")
    .eq("product_id", productId)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error !== null) throw new Error(`Không đọc được lịch sử giá: ${error.message}`);

  return data.map((row) => ({
    id: row.id,
    priceListId: row.price_list_id,
    price: Number(row.price_per_base_unit),
    effectiveFrom: row.effective_from,
    createdAt: row.created_at,
  }));
}
