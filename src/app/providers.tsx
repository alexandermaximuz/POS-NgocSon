"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * `useState` chứ không phải biến module: mỗi request trên server phải có
 * QueryClient riêng, nếu không hai người dùng khác nhau sẽ đọc cache của nhau.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Máy ở quầy chạy cả ngày không tải lại trang. 30 giây đủ để dữ liệu
            // không cũ, mà không biến mỗi lần chuyển tab thành một loạt request.
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
