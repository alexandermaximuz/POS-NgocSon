"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { addInternalBarcode } from "@/lib/catalog/actions";

interface VariantBarcodesProps {
  variantId: string;
  barcodes: { id: string; barcode: string; source: "manufacturer" | "internal" }[];
  canEdit: boolean;
}

/**
 * Danh sách mã vạch của một biến thể, kèm nút sinh mã nội bộ.
 *
 * Một biến thể có nhiều mã là chuyện bình thường: khoảng một nửa mặt hàng có mã
 * nhà sản xuất, nửa còn lại dán tem tự in, và có hàng mang cả hai. Cả hai đều phải
 * quét ra đúng biến thể này.
 *
 * Số của mã nội bộ do database cấp (`seq_internal_barcode`), không do client đoán.
 */
export function VariantBarcodes({ variantId, barcodes, canEdit }: VariantBarcodesProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate(): void {
    setError(null);
    startTransition(async () => {
      const result = await addInternalBarcode(variantId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Đã sinh mã nội bộ", { description: result.data.barcode });
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {barcodes.length === 0 ? (
        <span className="text-sm text-muted-foreground">Chưa có mã vạch</span>
      ) : (
        barcodes.map((b) => (
          <span
            key={b.id}
            className={b.source === "manufacturer" ? "pill pill--blue" : "pill pill--slate"}
            title={b.source === "manufacturer" ? "Mã nhà sản xuất" : "Tem tự in"}
          >
            <span className="tabular-nums">{b.barcode}</span>
          </span>
        ))
      )}

      {canEdit && (
        <Button variant="outline" size="sm" onClick={generate} disabled={pending}>
          {pending ? "Đang sinh…" : "Sinh mã nội bộ"}
        </Button>
      )}

      {error !== null && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
