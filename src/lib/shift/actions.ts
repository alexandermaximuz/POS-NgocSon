"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, type ActionResult } from "@/lib/actions";
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
  openShiftResultSchema,
} from "./schema";

/**
 * Server Action cho ca làm việc.
 *
 * `store_id` và `shift_id` KHÔNG BAO GIỜ nhận từ client — luôn suy ra từ phiên và
 * từ ca đang mở của cửa hàng đó. Client chỉ gửi thứ nó thực sự biết: số tiền, lý do,
 * và `client_uuid` cho idempotency.
 *
 * Mọi action trả về con số RPC vừa ghi để client dựng thông báo xác nhận từ đó,
 * không phải từ giá trị người dùng vừa gõ (05-giao-dien.md §"Xác nhận thao tác").
 */

const INVALID = "Dữ liệu nhập chưa hợp lệ. Kiểm tra lại các ô đã nhập.";
const NO_SHIFT = "Chưa mở ca, hoặc ca vừa bị người khác đóng. Tải lại trang.";

export interface OpenShiftOutcome {
  openingFloat: number;
  redirectTo: string;
}

export async function openShift(
  input: unknown,
  next: string
): Promise<ActionResult<OpenShiftOutcome>> {
  const parsed = openShiftFormSchema.safeParse(input);
  if (!parsed.success) return actionError(INVALID);

  const session = await requireStore();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("rpc_open_shift", {
    p_payload: { store_id: session.storeId, opening_float: parsed.data.openingFloat },
  });
  if (error !== null) return actionError(rpcErrorMessage(error));

  const result = openShiftResultSchema.parse(data);
  revalidatePath("/", "layout");
  return actionOk({ openingFloat: result.opening_float, redirectTo: safeNext(next) });
}

export interface CloseShiftOutcome {
  expectedCash: number;
  countedCash: number;
  variance: number;
  heldOrders: number;
  redirectTo: string;
}

export async function closeShift(input: unknown): Promise<ActionResult<CloseShiftOutcome>> {
  const parsed = closeShiftFormSchema.safeParse(input);
  if (!parsed.success) return actionError(INVALID);

  const session = await requireStore();
  const state = await getCurrentShift(session.storeId);
  if (!state.has_open_shift) return actionError(NO_SHIFT);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rpc_close_shift", {
    p_payload: {
      shift_id: state.shift_id,
      counted_cash: parsed.data.countedCash,
      note: parsed.data.note ?? null,
    },
  });
  if (error !== null) return actionError(rpcErrorMessage(error));

  // Parse để lỗi nổ ngay nếu payload của RPC đổi, chứ không im lặng ở màn kết quả.
  const result = closeShiftResultSchema.parse(data);
  revalidatePath("/", "layout");

  return actionOk({
    expectedCash: result.expected_cash,
    countedCash: result.counted_cash,
    variance: result.variance,
    heldOrders: result.held_orders,
    redirectTo: `/ca/ket-qua?shift=${result.shift_id}`,
  });
}

export interface CashTxnOutcome {
  /** Số tiền server ĐÃ LƯU, không phải số vừa gõ. Hai thứ khác nhau khi `duplicate`. */
  amount: number;
  type: "in" | "out";
  duplicate: boolean;
  expectedCash: number;
}

/**
 * `clientUuid` do client sinh MỘT LẦN cho mỗi lần người dùng định lập phiếu, và
 * giữ nguyên qua mọi lần thử lại. Server sinh hộ thì bấm đúp sẽ ra hai phiếu và
 * tiền két sai âm thầm — đúng thứ `uq_cash_transactions_client_uuid` sinh ra để chặn.
 */
export async function createCashTxn(
  input: unknown,
  clientUuid: string
): Promise<ActionResult<CashTxnOutcome>> {
  const parsed = cashTxnFormSchema.safeParse(input);
  if (!parsed.success) return actionError(INVALID);
  if (!UUID_RE.test(clientUuid)) return actionError(INVALID);

  const session = await requireStore();
  const state = await getCurrentShift(session.storeId);
  if (!state.has_open_shift) return actionError(NO_SHIFT);

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
  if (error !== null) return actionError(rpcErrorMessage(error));

  const result = cashTxnResultSchema.parse(data);
  revalidatePath("/", "layout");
  return actionOk({
    amount: result.amount,
    type: result.type,
    duplicate: result.duplicate,
    expectedCash: result.expected_cash,
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chỉ nhận đường dẫn nội bộ: `next` đến từ query string, tức là từ người dùng. */
function safeNext(next: string): string {
  return next.startsWith("/") && !next.startsWith("//") ? next : "/ban-hang";
}
