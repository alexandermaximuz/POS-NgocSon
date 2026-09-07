import { cache } from "react";
import type { Enums, Tables } from "@/lib/db/types";
import { likePattern } from "@/lib/search";
import { createClient } from "@/lib/supabase/server";

/**
 * Đường ĐỌC của danh mục. Đọc thẳng bảng qua PostgREST, không qua RPC: RLS ở 0013
 * đã cho mọi user đã đăng nhập `select` trên bảng danh mục dùng chung, và bảng giá
 * thì lọc theo `fn_my_store_ids()`. RPC chỉ dành cho đường GHI.
 *
 * Danh mục nền (nhóm hàng, đơn vị, nhà cung cấp) chỉ vài chục dòng và gần như
 * không đổi trong một request, nên nạp cả bảng rồi ghép ở TS. Cách này tránh hẳn
 * cú pháp nhúng quan hệ của PostgREST — thứ im lặng trả về `null` khi tên khoá
 * ngoại đoán sai, chứ không báo lỗi.
 */

export type ItemGroup = Pick<Tables<"item_groups">, "id" | "code" | "name" | "parent_id" | "sort_order">;
export type Uom = Pick<Tables<"uoms">, "id" | "code" | "name">;
export type SupplierRef = Pick<Tables<"suppliers">, "id" | "code" | "name">;
export type PriceListRef = Pick<Tables<"price_lists">, "id" | "store_id" | "name" | "kind">;

export const listItemGroups = cache(async (): Promise<ItemGroup[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("item_groups")
    .select("id, code, name, parent_id, sort_order")
    .order("sort_order")
    .order("name");

  if (error !== null) throw new Error(`Không đọc được nhóm hàng: ${error.message}`);
  return data;
});

export const listUoms = cache(async (): Promise<Uom[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("uoms").select("id, code, name").order("code");

  if (error !== null) throw new Error(`Không đọc được đơn vị tính: ${error.message}`);
  return data;
});

export const listSupplierRefs = cache(async (): Promise<SupplierRef[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, code, name")
    .eq("is_active", true)
    .order("name");

  if (error !== null) throw new Error(`Không đọc được nhà cung cấp: ${error.message}`);
  return data;
});

/** Bảng giá RLS cho phép user thấy: đúng các cửa hàng họ thuộc về. */
export const listPriceLists = cache(async (): Promise<PriceListRef[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("price_lists")
    .select("id, store_id, name, kind")
    .order("kind");

  if (error !== null) throw new Error(`Không đọc được bảng giá: ${error.message}`);
  return data;
});

// ---------------------------------------------------------------------------
// Danh sách sản phẩm — phân trang ở server
// ---------------------------------------------------------------------------

export const PRODUCT_PAGE_SIZE = 20;

export interface ProductFilter {
  q: string;
  groupId: string | null;
  status: Enums<"entity_status"> | null;
  page: number;
}

export interface ProductListRow {
  id: string;
  sku: string;
  name: string;
  status: Enums<"entity_status">;
  itemGroupId: string;
  baseUomId: string;
  brand: string | null;
  variantCount: number;
  /** Giá lẻ đang hiệu lực của CỬA HÀNG ĐANG CHỌN. `null` khi chưa đặt giá. */
  retailPrice: number | null;
}

export interface ProductListResult {
  rows: ProductListRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listProducts(
  filter: ProductFilter,
  retailPriceListId: string | null
): Promise<ProductListResult> {
  const supabase = await createClient();
  const page = Math.max(1, filter.page);
  const from = (page - 1) * PRODUCT_PAGE_SIZE;

  let query = supabase
    .from("products")
    .select("id, sku, name, status, item_group_id, base_uom_id, brand", { count: "exact" });

  const term = filter.q.trim();
  if (term !== "") {
    // name_normalized là cột generated đã bỏ dấu (0003), khớp với likePattern.
    const pattern = likePattern(term);
    query = query.or(`name_normalized.ilike.${pattern},sku.ilike.${pattern}`);
  }
  if (filter.groupId !== null) query = query.eq("item_group_id", filter.groupId);
  if (filter.status !== null) query = query.eq("status", filter.status);

  const { data, error, count } = await query
    .order("sku")
    .range(from, from + PRODUCT_PAGE_SIZE - 1);

  if (error !== null) throw new Error(`Không đọc được danh sách sản phẩm: ${error.message}`);

  const ids = data.map((p) => p.id);
  const [variantCounts, prices] = await Promise.all([
    countVariants(ids),
    retailPriceListId === null
      ? Promise.resolve(new Map<string, number>())
      : currentPrices(retailPriceListId, ids),
  ]);

  return {
    rows: data.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      status: p.status,
      itemGroupId: p.item_group_id,
      baseUomId: p.base_uom_id,
      brand: p.brand,
      variantCount: variantCounts.get(p.id) ?? 0,
      retailPrice: prices.get(p.id) ?? null,
    })),
    total: count ?? 0,
    page,
    pageSize: PRODUCT_PAGE_SIZE,
  };
}

