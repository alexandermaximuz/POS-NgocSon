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
import { deleteItemGroup, saveItemGroup } from "@/lib/catalog/actions";
import type { ItemGroup } from "@/lib/catalog/queries";
import { itemGroupFormSchema, type ItemGroupForm } from "@/lib/catalog/schema";

interface ItemGroupManagerProps {
  groups: ItemGroup[];
  productCounts: Record<string, number>;
}

const EMPTY: ItemGroupForm = { id: null, code: "", name: "", parentId: null, sortOrder: 0 };

/**
 * Cây nhóm hàng với thêm/sửa/xoá.
 *
 * Form chỉ có 4 trường cố định nên dùng `useState`, không dùng react-hook-form —
 * đúng ranh giới đã ghi ở CLAUDE.md §"Quy ước code".
 */
export function ItemGroupManager({ groups, productCounts }: ItemGroupManagerProps) {
  const router = useRouter();
  const [form, setForm] = useState<ItemGroupForm | null>(null);
  const [deleting, setDeleting] = useState<ItemGroup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const roots = groups.filter((g) => g.parent_id === null);
  const childrenOf = (id: string) => groups.filter((g) => g.parent_id === id);

  function submit(): void {
    if (form === null) return;
    const parsed = itemGroupFormSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await saveItemGroup(parsed.data);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success(result.data.created ? "Đã thêm nhóm hàng" : "Đã lưu nhóm hàng", {
        description: result.data.name,
      });
      setForm(null);
      router.refresh();
    });
  }

  function confirmDelete(): void {
    if (deleting === null) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteItemGroup(deleting.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Đã xoá nhóm hàng", { description: result.data.name });
      setDeleting(null);
      router.refresh();
    });
  }

  function renderRow(group: ItemGroup, depth: number) {
    const count = productCounts[group.id] ?? 0;
    const childCount = childrenOf(group.id).length;

    return (
      <li key={group.id}>
        <div
          className="flex flex-wrap items-center gap-3 border-b border-border py-2.5 last:border-b-0"
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          <span className="w-24 font-medium">{group.code}</span>
          <span className="min-w-40 flex-1">{group.name}</span>
          <span className="text-sm text-muted-foreground tabular-nums">
            {count} sản phẩm{childCount > 0 ? ` · ${childCount} nhóm con` : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              setForm({
                id: group.id,
                code: group.code,
                name: group.name,
                parentId: group.parent_id,
                sortOrder: group.sort_order,
              });
            }}
          >
            Sửa
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={count > 0 || childCount > 0}
            title={
              count > 0 || childCount > 0 ? "Còn dữ liệu bên trong, không xoá được" : undefined
            }
            onClick={() => {
              setError(null);
              setDeleting(group);
            }}
          >
            Xoá
          </Button>
        </div>
        {childCount > 0 && <ul>{childrenOf(group.id).map((c) => renderRow(c, depth + 1))}</ul>}
      </li>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          size="pos"
          onClick={() => {
            setError(null);
            setForm(EMPTY);
          }}
        >
          Thêm nhóm
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-6 py-14 text-center text-sm text-muted-foreground">
          Chưa có nhóm hàng nào. Thêm nhóm đầu tiên để phân loại sản phẩm.
        </p>
      ) : (
        <ul className="rounded-xl border border-border px-3">{roots.map((g) => renderRow(g, 0))}</ul>
      )}

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form?.id === null ? "Thêm nhóm hàng" : "Sửa nhóm hàng"}</DialogTitle>
          </DialogHeader>

          {error !== null && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {form !== null && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="group-code">Mã nhóm</Label>
                <Input
                  id="group-code"
                  value={form.code}
                  disabled={pending}
                  className="h-11 uppercase"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="group-name">Tên nhóm</Label>
                <Input
                  id="group-name"
                  value={form.name}
                  disabled={pending}
                  className="h-11"
                  autoComplete="off"
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="group-parent">Nhóm cha</Label>
                <NativeSelect
                  id="group-parent"
                  value={form.parentId ?? ""}
                  disabled={pending}
                  onChange={(e) =>
                    setForm({ ...form, parentId: e.target.value === "" ? null : e.target.value })
                  }
                >
                  <option value="">— Không có (nhóm gốc) —</option>
                  {groups
                    .filter((g) => g.id !== form.id)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="group-sort">Thứ tự hiển thị</Label>
                <Input
                  id="group-sort"
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  disabled={pending}
                  className="h-11 w-32 text-right tabular-nums"
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: Number.parseInt(e.target.value, 10) || 0 })
                  }
                />
              </div>
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
            <AlertDialogTitle>Xoá nhóm {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Nhóm này đang không có sản phẩm và không có nhóm con. Xoá rồi không hoàn tác được.
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
              {pending ? "Đang xoá…" : "Xoá nhóm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
