"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { deleteProduct } from "@/lib/catalog/actions";

interface DeleteProductButtonProps {
  productId: string;
  sku: string;
  name: string;
  variantCount: number;
}

/**
 * Xoá sản phẩm là hành động không hoàn tác được → phải qua hộp thoại xác nhận nêu
 * đúng những gì sẽ mất theo (05-giao-dien.md §"Xác nhận thao tác").
 *
 * Sản phẩm đã có phát sinh kho thì RPC từ chối và trả `PRODUCT_IN_USE`. Đó là kết
 * quả ĐÚNG, không phải lỗi cần vá: chứng từ đã chốt là bất biến. Thông báo lỗi nói
 * thẳng cách xử lý thay thế là chuyển sang Ngừng bán.
 */
export function DeleteProductButton({
  productId,
  sku,
  name,
  variantCount,
}: DeleteProductButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm(): void {
    setError(null);
    startTransition(async () => {
      const result = await deleteProduct(productId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Đã xoá sản phẩm", {
        description: `${sku} · ${result.data.name}`,
      });
      setOpen(false);
      router.push("/san-pham");
    });
  }

  return (
    <>
      <Button variant="outline" size="pos" onClick={() => setOpen(true)}>
        Xoá
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá sản phẩm {sku}?</AlertDialogTitle>
            <AlertDialogDescription>
              Xoá {name} sẽ xoá theo {variantCount} biến thể và toàn bộ mã vạch của chúng. Không
              hoàn tác được.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {error !== null && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Không xoá</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                confirm();
              }}
              disabled={pending}
            >
              {pending ? "Đang xoá…" : "Xoá sản phẩm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
