"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/actions";
import { requireOwner } from "@/lib/auth/session";
import { rpcErrorMessage, writeErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { listItemGroups } from "./queries";
import {
  addBarcodeResultSchema,
  deleteItemGroupResultSchema,
  deleteProductResultSchema,
  itemGroupFormSchema,
  productFormSchema,
  saveProductResultSchema,
} from "./schema";

/**
 * Đường GHI của danh mục.
 *
 * Sản phẩm đi qua `rpc_save_product`: lưu một sản phẩm đụng 4 bảng, và hai
 * constraint trigger của 0003 là DEFERRABLE — chỉ RPC mới bắt được lỗi để dịch
 * (xem đầu 0016). Nhóm hàng thì ghi thẳng bảng: một bảng, RLS ở 0013 đã giới hạn
 * về owner. Riêng XOÁ nhóm vẫn qua RPC vì cần nói rõ vướng cái gì.
 *
 * Mọi action ở đây bắt đầu bằng `requireOwner()`. Đó là lớp chặn thứ nhất; lớp
 * thật vẫn là RLS và câu kiểm quyền ở dòng đầu mỗi RPC.
 */

const INVALID = "Dữ liệu nhập chưa hợp lệ. Kiểm tra lại các ô đã nhập.";

export interface SaveProductOutcome {
  productId: string;
  sku: string;
  name: string;
  created: boolean;
  variantCount: number;
  uomCount: number;
  barcodeCount: number;
}

export async function saveProduct(input: unknown): Promise<ActionResult<SaveProductOutcome>> {
  const parsed = productFormSchema.safeParse(input);
  if (!parsed.success) return actionError(INVALID);

  await requireOwner();
  const form = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("rpc_save_product", {
    p_payload: {
      id: form.id,
      sku: form.sku.toUpperCase(),
      name: form.name,
      item_group_id: form.itemGroupId,
      base_uom_id: form.baseUomId,
      brand: form.brand === "" ? null : form.brand,
      default_supplier_id: form.defaultSupplierId,
      safety_stock: form.safetyStock,
      status: form.status,
      description: form.description === "" ? null : form.description,
      uoms: form.uoms.map((u) => ({ uom_id: u.uomId, factor: u.factor })),
      variants: form.variants.map((v) => ({
        id: v.id,
        variant_code: v.variantCode.toUpperCase(),
        attr_color: v.attrColor === "" ? null : v.attrColor,
        is_default: v.isDefault,
        status: v.status,
      })),
      barcodes: form.barcodes.map((b) => ({
        variant_code: b.variantCode.toUpperCase(),
        barcode: b.barcode,
        source: b.source,
      })),
    },
  });

  if (error !== null) return actionError(rpcErrorMessage(error));

  const result = saveProductResultSchema.parse(data);
  revalidatePath("/san-pham");
  revalidatePath(`/san-pham/${result.product_id}`);

  return actionOk({
    productId: result.product_id,
    sku: result.sku,
    name: result.name,
    created: result.created,
    variantCount: result.variant_count,
    uomCount: result.uom_count,
    barcodeCount: result.barcode_count,
  });
}

export interface DeleteProductOutcome {
  sku: string;
  name: string;
}

export async function deleteProduct(productId: unknown): Promise<ActionResult<DeleteProductOutcome>> {
  if (typeof productId !== "string" || productId === "") return actionError(INVALID);

  await requireOwner();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("rpc_delete_product", {
    p_payload: { id: productId },
  });

  if (error !== null) return actionError(rpcErrorMessage(error));

  const result = deleteProductResultSchema.parse(data);
  revalidatePath("/san-pham");
  return actionOk({ sku: result.sku, name: result.name });
}

export interface AddBarcodeOutcome {
  barcode: string;
}

/**
 * Sinh mã nội bộ `NS########`. Số do database cấp, không do client đoán: hai lần
 * bấm nhanh phải ra hai mã khác nhau.
 */
export async function addInternalBarcode(
  variantId: unknown
): Promise<ActionResult<AddBarcodeOutcome>> {
  if (typeof variantId !== "string" || variantId === "") return actionError(INVALID);

  await requireOwner();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("rpc_add_internal_barcode", {
    p_payload: { variant_id: variantId },
  });

  if (error !== null) return actionError(rpcErrorMessage(error));

  const result = addBarcodeResultSchema.parse(data);
  revalidatePath("/san-pham");
  return actionOk({ barcode: result.barcode });
}

// ---------------------------------------------------------------------------
// Nhóm hàng
// ---------------------------------------------------------------------------

export interface SaveItemGroupOutcome {
  itemGroupId: string;
  name: string;
  created: boolean;
}

export async function saveItemGroup(input: unknown): Promise<ActionResult<SaveItemGroupOutcome>> {
  const parsed = itemGroupFormSchema.safeParse(input);
  if (!parsed.success) return actionError(INVALID);

  await requireOwner();
  const form = parsed.data;

  /*
   * Chống vòng lặp cây. `ck_item_groups_not_self_parent` (0003) chỉ chặn được
   * A → A; A → B → A thì lọt, và cây lặp làm màn nhóm hàng dựng cây vô tận.
   * Kiểm ở đây chấp nhận được vì chỉ owner sửa nhóm hàng và số nhóm đếm trên
   * đầu ngón tay — không có cuộc đua nào để thua.
   */
  if (form.id !== null && form.parentId !== null) {
    const groups = await listItemGroups();
    const byId = new Map(groups.map((g) => [g.id, g]));
    let cursor: string | null = form.parentId;
    const seen = new Set<string>();

    while (cursor !== null) {
      if (cursor === form.id) {
        return actionError(
          "Nhóm không thể nằm dưới chính nó hoặc dưới một nhóm con của nó."
        );
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);
      cursor = byId.get(cursor)?.parent_id ?? null;
    }
  }

  const supabase = await createClient();
  const values = {
    code: form.code.toUpperCase(),
    name: form.name,
    parent_id: form.parentId,
    sort_order: form.sortOrder,
  };

  if (form.id === null) {
    const { data, error } = await supabase
      .from("item_groups")
      .insert(values)
      .select("id, name")
      .single();

    if (error !== null) {
      return actionError(writeErrorMessage(error, `Mã nhóm ${values.code} đã có rồi.`));
    }
    revalidatePath("/nhom-hang");
    revalidatePath("/san-pham");
    return actionOk({ itemGroupId: data.id, name: data.name, created: true });
  }

  const { data, error } = await supabase
    .from("item_groups")
    .update(values)
    .eq("id", form.id)
    .select("id, name")
    .single();

  if (error !== null) {
    return actionError(writeErrorMessage(error, `Mã nhóm ${values.code} đã có rồi.`));
  }
  revalidatePath("/nhom-hang");
  revalidatePath("/san-pham");
  return actionOk({ itemGroupId: data.id, name: data.name, created: false });
}

export interface DeleteItemGroupOutcome {
  name: string;
}

export async function deleteItemGroup(
  groupId: unknown
): Promise<ActionResult<DeleteItemGroupOutcome>> {
  if (typeof groupId !== "string" || groupId === "") return actionError(INVALID);

  await requireOwner();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("rpc_delete_item_group", {
    p_payload: { id: groupId },
  });

  if (error !== null) return actionError(rpcErrorMessage(error));

  const result = deleteItemGroupResultSchema.parse(data);
  revalidatePath("/nhom-hang");
  revalidatePath("/san-pham");
  return actionOk({ name: result.name });
}
