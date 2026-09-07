"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActionResult } from "@/lib/actions";
import type { ImportOutcome, ImportPreview, PreviewLevel } from "@/lib/catalog/import-schema";

interface ImportWizardProps {
  templateHref: string;
  hint: string;
  onPreview: (formData: FormData) => Promise<ActionResult<ImportPreview<unknown>>>;
  onRun: (payload: unknown) => Promise<ActionResult<ImportOutcome>>;
  doneHref: string;
  doneLabel: string;
}

const LEVEL_PILL: Record<PreviewLevel, string> = {
  ok: "pill pill--green",
  warning: "pill pill--orange",
  error: "pill pill--red",
};

const LEVEL_TEXT: Record<PreviewLevel, string> = {
  ok: "Hợp lệ",
  warning: "Cảnh báo",
  error: "Lỗi",
};

/**
 * Gộp kết quả ghi với những dòng ĐÃ BỊ LOẠI Ở BƯỚC PREVIEW.
 *
 * Không gộp thì màn kết quả chỉ kể chuyện của những dòng được gửi đi, và một
 * file 161 dòng có 3 dòng hỏng sẽ báo "157 ghi mới · 0 lỗi" — đúng với việc RPC
 * đã làm, nhưng SAI với file người dùng vừa đưa vào, và họ đóng máy với niềm tin
 * là cả file đã vào hết. Con số ở màn cuối phải nói về cả file.
 *
 * Dòng `warning` ở preview là dòng bị bỏ qua có chủ đích (mã đã tồn tại, giá
 * không đổi) → cộng vào "bỏ qua". Dòng `error` → cộng vào "lỗi".
 */
function mergeOutcome(preview: ImportPreview<unknown>, outcome: ImportOutcome): ImportOutcome {
  const rejected = preview.rows.filter((row) => row.level !== "ok");

  return {
    created: outcome.created,
    skipped: outcome.skipped + rejected.filter((r) => r.level === "warning").length,
    failed: outcome.failed + rejected.filter((r) => r.level === "error").length,
    rows: [
      ...rejected.map((r) => ({
        row: r.row,
        sku: r.sku,
        status: r.level === "warning" ? "skipped" : "error",
        reason: r.reason,
      })),
      ...outcome.rows,
    ].sort((a, b) => a.row - b.row),
  };
}

/**
 * Ba bước import: chọn file → xem preview từng dòng → xác nhận ghi.
 *
 * Preview là bắt buộc và không ghi gì (phase-3.md §5). Dòng lỗi bị bỏ qua chứ
 * không chặn cả file — người dùng sửa vài dòng trong Excel rồi import lại phần
 * thiếu, thay vì phải làm lại từ đầu.
 *
 * File được gửi lên server để đọc: xem ghi chú ở đầu `import-schema.ts`.
 */
export function ImportWizard({
  templateHref,
  hint,
  onPreview,
  onRun,
  doneHref,
  doneLabel,
}: ImportWizardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportPreview<unknown> | null>(null);
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [fileRowCount, setFileRowCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function pickFile(file: File | undefined): void {
    if (file === undefined) return;
    setError(null);
    setOutcome(null);
    setPreview(null);
    setFileName(file.name);

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      const result = await onPreview(formData);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPreview(result.data);
    });
  }

  function run(): void {
    if (preview === null || preview.payload.length === 0) return;
    const current = preview;
    setError(null);

    startTransition(async () => {
      const result = await onRun({ rows: current.payload });
      if (!result.ok) {
        setError(result.message);
        return;
      }

      const merged = mergeOutcome(current, result.data);
      setOutcome(merged);
      setFileRowCount(current.rows.length);
      setPreview(null);
      toast.success("Đã import xong", {
        description: `${merged.created} dòng ghi mới · ${merged.skipped} bỏ qua · ${merged.failed} lỗi`,
      });
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {error !== null && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>1. Chuẩn bị file</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{hint}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="pos" asChild>
              <a href={templateHref}>Tải file mẫu .xlsx</a>
            </Button>
            <Input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              disabled={pending}
              className="h-11 max-w-sm"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
            {fileName !== null && (
              <span className="text-sm text-muted-foreground">{fileName}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {pending && preview === null && outcome === null && (
        <p className="text-sm text-muted-foreground">Đang đọc file…</p>
      )}

      {preview !== null && (
        <Card>
          <CardHeader>
            <CardTitle>
              2. Kiểm tra {preview.rows.length} dòng — {preview.ok} hợp lệ · {preview.warning} cảnh
              báo · {preview.error} lỗi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-96 overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Dòng</TableHead>
                    <TableHead className="w-32">Mã</TableHead>
                    <TableHead>Nội dung</TableHead>
                    <TableHead className="w-28">Kết quả</TableHead>
                    <TableHead className="w-72">Lý do</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow key={row.row}>
                      <TableCell className="tabular-nums">{row.row}</TableCell>
                      <TableCell className="font-medium">{row.sku}</TableCell>
                      <TableCell className="text-muted-foreground">{row.label}</TableCell>
                      <TableCell>
                        <span className={LEVEL_PILL[row.level]}>{LEVEL_TEXT[row.level]}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                Chỉ {preview.ok} dòng hợp lệ được ghi. Dòng cảnh báo và dòng lỗi bị bỏ qua.
              </p>
              <Button size="pos" onClick={run} disabled={pending || preview.ok === 0}>
                {pending ? "Đang ghi…" : `Import ${preview.ok} dòng`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {outcome !== null && (
        <Card>
          <CardHeader>
            <CardTitle>
              3. Kết quả trên {fileRowCount} dòng của file — {outcome.created} ghi mới ·{" "}
              {outcome.skipped} bỏ qua · {outcome.failed} lỗi
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {outcome.rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Mọi dòng trong file đều đã ghi vào hệ thống, không dòng nào bị bỏ qua.
              </p>
            )}

            {outcome.rows.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">Dòng</TableHead>
                      <TableHead className="w-32">Mã</TableHead>
                      <TableHead className="w-28">Kết quả</TableHead>
                      <TableHead>Lý do</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outcome.rows.map((row) => (
                      <TableRow key={`${row.row}-${row.sku ?? ""}`}>
                        <TableCell className="tabular-nums">{row.row}</TableCell>
                        <TableCell className="font-medium">{row.sku ?? ""}</TableCell>
                        <TableCell>
                          <span
                            className={row.status === "error" ? "pill pill--red" : "pill pill--orange"}
                          >
                            {row.status === "error" ? "Lỗi" : "Bỏ qua"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{row.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="pos"
                onClick={() => {
                  setOutcome(null);
                  setFileName(null);
                  if (inputRef.current !== null) inputRef.current.value = "";
                }}
              >
                Import file khác
              </Button>
              <Button size="pos" asChild>
                <Link href={doneHref as Route}>{doneLabel}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
