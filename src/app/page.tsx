import { redirect } from "next/navigation";

/**
 * Middleware đã đá người chưa đăng nhập về `/login`, nên tới được đây nghĩa là đã
 * đăng nhập. Bán hàng là việc mở ra làm đầu tiên mỗi ngày.
 */
export default function Home() {
  redirect("/ban-hang");
}
