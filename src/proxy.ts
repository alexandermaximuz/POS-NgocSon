import type { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next 16 đổi tên quy ước `middleware.ts` thành `proxy.ts`; tên cũ vẫn chạy nhưng
 * đã deprecated. Nội dung không đổi — vẫn là Edge middleware.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Mọi đường dẫn trừ tài nguyên tĩnh và ảnh. Bỏ qua chúng không chỉ để nhanh:
     * mỗi lần chạy proxy là một lần gọi Auth server để xác thực token.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
