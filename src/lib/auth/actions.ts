"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { clearStoreCookie, getSession, setStoreCookie } from "./session";

export type ActionResult = { ok: true } | { ok: false; message: string };

const loginSchema = z.object({
  email: z.email("Email không hợp lệ"),
  password: z.string().min(1, "Nhập mật khẩu"),
  next: z.string().optional(),
});

export async function signIn(input: unknown): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Email hoặc mật khẩu chưa hợp lệ." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error !== null) {
    return { ok: false, message: authErrorMessage(error.code, error.message) };
  }

  // Cookie cửa hàng của phiên trước không được sống sót qua lần đăng nhập mới:
  // người tiếp theo dùng chung máy sẽ vào thẳng cửa hàng của người trước.
  await clearStoreCookie();

  const session = await getSession();
  revalidatePath("/", "layout");

  // Một cửa hàng thì vào thẳng — staff không có gì để chọn.
  if (session !== null && session.memberships.length === 1) {
    redirect(safeNext(parsed.data.next));
  }
  redirect("/chon-cua-hang");
}

export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  await clearStoreCookie();
  revalidatePath("/", "layout");
  redirect("/login");
}

/**
 * Đổi cửa hàng đang chọn.
 *
 * Kết thúc bằng `redirect()` chứ không để client tự `router.refresh()`: refresh là
 * bất đồng bộ, sẽ có một khoảnh khắc giao diện còn hiện số liệu của cửa hàng cũ
 * dưới tên cửa hàng mới. Redirect thì trang tiếp theo dựng lại từ đầu.
 */
export async function selectStore(storeId: string): Promise<ActionResult> {
  const session = await getSession();
  if (session === null) redirect("/login");

  // Cookie do server ghi, nhưng giá trị đến từ client — vẫn phải đối chiếu.
  if (!session.memberships.some((m) => m.storeId === storeId)) {
    return { ok: false, message: "Bạn không có quyền vào cửa hàng này." };
  }

  await setStoreCookie(storeId);
  revalidatePath("/", "layout");
  redirect("/ban-hang");
}

function safeNext(next: string | undefined): string {
  if (next === undefined) return "/ban-hang";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/ban-hang";
}