async function countVariants(productIds: string[]): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("product_id")
    .in("product_id", productIds);

  if (error !== null) throw new Error(`Không đếm được biến thể: ${error.message}`);

  const counts = new Map<string, number>();
  for (const row of data) {
    counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
  }
  return counts;
}

/**
 * Giá đang hiệu lực, đọc từ `v_current_prices` (0004) chứ không tự viết lại phép
 * `distinct on`. Hai chỗ tính "giá mới nhất" theo hai cách là hai chỗ sẽ lệch nhau.
 */
async function currentPrices(
  priceListId: string,
  productIds: string[]
): Promise<Map<string, number>> {
  if (productIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_current_prices")
    .select("product_id, price_per_base_unit")
    .eq("price_list_id", priceListId)
    .in("product_id", productIds);

  if (error !== null) throw new Error(`Không đọc được bảng giá: ${error.message}`);

  const prices = new Map<string, number>();
  for (const row of data) {
    if (row.product_id !== null && row.price_per_base_unit !== null) {
      prices.set(row.product_id, Number(row.price_per_base_unit));
    }
  }
  return prices;
}

// ---------------------------------------------------------------------------
// Chi tiết một sản phẩm
// ---------------------------------------------------------------------------

export interface ProductDetail {
  product: Tables<"products">;
  uoms: { uomId: string; factor: number }[];
  variants: Tables<"product_variants">[];
  barcodes: Tables<"product_barcodes">[];
}

export async function getProductDetail(productId: string): Promise<ProductDetail | null> {
  const supabase = await createClient();

  const { data: product, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (error !== null) throw new Error(`Không đọc được sản phẩm: ${error.message}`);
  if (product === null) return null;

  const [uomRes, variantRes] = await Promise.all([
    supabase.from("product_uoms").select("uom_id, factor").eq("product_id", productId),
    supabase
      .from("product_variants")
      .select("*")
      .eq("product_id", productId)
      .order("is_default", { ascending: false })
      .order("variant_code"),
  ]);

  if (uomRes.error !== null) throw new Error(`Không đọc được đơn vị: ${uomRes.error.message}`);
  if (variantRes.error !== null) throw new Error(`Không đọc được biến thể: ${variantRes.error.message}`);

  const variantIds = variantRes.data.map((v) => v.id);
  let barcodes: Tables<"product_barcodes">[] = [];

  if (variantIds.length > 0) {
    const { data, error: barcodeError } = await supabase
      .from("product_barcodes")
      .select("*")
      .in("variant_id", variantIds)
      .order("barcode");

    if (barcodeError !== null) throw new Error(`Không đọc được mã vạch: ${barcodeError.message}`);
    barcodes = data;
  }

  return {
    product,
    uoms: uomRes.data.map((u) => ({ uomId: u.uom_id, factor: Number(u.factor) })),
    variants: variantRes.data,
    barcodes,
  };
}

/** Giá đang hiệu lực của một sản phẩm ở mọi bảng giá user được phép thấy. */
export async function getProductPrices(productId: string): Promise<Map<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("v_current_prices")
    .select("price_list_id, price_per_base_unit")
    .eq("product_id", productId);

  if (error !== null) throw new Error(`Không đọc được giá: ${error.message}`);

  const prices = new Map<string, number>();
  for (const row of data) {
    if (row.price_list_id !== null && row.price_per_base_unit !== null) {
      prices.set(row.price_list_id, Number(row.price_per_base_unit));
    }
  }
  return prices;
}

/** Tra biến thể theo mã vạch — dùng ở màn chi tiết để kiểm chứng mã vừa thêm. */
export async function findVariantByBarcode(
  barcode: string
): Promise<{ variantId: string; variantCode: string; productId: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_barcodes")
    .select("variant_id, product_variants(id, variant_code, product_id)")
    .eq("barcode", barcode.trim())
    .maybeSingle();

  if (error !== null) throw new Error(`Không tra được mã vạch: ${error.message}`);
  if (data === null) return null;

  const variant = Array.isArray(data.product_variants)
    ? data.product_variants[0]
    : data.product_variants;
  if (variant === null || variant === undefined) return null;

  return {
    variantId: variant.id,
    variantCode: variant.variant_code,
    productId: variant.product_id,
  };
}
