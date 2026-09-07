"use client";

import { Trash2 } from "lucide-react";
import {
  useFieldArray,
  useWatch,
  type Control,
  type UseFormGetValues,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";
import { NativeSelect } from "@/components/common/native-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ProductForm } from "@/lib/catalog/schema";
import type { Uom } from "@/lib/catalog/queries";
import { variantCodeSuffix } from "@/lib/search";

/**
 * Ba bảng con của form sản phẩm. Tách khỏi `product-form.tsx` cho cả hai file
 * cùng ở dưới trần 400 dòng của CLAUDE.md.
 *
 * Đây đúng là chỗ `useFieldArray` được sinh ra để làm: thêm/xoá dòng động, mỗi
 * dòng nhiều ô, và validate theo từng ô qua zod schema chung.
 */

interface RowProps {
  control: Control<ProductForm>;
  register: UseFormRegister<ProductForm>;
  disabled: boolean;
}

export function UomRows({
  control,
  register,
  disabled,
  uoms,
  baseUomId,
}: RowProps & { uoms: Uom[]; baseUomId: string }) {
  const { fields, append, remove } = useFieldArray({ control, name: "uoms" });

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Đơn vị gốc luôn có hệ số 1 và không cần khai ở đây. Chỉ khai đơn vị lớn:
          Chục = 10, Thùng = 12.
        </p>

        {fields.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Chưa có đơn vị quy đổi nào.</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-end gap-2">
                <div className="flex-1">
                  <NativeSelect
                    aria-label={`Đơn vị dòng ${index + 1}`}
                    disabled={disabled}
                    {...register(`uoms.${index}.uomId`)}
                  >
                    <option value="">— Chọn đơn vị —</option>
                    {uoms
                      .filter((u) => u.id !== baseUomId)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                  </NativeSelect>
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    step="0.0001"
                    min="0"
                    inputMode="decimal"
                    aria-label={`Hệ số dòng ${index + 1}`}
                    placeholder="Hệ số"
                    disabled={disabled}
                    className="h-11 text-right tabular-nums"
                    {...register(`uoms.${index}.factor`, { valueAsNumber: true })}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-pos"
                  aria-label={`Xoá đơn vị dòng ${index + 1}`}
                  disabled={disabled}
                  onClick={() => remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || fields.length >= 6}
        onClick={() => append({ uomId: "", factor: 10 })}
      >
        Thêm đơn vị quy đổi
      </Button>
    </div>
  );
}

export function VariantRows({
  control,
  register,
  disabled,
  sku,
  setValue,
  getValues,
}: RowProps & {
  sku: string;
  setValue: UseFormSetValue<ProductForm>;
  getValues: UseFormGetValues<ProductForm>;
}) {
  const { fields, append, remove } = useFieldArray({ control, name: "variants" });
  const watched = useWatch({ control, name: "variants" }) ?? [];

  /**
   * Gợi ý mã biến thể từ màu vừa gõ, và chỉ khi ô mã còn trống — người dùng đã tự
   * đặt mã thì không được ghi đè, nhất là ở biến thể cũ đã có mã vạch dán trên kệ.
   */
  function suggestCode(index: number, color: string): void {
    const current = getValues(`variants.${index}.variantCode`);
    if (current.trim() !== "" || color.trim() === "" || sku.trim() === "") return;
    const suffix = variantCodeSuffix(color);
    if (suffix !== "") setValue(`variants.${index}.variantCode`, `${sku.toUpperCase()}-${suffix}`);
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Mỗi màu là một biến thể, tất cả cùng giá. Không khai màu nào thì hệ thống tự tạo một
          biến thể mặc định mang đúng mã sản phẩm.
        </p>

        {fields.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">
            Chưa khai màu — sẽ có một biến thể mặc định.
          </p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-wrap items-end gap-2">
                <div className="w-44">
                  <Input
                    aria-label={`Màu dòng ${index + 1}`}
                    placeholder="Màu, ví dụ Xanh dương"
                    disabled={disabled}
                    className="h-11"
                    {...register(`variants.${index}.attrColor`, {
                      onBlur: (event) => {
                        suggestCode(index, (event.target as HTMLInputElement).value);
                      },
                    })}
                  />
                </div>
                <div className="w-44">
                  <Input
                    aria-label={`Mã biến thể dòng ${index + 1}`}
                    placeholder="Mã biến thể"
                    disabled={disabled}
                    className="h-11 uppercase"
                    {...register(`variants.${index}.variantCode`)}
                  />
                </div>
                <div className="w-36">
                  <NativeSelect
                    aria-label={`Trạng thái biến thể dòng ${index + 1}`}
                    disabled={disabled}
                    {...register(`variants.${index}.status`)}
                  >
                    <option value="active">Đang bán</option>
                    <option value="inactive">Ngừng bán</option>
                  </NativeSelect>
                </div>
                <label className="flex h-11 items-center gap-2 px-1 text-sm">
                  <input
                    type="radio"
                    name="variant-default"
                    className="size-4"
                    disabled={disabled}
                    checked={watched[index]?.isDefault === true}
                    onChange={() => {
                      fields.forEach((_, i) => setValue(`variants.${i}.isDefault`, i === index));
                    }}
                  />
                  Mặc định
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-pos"
                  aria-label={`Xoá biến thể dòng ${index + 1}`}
                  disabled={disabled}
                  onClick={() => remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || fields.length >= 50}
        onClick={() =>
          append({
            id: null,
            variantCode: "",
            attrColor: "",
            isDefault: fields.length === 0,
            status: "active",
          })
        }
      >
        Thêm màu
      </Button>
    </div>
  );
}

export function BarcodeRows({
  control,
  register,
  disabled,
  variantCodes,
}: RowProps & { variantCodes: string[] }) {
  const { fields, append, remove } = useFieldArray({ control, name: "barcodes" });

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Một biến thể có thể có nhiều mã vạch. Mã nội bộ sinh tự động ở màn chi tiết sản phẩm
          sau khi lưu.
        </p>

        {fields.length === 0 ? (
          <p className="py-2 text-sm text-muted-foreground">Chưa có mã vạch nào.</p>
        ) : (
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-wrap items-end gap-2">
                <div className="w-48">
                  <NativeSelect
                    aria-label={`Biến thể của mã vạch dòng ${index + 1}`}
                    disabled={disabled}
                    {...register(`barcodes.${index}.variantCode`)}
                  >
                    <option value="">— Chọn biến thể —</option>
                    {variantCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="w-52">
                  <Input
                    aria-label={`Mã vạch dòng ${index + 1}`}
                    placeholder="Quét hoặc gõ mã vạch"
                    disabled={disabled}
                    className="h-11 tabular-nums"
                    {...register(`barcodes.${index}.barcode`)}
                  />
                </div>
                <div className="w-44">
                  <NativeSelect
                    aria-label={`Nguồn mã vạch dòng ${index + 1}`}
                    disabled={disabled}
                    {...register(`barcodes.${index}.source`)}
                  >
                    <option value="manufacturer">Mã nhà sản xuất</option>
                    <option value="internal">Tem tự in</option>
                  </NativeSelect>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-pos"
                  aria-label={`Xoá mã vạch dòng ${index + 1}`}
                  disabled={disabled}
                  onClick={() => remove(index)}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || variantCodes.length === 0 || fields.length >= 200}
        onClick={() =>
          append({ variantCode: variantCodes[0] ?? "", barcode: "", source: "manufacturer" })
        }
      >
        Thêm mã vạch
      </Button>
    </div>
  );
}
