"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/actions";
import { requireOwner, requireStore } from "@/lib/auth/session";
import { writeErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { customerFormSchema, supplierFormSchema } from "./schema";

/**
 * Khách hàng và nhà cung cấp ghi THẲNG vào bảng, không qua RPC: một bảng, không
 * ràng buộc hoãn, và policy ở 0013 đã diễn đạt đúng luật nghiệp vụ.
 *
 * Luật đó là: `staff` THÊM được khách mới (khách sỉ mới tới quầy) nhưng không sửa
 * và không xoá khách cũ; nhà cung cấp thì chỉ `owner`. Các hàm dưới đây gọi
 * `requireStore()` hay `requireOwner()` cho đúng từng trường hợp — nhưng lớp chặn
 * thật vẫn là RLS, chỗ này chỉ để người dùng nhận được câu tiếng Việt tử tế thay
 * vì một lỗi 42501.
 */

const INVALID = "Dữ liệu nhập chưa hợp lệ. Kiểm tra lại các ô đã nhập.";

export interface SavePartnerOutcome {
  id: string;
  name: string;
  created: boolean;
}

export async function saveCustomer(input: unknown): Promise<ActionResult<SavePartnerOutcome>> {
  const parsed = customerFormSchema.safeParse(input);
  if (!parsed.success) return actionError(INVALID);

  const form = parsed.data;
  // Thêm mới: staff làm được. Sửa: chỉ owner.
  if (form.id === null) {
    await requireStore();
  } else {
    await requireOwner();
  }

  const supabase = await createClient();
  const values = {
    code: form.code.toUpperCase(),
    name: form.name,
    phone: form.phone === "" ? null : form.phone,
    address: form.address === "" ? null : form.address,
    customer_group: form.customerGroup,
    note: form.note === "" ? null : form.note,
    is_active: form.isActive,
  };

  const query =
    form.id === null
      ? supabase.from("customers").insert(values).select("id, name").single()
      : supabase.from("customers").update(values).eq("id", form.id).select("id, name").single();

  const { data, error } = await query;
  if (error !== null) {
    return actionError(writeErrorMessage(error, `Mã khách ${values.code} đã có rồi.`));
  }

  revalidatePath("/khach-hang");
  return actionOk({ id: data.id, name: data.name, created: form.id === null });
}

export async function deleteCustomer(id: unknown): Promise<ActionResult<{ name: string }>> {
  if (typeof id !== "string" || id === "") return actionError(INVALID);

  await requireOwner();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .select("name")
    .single();

  if (error !== null) {
    return actionError(
      writeErrorMessage(
        error,
        "Không xoá được khách này."
      )
    );
  }

  revalidatePath("/khach-hang");
  return actionOk({ name: data.name });
}

export async function saveSupplier(input: unknown): Promise<ActionResult<SavePartnerOutcome>> {
  const parsed = supplierFormSchema.safeParse(input);
  if (!parsed.success) return actionError(INVALID);

  await requireOwner();
  const form = parsed.data;
  const supabase = await createClient();

  const values = {
    code: form.code.toUpperCase(),
    name: form.name,
    phone: form.phone === "" ? null : form.phone,
    address: form.address === "" ? null : form.address,
    note: form.note === "" ? null : form.note,
    is_active: form.isActive,
  };

  const query =
    form.id === null
      ? supabase.from("suppliers").insert(values).select("id, name").single()
      : supabase.from("suppliers").update(values).eq("id", form.id).select("id, name").single();

  const { data, error } = await query;
  if (error !== null) {
    return actionError(writeErrorMessage(error, `Mã nhà cung cấp ${values.code} đã có rồi.`));
  }

  revalidatePath("/nha-cung-cap");
  return actionOk({ id: data.id, name: data.name, created: form.id === null });
}

export async function deleteSupplier(id: unknown): Promise<ActionResult<{ name: string }>> {
  if (typeof id !== "string" || id === "") return actionError(INVALID);

  await requireOwner();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .delete()
    .eq("id", id)
    .select("name")
    .single();

  if (error !== null) {
    return actionError(writeErrorMessage(error, "Không xoá được nhà cung cấp này."));
  }

  revalidatePath("/nha-cung-cap");
  return actionOk({ name: data.name });
}
