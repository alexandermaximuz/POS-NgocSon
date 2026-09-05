import type { ReactNode } from "react";
import { requireOwner } from "@/lib/auth/session";

/** Chặn ở tầng route, không chỉ ẩn menu (05-giao-dien.md:98). */
export default async function BangGiaLayout({ children }: { children: ReactNode }) {
  await requireOwner();
  return <>{children}</>;
}
