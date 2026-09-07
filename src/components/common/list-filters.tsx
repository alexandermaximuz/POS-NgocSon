import { Search } from "lucide-react";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface FilterField {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}

interface ListFiltersProps {
  action: string;
  q: string;
  placeholder: string;
  fields?: FilterField[];
}

/**
 * Thanh tìm kiếm và lọc của các màn danh sách.
 *
 * Là `<form method="get">` thuần, không có JavaScript nào: gõ rồi Enter là ra kết
 * quả, mỗi bộ lọc là một URL thật (chia sẻ được, Back được), và trang danh sách
 * vẫn là Server Component. Debounce theo từng phím gõ nghe thì hiện đại nhưng ở
 * đây chỉ đổi lấy việc mất hết những thứ trên.
 *
 * Tìm kiếm BỎ DẤU chạy ở `name_normalized` — xem `src/lib/search.ts`.
 */
export function ListFilters({ action, q, placeholder, fields = [] }: ListFiltersProps) {
  return (
    <form action={action as Route} method="get" className="flex flex-wrap items-end gap-2 pb-3">
      <div className="min-w-56 flex-1">
        <label htmlFor="filter-q" className="mb-1.5 block text-xs text-muted-foreground">
          Tìm kiếm
        </label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="filter-q"
            name="q"
            defaultValue={q}
            placeholder={placeholder}
            autoComplete="off"
            className="h-11 pl-9"
          />
        </div>
      </div>

      {fields.map((field) => (
        <div key={field.name}>
          <label
            htmlFor={`filter-${field.name}`}
            className="mb-1.5 block text-xs text-muted-foreground"
          >
            {field.label}
          </label>
          <select
            id={`filter-${field.name}`}
            name={field.name}
            defaultValue={field.value}
            className="h-11 min-w-40 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <Button type="submit" variant="outline" size="pos">
        Lọc
      </Button>
    </form>
  );
}
