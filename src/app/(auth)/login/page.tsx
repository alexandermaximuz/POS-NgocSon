import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "./login-form";

/**
 * Đăng nhập bằng email + mật khẩu Supabase Auth. Cả `owner` và `staff` dùng
 * chung một đường — không có PIN, OAuth hay magic link (phase-2.md).
 */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <Card>
      <CardContent className="pt-6">
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}
