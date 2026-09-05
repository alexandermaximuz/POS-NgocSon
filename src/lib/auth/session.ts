import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Enums } from "@/lib/db/types";
import { createClient } from "@/lib/supabase/server";

/**
 * Phiên làm việc: người đang đăng nhập, các cửa hàng họ thuộc về, và cửa hàng
 * đang chọn.
 *
 * ĐÂY LÀ NƠI DUY NHẤT ĐƯỢC ĐỌC/GHI COOKIE `ns_store`. Không component, route hay
 * hook nào khác được đọc `document.cookie` hay tự truy vấn `store_members` để suy
 * ra cửa hàng đang chọn — có hai nguồn sự thật là có ngày chúng lệch nhau.
 *
 * Cookie KHÔNG BAO GIỜ được tin. Mỗi request đều đọc lại `store_members` và đối
 * chiếu; cookie trỏ tới cửa hàng không thuộc quyền thì bị bỏ qua như thể không có.
 * Lớp chốt chặn thật vẫn là RLS ở database, đây chỉ là lớp đầu.
 */

export const STORE_COOKIE = "ns_store";

export type StoreRole = Enums<"store_role">;

export interface Membership {
  storeId: string;
  storeCode: string;
  storeName: string;
  role: StoreRole;
}

export interface Session {
  userId: string;
  email: string;
  /** Đã coalesce — không bao giờ rỗng, kể cả khi profiles.full_name là NULL. */
  fullName: string;
  memberships: Membership[];
  /** `null` khi owner có nhiều cửa hàng mà chưa chọn cái nào. */
  storeId: string | null;
  store: Membership | null;
  /** Vai trò TẠI cửa hàng đang chọn. */
  role: StoreRole | null;
  /** Là owner ở ít nhất một cửa hàng. Dùng cho menu, không dùng cho phân quyền. */
  isOwner: boolean;
}

interface StoreRef {
  code: string;
  name: string;
}

/** PostgREST trả quan hệ nhiều-một khi là object, khi là mảng một phần tử. */
function oneStore(value: StoreRef | StoreRef[] | null): StoreRef | null {
  if (value === null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Bọc `cache()`: một request có thể gọi hàm này từ layout, topbar, sidebar và
 * page cùng lúc, nhưng chỉ truy vấn database đúng một lần.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) return null;

  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase
      .from("store_members")
      .select("store_id, role, stores(code, name)")
      .eq("user_id", user.id),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);

  const memberships: Membership[] = (rows ?? [])
    .flatMap((r) => {
      const store = oneStore(r.stores);
      if (store === null) return [];
      return [
        {
          storeId: r.store_id,
          storeCode: store.code,
          storeName: store.name,
          role: r.role,
        },
      ];
    })
    .sort((a, b) => a.storeCode.localeCompare(b.storeCode));

  const store = resolveStore(memberships, (await cookies()).get(STORE_COOKIE)?.value);

  return {
    userId: user.id,
    email: user.email ?? "",
    fullName: profile?.full_name ?? user.email ?? "Người dùng",
    memberships,
    storeId: store?.storeId ?? null,
    store,
    role: store?.role ?? null,
    isOwner: memberships.some((m) => m.role === "owner"),
  };
});

/**
 * Đúng một cửa hàng thì dùng luôn, bỏ qua cookie — `staff` không có gì để chọn,
 * bắt họ đi qua màn chọn cửa hàng là thêm một bước vô nghĩa mỗi lần đăng nhập.
 */
function resolveStore(memberships: Membership[], cookieValue?: string): Membership | null {
  if (memberships.length === 1) return memberships[0] ?? null;
  if (cookieValue === undefined) return null;
  return memberships.find((m) => m.storeId === cookieValue) ?? null;
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (session === null) redirect("/login");
  return session;
}

/** Phiên đã chọn xong cửa hàng. Kiểu trả về thu hẹp `storeId` về `string`. */
export interface StoreSession extends Session {
  storeId: string;
  store: Membership;
  role: StoreRole;
}

export async function requireStore(): Promise<StoreSession> {
  const session = await requireSession();

  if (session.memberships.length === 0) {
    // Có tài khoản nhưng chưa được gán cửa hàng nào. Không phải lỗi kỹ thuật —
    // chủ cửa hàng chưa phân quyền. Đá về /login sẽ thành vòng lặp vô tận.
    redirect("/khong-co-cua-hang");
  }
  if (session.store === null || session.storeId === null || session.role === null) {
    redirect("/chon-cua-hang");
  }

  return session as StoreSession;
}

/**
 * Chặn ở tầng route, không chỉ ẩn menu (05-giao-dien.md:98).
 *
 * Xét quyền TẠI cửa hàng đang chọn, không phải `isOwner`: hai thứ đó chỉ trùng
 * nhau khi mô hình dữ liệu còn đơn giản như bây giờ.
 */
export async function requireOwner(): Promise<StoreSession> {
  const session = await requireStore();
  if (session.role !== "owner") redirect("/ban-hang");
  return session;
}

/**
 * Ghi cửa hàng đang chọn. CHỈ gọi được từ Server Action hoặc Route Handler —
 * Server Component không ghi được cookie.
 */
export async function setStoreCookie(storeId: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(STORE_COOKIE, storeId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function clearStoreCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STORE_COOKIE);
}
