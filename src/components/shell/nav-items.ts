import {
  Boxes,
  ChartColumn,
  HandCoins,
  Package,
  PackagePlus,
  Settings,
  ShoppingCart,
  Tags,
  Truck,
  Undo2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { StoreRole } from "@/lib/auth/session";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Chỉ `owner` thấy. Ẩn menu là chưa đủ — route tương ứng phải tự gọi `requireOwner()`. */
  ownerOnly?: boolean;
}

/**
 * Nguồn duy nhất của điều hướng (05-giao-dien.md §"Điều hướng").
 *
 * Thêm mục mới ở đây thì PHẢI thêm cả `requireOwner()` vào layout của route đó nếu
 * `ownerOnly`. Danh sách này chỉ quyết định hiển thị, không quyết định quyền.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/ban-hang", label: "Bán hàng", icon: ShoppingCart },
  { href: "/nhap-kho", label: "Nhập kho", icon: PackagePlus },
  { href: "/ton-kho", label: "Tồn kho", icon: Boxes },
  { href: "/cong-no", label: "Công nợ", icon: HandCoins },
  { href: "/tra-hang", label: "Trả hàng", icon: Undo2 },
  { href: "/san-pham", label: "Sản phẩm", icon: Package },
  { href: "/bang-gia", label: "Bảng giá", icon: Tags, ownerOnly: true },
  { href: "/khach-hang", label: "Khách hàng", icon: Users },
  { href: "/nha-cung-cap", label: "Nhà cung cấp", icon: Truck },
  { href: "/bao-cao", label: "Báo cáo", icon: ChartColumn },
  { href: "/cai-dat", label: "Cài đặt", icon: Settings, ownerOnly: true },
];

export function visibleNavItems(role: StoreRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.ownerOnly !== true || role === "owner");
}
