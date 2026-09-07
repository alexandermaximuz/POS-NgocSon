import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ImportPreview, PreviewRow } from "./import-schema";

/**
 * Tra cứu phục vụ preview import.
 *
 * Tra theo LÔ 500 mã: `in` với vài nghìn phần tử làm URL của PostgREST dài quá
 * giới hạn và request bị từ chối với một lỗi không liên quan gì tới nội dung file.
 */
const LOOKUP_BATCH = 500;

export async function existingSkus(skus: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  const supabase = await createClient();
  const unique = [...new Set(skus.filter((s) => s !== ""))];

  for (let i = 0; i < unique.length; i += LOOKUP_BATCH) {
    const { data, error } = await supabase
      .from("products")
      .select("sku")
      .in("sku", unique.slice(i, i + LOOKUP_BATCH));

    if (error !== null) throw new Error(`Không kiểm tra được mã sản phẩm: ${error.message}`);
    for (const row of data) found.add(row.sku);
  }
  return found;
}

/** Map `sku → product_id` cho các mã xuất hiện trong file. */
export async function productsBySku(skus: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const supabase = await createClient();
  const unique = [...new Set(skus.filter((s) => s !== ""))];

  for (let i = 0; i < unique.length; i += LOOKUP_BATCH) {
    const { data, error } = await supabase
      .from("products")
      .select("id, sku")
      .in("sku", unique.slice(i, i + LOOKUP_BATCH));

    if (error !== null) throw new Error(`Không đọc được sản phẩm: ${error.message}`);
    for (const row of data) map.set(row.sku, row.id);
  }
  return map;
}

export function summarize<T>(rows: PreviewRow[], payload: T[]): ImportPreview<T> {
  return {
    rows,
    payload,
    ok: rows.filter((r) => r.level === "ok").length,
    warning: rows.filter((r) => r.level === "warning").length,
    error: rows.filter((r) => r.level === "error").length,
  };
}
