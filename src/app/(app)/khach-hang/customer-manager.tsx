"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { NativeSelect } from "@/components/common/native-select";
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
import { deleteCustomer, saveCustomer } from "@/lib/partners/actions";
import { customerFormSchema, type CustomerForm } from "@/lib/partners/schema";

export interface CustomerRowView {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  customerGroup: "retail" | "wholesale";
  note: string | null;
  isActive: boolean;
}

interface CustomerManagerProps {
  rows: CustomerRowView[];
  /** `staff` thêm được khách mới nhưng không sửa, không xoá (02-phan-quyen.md §4.2). */
  canEdit: boolean;
  suggestedCode: string;
}

export function CustomerManager({ rows, canEdit, suggestedCode }: CustomerManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState<CustomerForm | null>(null);
  const [deleting, setDeleting] = useState<CustomerRowView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function openNew(): void {
    setError(null);
    setForm({
      id: null,
      code: suggestedCode,
      name: "",
      phone: "",
      address: "",
      customerGroup: "wholesale",
      note: "",
      isActive: true,
    });
  }

  function openEdit(row: CustomerRowView): void {
    setError(null);
    setForm({
      id: row.id,
      code: row.code,
      name: row.name,
      phone: row.phone ?? "",
      address: row.address ?? "",
      customerGroup: row.customerGroup,
      note: row.note ?? "",
      isActive: row.isActive,
    });
  }

  function submit(): void {
    if (form === null) return;
    const parsed = customerFormSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ.");
      return;
    }

    // Trùng số điện thoại không chặn — hai vợ chồng cùng mua sỉ dùng chung số là
    // chuyện thật (0003:91-93). Chỉ nhắc để người nhập tự quyết.
    const duplicate = rows.find(
      (r) => r.phone !== null && r.phone !== "" && r.phone === parsed.data.phone && r.id !== form.id
    );

    setError(null);
    startTransition(async () => {
      const result = await saveCustomer(parsed.data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.data.created ? "Đã thêm khách hàng" : "Đã lưu khách hàng", {
        description: `${parsed.data.code} · ${result.data.name}`,
      });
      if (duplicate !== undefined) {
        toast.warning("Số điện thoại này trùng với khách khác", {
          description: `${duplicate.code} · ${duplicate.name}`,
        });
      }
      setForm(null);
      router.refresh();
    });
  }

  function confirmDelete(): void {
    if (deleting === null) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCustomer(deleting.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Đã xoá khách hàng", { description: result.data.name });
      setDeleting(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="pos" onClick={openNew}>
          Thêm khách hàng
        </Button>
      </div>

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">Mã</TableHead>
                <TableHead>Tên khách</TableHead>
                <TableHead className="w-36">Điện thoại</TableHead>
                <TableHead className="w-24">Nhóm</TableHead>
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
                  <TableCell>{row.customerGroup === "wholesale" ? "Sỉ" : "Lẻ"}</TableCell>
                  <TableCell className="text-muted-foreground">{row.address ?? "—"}</TableCell>
                  <TableCell>
                    <span className={row.isActive ? "pill pill--green" : "pill pill--slate"}>
                      {row.isActive ? "Đang dùng" : "Ngừng"}
                    </span>
                  </TableCell>
                  {canEdit && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
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
            <DialogTitle>{form?.id === null ? "Thêm khách hàng" : "Sửa khách hàng"}</DialogTitle>
          </DialogHeader>

          {error !== null && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {form !== null && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="kh-code">Mã khách</Label>
                <Input
                  id="kh-code"
                  value={form.code}
                  disabled={pending}
                  className="h-11 uppercase"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kh-name">Tên khách</Label>
                <Input
                  id="kh-name"
                  value={form.name}
                  disabled={pending}
                  className="h-11"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kh-phone">Điện thoại</Label>
                <Input
                  id="kh-phone"
                  value={form.phone}
                  disabled={pending}
                  className="h-11 tabular-nums"
                  inputMode="tel"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kh-group">Nhóm khách</Label>
                <NativeSelect
                  id="kh-group"
                  value={form.customerGroup}
                  disabled={pending}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      customerGroup: e.target.value === "retail" ? "retail" : "wholesale",
                    })
                  }
                >
                  <option value="wholesale">Sỉ</option>
                  <option value="retail">Lẻ</option>
                </NativeSelect>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="kh-address">Địa chỉ</Label>
                <Input
                  id="kh-address"
                  value={form.address}
                  disabled={pending}
                  className="h-11"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="kh-note">Ghi chú</Label>
                <Textarea
                  id="kh-note"
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
                  Còn giao dịch
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
            <AlertDialogTitle>Xoá khách {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Khách đã có đơn hàng hoặc phiếu thu thì không xoá được — bỏ tích &quot;Còn giao
              dịch&quot; thay vì xoá. Xoá rồi không hoàn tác được.
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
              {pending ? "Đang xoá…" : "Xoá khách"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
