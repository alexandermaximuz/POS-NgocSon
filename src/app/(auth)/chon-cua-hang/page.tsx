import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { StorePicker } from "./store-picker";

/**
 * Chỉ `owner` (thuộc 2 cửa hàng) tới được đây. `staff` có đúng một cửa hàng nên
 * `getSession` suy ra luôn và trang này tự đá họ vào bán hàng.
 */
export default async function ChonCuaHangPage() {
  const session = await requireSession();

  if (session.memberships.length === 0) redirect("/khong-co-cua-hang");
  if (session.memberships.length === 1) redirect("/ban-hang");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chọn cửa hàng</CardTitle>
      </CardHeader>
      <CardContent>
        <StorePicker memberships={session.memberships} />
      </CardContent>
    </Card>
  );
}
