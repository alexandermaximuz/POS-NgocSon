import { Skeleton } from "@/components/ui/skeleton";

/**
 * Trạng thái loading của màn danh sách (05-giao-dien.md §"Bốn trạng thái"):
 * skeleton đúng hình dạng bảng sắp hiện ra, không phải spinner toàn trang.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between pb-4">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-11 w-36" />
      </div>
      <Skeleton className="mb-3 h-11 w-full" />
      <div className="space-y-px rounded-xl border border-border p-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}
