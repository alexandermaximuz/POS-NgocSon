import Link from "next/link";
import type { Route } from "next";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  /** Đường dẫn cơ sở, ví dụ `/san-pham`. */
  basePath: string;
  /** Các tham số lọc hiện tại, giữ nguyên khi chuyển trang. */
  params: Record<string, string>;
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Phân trang bằng LINK, không phải nút bấm gọi JS: mỗi trang là một URL thật, mở
 * được ở tab mới và quay lại được bằng nút Back. Phân trang chạy ở server (`range`
 * của PostgREST) nên trang nào cũng chỉ tải đúng số dòng của nó.
 */
export function Pagination({ basePath, params, page, pageSize, total }: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (total === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 pt-3" aria-label="Phân trang">
      <p className="text-sm text-muted-foreground tabular-nums">
        {from}–{to} trên {total}
      </p>
      <div className="flex items-center gap-2">
        <PageLink basePath={basePath} params={params} page={page - 1} disabled={page <= 1}>
          Trang trước
        </PageLink>
        <span className="text-sm text-muted-foreground tabular-nums">
          {page}/{lastPage}
        </span>
        <PageLink
          basePath={basePath}
          params={params}
          page={page + 1}
          disabled={page >= lastPage}
        >
          Trang sau
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  basePath,
  params,
  page,
  disabled,
  children,
}: {
  basePath: string;
  params: Record<string, string>;
  page: number;
  disabled: boolean;
  children: string;
}) {
  if (disabled) {
    return (
      <Button variant="outline" size="sm" disabled>
        {children}
      </Button>
    );
  }

  const query = new URLSearchParams(params);
  query.set("trang", String(page));

  return (
    <Button variant="outline" size="sm" asChild>
      <Link href={`${basePath}?${query.toString()}` as Route}>{children}</Link>
    </Button>
  );
}
