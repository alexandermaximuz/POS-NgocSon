"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStore } from "@/lib/auth/session";
import { rpcErrorMessage } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { getCurrentShift } from "./queries";
import {
  cashTxnFormSchema,
  cashTxnResultSchema,
  closeShiftFormSchema,
  closeShiftResultSchema,
  openShiftFormSchema,
} from "./schema";

/**
 * Server Action cho ca làm việc.
 *
 * `store_id` và `shift_id` KHÔNG BAO GIỜ nhận từ client — luôn suy ra từ phiên và
 * từ ca đang mở của cửa hàng đó. Client chỉ gửi thứ nó thực sự biết: số tiền, lý do,
 * và `client_uuid` cho idempotency.
 */

export type ActionResult = { ok: true } | { ok: false; message: string };

const INVALID = "Dữ liệu nhập chưa hợp lệ. Kiểm tra lại các ô đã nhập.";
const NO_SHIFT = "Chưa mở ca, hoặc ca vừa bị người khác đóng. Tải lại trang.";

export async function openShift(input: unknown, next: string): Promise<ActionResult> {
  const parsed = openShiftFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: INVALID };

  const session = await requireStore();
  const supabase = await createClient();

  const { error } = await supabase.rpc("rpc_open_shift", {
    p_payload: { store_id: session.storeId, opening_float: parsed.data.openingFloat },
  });
  if (error !== null) return { ok: false, message: rpcErrorMessage(error) };

  revalidatePath("/", "layout");
  redirect(safeNext(next));
}

export async function closeShift(input: unknown): Promise<ActionResult> {
  const parsed = closeShiftFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: INVALID };

  const session = await requireStore();
  const state = await getCurrentShift(session.storeId);
  if (!state.has_open_shift) return { ok: false, message: NO_SHIFT };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_close_shift", {
    p_payload: {
      shift_id: state.shift_id,
      counted_cash: parsed.data.countedCash,
      note: parsed.data.note ?? null,
    },
  });
  if (error !== null) return { ok: false, message: rpcErrorMessage(error) };

  // Parse để lỗi nổ ngay nếu payload của RPC đổi, chứ không im lặng ở màn kết quả.
  const result = closeShiftResultSchema.parse(data);

  revalidatePath("/", "layout");
  redirect(`/ca/ket-qua?shift=${result.shift_id}`);
}

/**
 * `clientUuid` do client sinh MỘT LẦN cho mỗi lần người dùng định lập phiếu, và
 * giữ nguyên qua mọi lần thử lại. Server sinh hộ thì bấm đúp sẽ ra hai phiếu và
 * tiền két sai âm thầm — đúng thứ `uq_cash_transactions_client_uuid` sinh ra để chặn.
 */
export async function createCashTxn(input: unknown, clientUuid: string): Promise<ActionResult> {
  const parsed = cashTxnFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: INVALID };
  if (!UUID_RE.test(clientUuid)) return { ok: false, message: INVALID };

  const session = await requireStore();
  const state = await getCurrentShift(session.storeId);
  if (!state.has_open_shift) return { ok: false, message: NO_SHIFT };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_cash_txn", {
    p_payload: {
      shift_id: state.shift_id,
      client_uuid: clientUuid,
      type: parsed.data.type,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
    },
  });
  if (error !== null) return { ok: false, message: rpcErrorMessage(error) };

  cashTxnResultSchema.parse(data);
  revalidatePath("/", "layout");
  return { ok: true };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chỉ nhận đường dẫn nội bộ: `next` đến từ query string, tức là từ người dùng. */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/ban-hang";
}
