"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { MoneyInput } from "@/components/common/money-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { updatePrice } from "@/lib/pricing/actions";
import type { PriceColumn } from "@/lib/pricing/queries";

export interface PriceGridRow {
  id: string;
  sku: string;
  name: string;
  baseUomCode: string;
  /** Cùng thứ tự với `columns`. `null` = chưa đặt giá. */
  prices: (number | null)[];
}

interface PriceGridProps {
  columns: PriceColumn[];
  rows: PriceGridRow[];
}

interface EditTarget {
  product: PriceGridRow;
  column: PriceColumn;
  current: number | null;
}

/**
 * Lưới giá với ô bấm được để sửa.
 *
 * Sửa giá là hành động có hậu quả tài chính nên đi qua hộp thoại xác nhận hiện
 * ĐÚNG giá cũ → giá mới (05-giao-dien.md §"Xác nhận thao tác"). Thông báo sau khi
 * lưu đọc `previous_price` và `price_per_base_unit` do RPC trả về, không phải số
 * đang nằm trên form.
 */
export function PriceGrid({ columns, rows }: PriceGridProps) {
  const router = useRouter();
  const [target, setTarget] = useState<EditTarget | null>(null);
  const [value, setValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function open(product: PriceGridRow, column: PriceColumn, current: number | null): void {
    setError(null);
    setValue(current ?? 0);
    setTarget({ product, column, current });
  }

  function submit(): void {
    if (target === null) return;
    setError(null);

    startTransition(async () => {
      const result = await updatePrice({
        priceListId: target.column.id,
        productId: target.product.id,
        price: value,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      const { previousPrice, price, sku } = result.data;
      toast.success(`Đã đổi giá ${sku}`, {
        description:
          previousPrice === null
            ? `${target.column.label}: ${formatMoney(price)}`
            : `${target.column.label}: ${formatMoney(previousPrice)} → ${formatMoney(price)}`,
      });
      setTarget(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Mã</TableHead>
              <TableHead>Sản phẩm</TableHead>
              {columns.map((column) => (
                <TableHead key={column.id} className="w-36 text-right">
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.sku}</TableCell>
                <TableCell>
                  {row.name}
                  {row.baseUomCode !== "" && (
                    <span className="ml-2 text-xs text-muted-foreground">/{row.baseUomCode}</span>
                  )}
                </TableCell>
                {columns.map((column, index) => {
                  const price = row.prices[index] ?? null;
                  return (
                    <TableCell key={column.id} className="text-right">
                      <button
                        type="button"
                        onClick={() => open(row, column, price)}
                        className="h-11 w-full rounded-md px-2 text-right tabular-nums hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                        aria-label={`Sửa ${column.label} của ${row.sku}`}
                      >
                        {price === null ? (
                          <span className="text-muted-foreground">chưa đặt</span>
                        ) : (
                          formatMoney(price)
                        )}
                      </button>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={target !== null} onOpenChange={(isOpen) => !isOpen && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa giá {target?.product.sku}</DialogTitle>
            <DialogDescription>
              {target?.product.name} · {target?.column.label}
            </DialogDescription>
          </DialogHeader>

          {error !== null && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Giá hiện tại</dt>
            <dd className="text-right tabular-nums">
              {target?.current === null || target?.current === undefined
                ? "chưa đặt"
                : formatMoney(target.current)}
            </dd>
            <dt className="text-muted-foreground">Giá mới</dt>
            <dd className="text-right tabular-nums">{formatMoney(value)}</dd>
          </dl>

          <MoneyInput
            label={`Giá theo ${target?.product.baseUomCode === "" ? "đơn vị gốc" : target?.product.baseUomCode}`}
            value={value}
            onChange={setValue}
            disabled={pending}
            autoFocus
            hint="Giá lưu theo đơn vị gốc. Giá theo đơn vị lớn tự nhân với hệ số quy đổi."
          />

          <DialogFooter>
            <Button variant="outline" size="pos" onClick={() => setTarget(null)} disabled={pending}>
              Huỷ
            </Button>
            <Button
              size="pos"
              onClick={submit}
              disabled={pending || value === (target?.current ?? -1)}
            >
              {pending ? "Đang lưu…" : "Đổi giá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
