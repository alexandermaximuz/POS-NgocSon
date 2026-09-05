import { Wifi } from "lucide-react";

/**
 * Trạng thái đồng bộ.
 *
 * TĨNH ở Phase 2, đúng như phase-2.md:41. Ba trạng thái thật
 * (`Đã đồng bộ` / `Chờ N đơn` / `Mất kết nối`) đọc từ hàng đợi outbox là việc của
 * Phase 10 — trước khi có outbox thì mọi nhãn động đều là nhãn bịa.
 */
export function SyncBadge() {
  return (
    <span className="pill pill--green" title="Trạng thái đồng bộ (Phase 10 mới có logic thật)">
      <Wifi className="size-3" aria-hidden />
      Đã kết nối
    </span>
  );
}
