import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/db/types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/** Route công khai — không cần đăng nhập. */
const PUBLIC_PATHS = ["/login"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Làm mới token Supabase và chặn người chưa đăng nhập.
 *
 * Middleware CHỈ làm hai việc đó. Không đọc `store_members`, không kiểm tra ca làm
 * việc: middleware chạy trên Edge cho mọi request, thêm một vòng truy vấn database
 * vào đây làm chậm toàn bộ ứng dụng. Việc chọn cửa hàng nằm ở `lib/auth/session.ts`,
 * việc chặn ca nằm ở layout của `/ban-hang` — cả hai đều là server, không bypass được.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser(), không phải getSession(): getSession chỉ giải mã cookie và tin nội
  // dung của nó. getUser() hỏi lại Auth server, nên cookie giả không qua được.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (user === null && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Giữ lại chỗ người dùng định vào để quay lại sau khi đăng nhập.
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user !== null && isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/ban-hang";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
