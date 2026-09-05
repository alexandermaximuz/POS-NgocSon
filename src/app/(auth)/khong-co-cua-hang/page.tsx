import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { requireSession } from "@/lib/auth/session";

/**
 * Tài khoản có thật nhưng chưa được gán cửa hàng nào.
 *
 * Không phải lỗi kỹ thuật — chủ cửa hàng chưa phân quyền. Cần một màn riêng vì đá
 * về `/login` sẽ thành vòng lặp: middleware thấy đã đăng nhập rồi lại đá ngược ra.
 */
export default async function KhongCoCuaHangPage() {
  const session = await requireSession();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chưa được gán cửa hàng</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Tài khoản <span className="font-medium text-foreground">{session.email}</span> chưa
          được gán vào cửa hàng nào. Báo chủ cửa hàng để được cấp quyền.
        </p>
        <SignOutButton className="w-full" />
      </CardContent>
    </Card>
  );
}
