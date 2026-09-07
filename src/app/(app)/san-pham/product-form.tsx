"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { NativeSelect } from "@/components/common/native-select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveProduct } from "@/lib/catalog/actions";
import type { ItemGroup, SupplierRef, Uom } from "@/lib/catalog/queries";
import { productFormSchema, type ProductForm as ProductFormValues } from "@/lib/catalog/schema";
import { BarcodeRows, UomRows, VariantRows } from "./product-form-rows";

interface ProductFormProps {
  groups: ItemGroup[];
  uoms: Uom[];
  suppliers: SupplierRef[];
  defaultValues: ProductFormValues;
}

/**
 * Form thêm/sửa sản phẩm.
 *
 * Dùng react-hook-form + useFieldArray theo quy ước ở CLAUDE.md §"Quy ước code":
 * form có bảng con thêm/xoá dòng động thì dùng thư viện, form số trường cố định
 * thì dùng useState. Ba bảng con ở đây đúng là trường hợp thứ nhất.
 *
 * Toàn bộ việc ghi nằm ở `rpc_save_product`. Thông báo sau khi lưu đọc con số RPC
 * trả về (số biến thể, số mã vạch đã ghi), không phải số dòng đang có trên form —
 * đó là cách duy nhất để thông báo chứng minh được server đã thực sự ghi.
 */
export function ProductForm({ groups, uoms, suppliers, defaultValues }: ProductFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    control,
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
    mode: "onSubmit",
  });

  const sku = useWatch({ control, name: "sku" }) ?? "";
  const baseUomId = useWatch({ control, name: "baseUomId" }) ?? "";
  const variants = useWatch({ control, name: "variants" }) ?? [];
  const variantCodes = variants
    .map((v) => v.variantCode.trim().toUpperCase())
    .filter((code) => code !== "");

  const isEdit = defaultValues.id !== null;

  function submit(values: ProductFormValues): void {
    setError(null);
    startTransition(async () => {
      const result = await saveProduct(values);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      const { data } = result;
      toast.success(data.created ? "Đã thêm sản phẩm" : "Đã lưu sản phẩm", {
        description: `${data.sku} · ${data.variantCount} biến thể · ${data.uomCount} đơn vị · ${data.barcodeCount} mã vạch`,
      });
      router.push(`/san-pham/${data.productId}`);
    });
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {error !== null && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Thông tin chung</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Mã sản phẩm" error={errors.sku?.message}>
            <Input
              {...register("sku")}
              disabled={pending || isEdit}
              className="h-11 uppercase"
              placeholder="TH40"
              autoComplete="off"
            />
            {isEdit && (
              <p className="mt-1 text-xs text-muted-foreground">
                Mã đã in trên tem và nằm trong chứng từ cũ nên không đổi được. Cần mã khác thì
                tạo sản phẩm mới.
              </p>
            )}
          </Field>

          <Field label="Tên sản phẩm" error={errors.name?.message}>
            <Input
              {...register("name")}
              disabled={pending}
              className="h-11"
              placeholder="Thau nhựa Duy Thành 40cm"
              autoComplete="off"
            />
          </Field>

          <Field label="Nhóm hàng" error={errors.itemGroupId?.message}>
            <NativeSelect {...register("itemGroupId")} disabled={pending}>
              <option value="">— Chọn nhóm —</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Đơn vị gốc" error={errors.baseUomId?.message}>
            <NativeSelect {...register("baseUomId")} disabled={pending}>
              <option value="">— Chọn đơn vị —</option>
              {uoms.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </NativeSelect>
            <p className="mt-1 text-xs text-muted-foreground">
              Mọi số lượng trong hệ thống lưu ở đơn vị này.
            </p>
          </Field>

          <Field label="Thương hiệu" error={errors.brand?.message}>
            <Input {...register("brand")} disabled={pending} className="h-11" autoComplete="off" />
          </Field>

          <Field label="Nhà cung cấp mặc định" error={errors.defaultSupplierId?.message}>
            <NativeSelect
              disabled={pending}
              {...register("defaultSupplierId", {
                setValueAs: (v: string) => (v === "" ? null : v),
              })}
            >
              <option value="">— Không chọn —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </NativeSelect>
          </Field>

          <Field label="Tồn tối thiểu" error={errors.safetyStock?.message}>
            <Input
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              disabled={pending}
              className="h-11 text-right tabular-nums"
              {...register("safetyStock", { valueAsNumber: true })}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Dưới ngưỡng này thì báo sắp hết hàng. Ở đơn vị gốc.
            </p>
          </Field>

          <Field label="Trạng thái" error={errors.status?.message}>
            <NativeSelect {...register("status")} disabled={pending}>
              <option value="active">Đang bán</option>
              <option value="inactive">Ngừng bán</option>
            </NativeSelect>
          </Field>

          <div className="sm:col-span-2">
            <Field label="Mô tả" error={errors.description?.message}>
              <Textarea {...register("description")} disabled={pending} rows={2} />
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Đơn vị quy đổi</CardTitle>
        </CardHeader>
        <CardContent>
          <UomRows
            control={control}
            register={register}
            disabled={pending}
            uoms={uoms}
            baseUomId={baseUomId}
          />
          <RowError message={rowErrorMessage(errors.uoms)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Biến thể màu</CardTitle>
        </CardHeader>
        <CardContent>
          <VariantRows
            control={control}
            register={register}
            disabled={pending}
            sku={sku}
            setValue={setValue}
            getValues={getValues}
          />
          <RowError message={rowErrorMessage(errors.variants)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mã vạch</CardTitle>
        </CardHeader>
        <CardContent>
          <BarcodeRows
            control={control}
            register={register}
            disabled={pending}
            variantCodes={variantCodes}
          />
          <RowError message={rowErrorMessage(errors.barcodes)} />
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="pos" onClick={() => router.back()} disabled={pending}>
          Huỷ
        </Button>
        <Button type="submit" size="pos" disabled={pending}>
          {pending ? "Đang lưu…" : isEdit ? "Lưu thay đổi" : "Thêm sản phẩm"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {error !== undefined && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function RowError({ message }: { message: string | null }) {
  if (message === null) return null;
  return <p className="mt-2 text-xs text-destructive">{message}</p>;
}

/**
 * Lỗi của một mảng field có thể nằm ở chính mảng (trùng dòng, thiếu dòng mặc
 * định) hoặc ở một ô cụ thể. Gom lại thành một câu để người dùng không phải soi
 * từng dòng tìm chỗ đỏ.
 */
function rowErrorMessage(error: unknown): string | null {
  if (error === null || error === undefined) return null;

  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  if (Array.isArray(error)) {
    for (const [index, row] of error.entries()) {
      if (row === null || row === undefined || typeof row !== "object") continue;
      for (const value of Object.values(row as Record<string, { message?: string }>)) {
        if (typeof value?.message === "string") return `Dòng ${index + 1}: ${value.message}`;
      }
    }
  }
  return "Kiểm tra lại các dòng bên trên.";
}
