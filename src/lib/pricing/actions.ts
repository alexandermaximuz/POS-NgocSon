"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/actions";
import { requireOwner } from "@/lib/auth/session";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { updatePriceFormSchema, updatePriceResultSchema } from "./schema";

/**
 * Sửa giá = THÊM DÒNG MỚI vào `price_list_items`, không update dòng cũ
 * (01-du-lieu.md §5). Toàn bộ việc đó nằm trong `rpc_update_price`; action này chỉ
 * kiểm dữ liệu vào và dịch lỗi ra.
 *
 * `store_id` không nhận từ client: RPC tự lấy từ chính bảng giá rồi kiểm
 * `fn_is_owner`. Client gửi lên cũng chỉ là lời khai.
 */

const INVALID = "Dữ liệu nhập chưa hợp lệ. Kiểm tra lại các ô đã nhập.";

export interface UpdatePriceOutcome {
  sku: string;
  /** `null` khi sản phẩm chưa từng có giá ở bảng này. */
  previousPrice: number | null;
  price: number;
  effectiveFrom: string;
}

export async function updatePrice(input: unknown): Promise<ActionResult<UpdatePriceOutcome>> {
  const parsed = updatePriceFormSchema.safeParse(input);
  if (!parsed.success) return actionError(INVALID);

  await requireOwner();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("rpc_update_price", {
    p_payload: {
      price_list_id: parsed.data.priceListId,
      product_id: parsed.data.productId,
      price_per_base_unit: parsed.data.price,
    },
  });

  if (error !== null) return actionError(rpcErrorMessage(error));

  const result = updatePriceResultSchema.parse(data);
  revalidatePath("/bang-gia");
  revalidatePath(`/san-pham/${result.product_id}`);

  return actionOk({
    sku: result.sku,
    previousPrice: result.previous_price,
    price: result.price_per_base_unit,
    effectiveFrom: result.effective_from,
  });
}
