import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/db/types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Client Supabase cho Server Component, Server Action và Route Handler.
 *
 * Phải tạo mới ở mỗi request: client giữ tham chiếu tới cookie store của đúng
 * request đó, dùng lại giữa hai request là rò phiên của người này sang người kia.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Component không ghi được cookie. Không sao: middleware đã làm
          // mới token trước khi request tới đây rồi.
        }
      },
    },
  });
}
