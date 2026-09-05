import { EmptyState } from "./empty-state";
import { PageHeader } from "./page-header";

interface PhaseStubProps {
  title: string;
  description: string;
  /** Ví dụ: `"Phase 3 — Danh mục"`. */
  phase: string;
}

/**
 * Chỗ giữ sẵn cho màn hình thuộc phase sau.
 *
 * Có nó để sidebar không dẫn tới 404, và để kiểm chứng được việc chặn route theo
 * vai trò. Cố tình KHÔNG hiện số liệu giả: v1 từng ghi "1.847 mã hàng" trong khi
 * chỉ có 10, và đó là thứ làm người dùng mất tin vào mọi con số khác
 * (05-giao-dien.md:57).
 */
export function PhaseStub({ title, description, phase }: PhaseStubProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <EmptyState title={`Chưa làm — thuộc ${phase}`} hint="Màn hình này sẽ có ở phase sau." />
    </>
  );
}
