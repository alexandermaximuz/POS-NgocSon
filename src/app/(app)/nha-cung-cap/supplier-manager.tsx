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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { deleteSupplier, saveSupplier } from "@/lib/partners/actions";
import { supplierFormSchema, type SupplierForm } from "@/lib/partners/schema";

export interface SupplierRowView {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  isActive: boolean;
}

interface SupplierManagerProps {
  rows: SupplierRowView[];
  canEdit: boolean;
  suggestedCode: string;
}

export function SupplierManager({ rows, canEdit, suggestedCode }: SupplierManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState<SupplierForm | null>(null);
  const [deleting, setDeleting] = useState<SupplierRowView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(): void {
    if (form === null) return;
    const parsed = supplierFormSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await saveSupplier(parsed.data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.data.created ? "Đã thêm nhà cung cấp" : "Đã lưu nhà cung cấp", {
        description: `${parsed.data.code} · ${result.data.name}`,
      });
      setForm(null);
      router.refresh();
    });
  }

  function confirmDelete(): void {
    if (deleting === null) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteSupplier(deleting.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Đã xoá nhà cung cấp", { description: result.data.name });
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <Button
            size="pos"
            onClick={() => {
              setError(null);
              setForm({
                id: null,
                code: suggestedCode,
                name: "",
                phone: "",
                address: "",
                note: "",
                isActive: true,
              });
            }}
          >
            Thêm nhà cung cấp
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Mã</TableHead>
                <TableHead>Tên nhà cung cấp</TableHead>
                <TableHead className="w-36">Điện thoại</TableHead>
                <TableHead>Địa chỉ</TableHead>
                <TableHead className="w-28">Trạng thái</TableHead>
                {canEdit && <TableHead className="w-32" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.code}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="tabular-nums">{row.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.address ?? "—"}</TableCell>
                  <TableCell>
                    <span className={row.isActive ? "pill pill--green" : "pill pill--slate"}>
                      {row.isActive ? "Đang dùng" : "Ngừng"}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setForm({
                              id: row.id,
                              code: row.code,
                              name: row.name,
                              phone: row.phone ?? "",
                              address: row.address ?? "",
                              note: row.note ?? "",
                              isActive: row.isActive,
                            });
                          }}
                        >
                          Sửa
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setError(null);
                            setDeleting(row);
                          }}
                        >
                          Xoá
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form?.id === null ? "Thêm nhà cung cấp" : "Sửa nhà cung cấp"}
            </DialogTitle>
          </DialogHeader>

          {error !== null && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {form !== null && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ncc-code">Mã</Label>
                <Input
                  id="ncc-code"
                  value={form.code}
                  disabled={pending}
                  className="h-11 uppercase"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ncc-name">Tên nhà cung cấp</Label>
                <Input
                  id="ncc-name"
                  value={form.name}
                  disabled={pending}
                  className="h-11"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ncc-phone">Điện thoại</Label>
                <Input
                  id="ncc-phone"
                  value={form.phone}
                  disabled={pending}
                  className="h-11 tabular-nums"
                  inputMode="tel"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ncc-address">Địa chỉ</Label>
                <Input
                  id="ncc-address"
                  value={form.address}
                  disabled={pending}
                  className="h-11"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ncc-note">Ghi chú</Label>
                <Textarea
                  id="ncc-note"
                  value={form.note}
                  disabled={pending}
                  rows={2}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
              </div>
              {form.id !== null && (
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={form.isActive}
                    disabled={pending}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  Còn nhập hàng
                </label>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="pos" onClick={() => setForm(null)} disabled={pending}>
              Huỷ
            </Button>
            <Button size="pos" onClick={submit} disabled={pending}>
              {pending ? "Đang lưu…" : "Lưu"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá nhà cung cấp {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Nhà cung cấp đã có phiếu nhập, hoặc đang là NCC mặc định của sản phẩm nào đó, thì
              không xoá được — bỏ tích &quot;Còn nhập hàng&quot; thay vì xoá.
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
                confirmDelete();
              }}
              disabled={pending}
            >
              {pending ? "Đang xoá…" : "Xoá nhà cung cấp"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
