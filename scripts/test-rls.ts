import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { withDb } from "./lib/db";
import { requireEnv } from "./lib/env";
import { OWNER, STAFF_CH1, STAFF_CH2, type SeedUser } from "./lib/seed-users";

/**
 * Chứng minh RLS thật sự tách dữ liệu giữa 2 cửa hàng — đủ 7 mục ở
 * `docs/spec/02-phan-quyen.md` §5.
 *
 * Mọi khẳng định đi qua PostgREST bằng JWT THẬT của từng user, lấy từ
 * signInWithPassword với anon key. TUYỆT ĐỐI không dùng service_role: role đó có
 * BYPASSRLS nên mọi khẳng định cách ly sẽ đúng một cách vô nghĩa.
 *
 * Riêng mục "UPDATE stock_ledger bị từ chối với MỌI role" còn kiểm tra thêm qua
 * kết nối Postgres trực tiếp (chạy dưới quyền `postgres`, chủ sở hữu bảng) — đó
 * là ca mà chỉ REVOKE thì sẽ trượt và chỉ trigger mới chặn được.
 */

let pass = 0;
let fail = 0;

function ok(name: string, detail = ""): void {
  pass += 1;
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function bad(name: string, detail = ""): void {
  fail += 1;
  console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
}

interface Fixture {
  ch1: string;
  ch2: string;
  ch2OrderId: string;
  ch2PriceItemId: string;
  ledgerId: string;
  tables: string[];
}

async function loadFixture(): Promise<Fixture> {
  return withDb(async (c) => {
    const one = async (sql: string): Promise<string> => {
      const r = await c.query<{ v: string }>(sql);
      const v = r.rows[0]?.v;
      if (v === undefined) throw new Error(`Truy vấn không trả về dòng nào: ${sql}`);
      return v;
    };
    const tables = await c.query<{ tablename: string }>(
      `select tablename from pg_tables where schemaname = 'public' order by tablename`
    );
    return {
      ch1: await one(`select id::text as v from public.stores where code = 'CH1'`),
      ch2: await one(`select id::text as v from public.stores where code = 'CH2'`),
      ch2OrderId: await one(
        `select o.id::text as v from public.orders o
         join public.stores s on s.id = o.store_id where s.code = 'CH2' limit 1`
      ),
      ch2PriceItemId: await one(
        `select pli.id::text as v from public.price_list_items pli
         join public.stores s on s.id = pli.store_id where s.code = 'CH2' limit 1`
      ),
      ledgerId: await one(`select id::text as v from public.stock_ledger limit 1`),
      tables: tables.rows.map((r) => r.tablename),
    };
  });
}

function anonClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function signIn(user: SeedUser): Promise<SupabaseClient> {
  const client = anonClient();
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) {
    throw new Error(
      `Không đăng nhập được ${user.email}: ${error.message}. Đã chạy pnpm db:seed chưa?`
    );
  }
  return client;
}

/** Lỗi PostgREST gần nhất, để chẩn đoán khi countRows trả về -1. */
let lastError = "";

/**
 * Đếm số dòng đọc được của một bảng, lọc theo cửa hàng nếu có.
 * Trả về -1 khi bị từ chối ở tầng quyền — khác hẳn 0, nghĩa là đọc được nhưng
 * RLS không cho thấy dòng nào.
 */
async function countRows(
  client: SupabaseClient,
  table: string,
  storeId?: string
): Promise<number> {
  let query = client.from(table).select("*");
  if (storeId !== undefined) query = query.eq("store_id", storeId);
  const { data, error } = await query.limit(2000);
  if (error) {
    lastError = `${table}: ${error.code ?? "?"} ${error.message}`;
    return -1;
  }
  return data.length;
}

async function main(): Promise<void> {
  const fx = await loadFixture();
  const owner = await signIn(OWNER);
  const staff1 = await signIn(STAFF_CH1);
  const staff2 = await signIn(STAFF_CH2);

  // ── 1. staff CH1 không đọc được orders của CH2 ───────────────────────────
  console.log("\n1. Tách dữ liệu đơn hàng");
  const ch1OrdersSeenByStaff1 = await countRows(staff1, "orders", fx.ch1);
  const ch2OrdersSeenByStaff1 = await countRows(staff1, "orders", fx.ch2);
  if (ch1OrdersSeenByStaff1 > 0 && ch2OrdersSeenByStaff1 === 0) {
    ok("staff CH1 thấy đơn CH1 nhưng KHÔNG thấy đơn CH2",
      `${String(ch1OrdersSeenByStaff1)} / 0`);
  } else {
    bad("staff CH1 thấy đơn CH1 nhưng KHÔNG thấy đơn CH2",
      `CH1=${String(ch1OrdersSeenByStaff1)}, CH2=${String(ch2OrdersSeenByStaff1)} · ${lastError}`);
  }

  const ch1OrdersSeenByStaff2 = await countRows(staff2, "orders", fx.ch1);
  if (ch1OrdersSeenByStaff2 === 0) ok("staff CH2 không thấy đơn CH1");
  else bad("staff CH2 không thấy đơn CH1", `thấy ${String(ch1OrdersSeenByStaff2)} dòng`);

  // Đọc thẳng bằng id cụ thể, không qua bộ lọc store_id
  const direct = await staff1.from("orders").select("id").eq("id", fx.ch2OrderId);
  if ((direct.data?.length ?? 0) === 0) ok("staff CH1 đọc đơn CH2 theo id → rỗng");
  else bad("staff CH1 đọc đơn CH2 theo id → rỗng", `trả về ${String(direct.data?.length)} dòng`);

  // ── 2. staff CH1 không đọc được stock_balances của CH2 ───────────────────
  console.log("\n2. Tách dữ liệu tồn kho");
  const ch1Stock = await countRows(staff1, "stock_balances", fx.ch1);
  const ch2Stock = await countRows(staff1, "stock_balances", fx.ch2);
  if (ch1Stock > 0 && ch2Stock === 0) {
    ok("staff CH1 thấy tồn CH1 nhưng KHÔNG thấy tồn CH2", `${String(ch1Stock)} / 0`);
  } else {
    bad("staff CH1 thấy tồn CH1 nhưng KHÔNG thấy tồn CH2",
      `CH1=${String(ch1Stock)}, CH2=${String(ch2Stock)}`);
  }

  const ch2Ledger = await countRows(staff1, "stock_ledger", fx.ch2);
  if (ch2Ledger === 0) ok("staff CH1 không thấy sổ kho CH2");
  else bad("staff CH1 không thấy sổ kho CH2", `thấy ${String(ch2Ledger)} dòng`);

  // ── 3. staff không sửa được price_list_items ─────────────────────────────
  console.log("\n3. Bảng giá chỉ owner sửa được");
  const priceUpd = await staff2
    .from("price_list_items")
    .update({ price_per_base_unit: 1 })
    .eq("id", fx.ch2PriceItemId)
    .select();
  if (priceUpd.error !== null || (priceUpd.data?.length ?? 0) === 0) {
    ok("staff sửa price_list_items → không đổi được dòng nào",
      priceUpd.error?.code ?? "0 dòng bị ảnh hưởng");
  } else {
    bad("staff sửa price_list_items → không đổi được dòng nào", "SỬA ĐƯỢC");
  }

  const priceIns = await staff2.from("price_list_items").insert({
    store_id: fx.ch2,
    price_list_id: "00000000-0000-0000-0000-000000000000",
    product_id: "00000000-0000-0000-0000-000000000000",
    price_per_base_unit: 1,
  });
  if (priceIns.error !== null) ok("staff thêm price_list_items → bị từ chối", priceIns.error.code);
  else bad("staff thêm price_list_items → bị từ chối", "THÊM ĐƯỢC");

  // ── 4. INSERT trực tiếp vào orders bị từ chối với mọi role ───────────────
  console.log("\n4. Bảng giao dịch chỉ ghi qua RPC");
  for (const [label, client] of [
    ["staff", staff1],
    ["owner", owner],
  ] as const) {
    const res = await client.from("orders").insert({
      client_uuid: crypto.randomUUID(),
      store_id: fx.ch1,
      shift_id: "00000000-0000-0000-0000-000000000000",
      price_list_id: "00000000-0000-0000-0000-000000000000",
      order_kind: "retail",
    });
    if (res.error !== null) ok(`${label} INSERT thẳng vào orders → bị từ chối`, res.error.code);
    else bad(`${label} INSERT thẳng vào orders → bị từ chối`, "GHI ĐƯỢC");
  }

  // ── 5. UPDATE / DELETE stock_ledger bị từ chối với MỌI role ──────────────
  console.log("\n5. Sổ kho chỉ ghi thêm");
  const ledgerUpd = await owner
    .from("stock_ledger")
    .update({ qty_base: 999 })
    .eq("id", fx.ledgerId);
  if (ledgerUpd.error !== null) ok("owner UPDATE stock_ledger → bị từ chối", ledgerUpd.error.code);
  else bad("owner UPDATE stock_ledger → bị từ chối", "SỬA ĐƯỢC");

  const ledgerDel = await owner.from("stock_ledger").delete().eq("id", fx.ledgerId);
  if (ledgerDel.error !== null) ok("owner DELETE stock_ledger → bị từ chối", ledgerDel.error.code);
  else bad("owner DELETE stock_ledger → bị từ chối", "XOÁ ĐƯỢC");

  // Đây là ca REVOKE không đỡ nổi: `postgres` là chủ bảng, chỉ trigger mới chặn.
  await withDb(async (c) => {
    await c.query("begin");
    for (const op of [
      `update public.stock_ledger set qty_base = 999 where id = '${fx.ledgerId}'`,
      `delete from public.stock_ledger where id = '${fx.ledgerId}'`,
      `truncate public.stock_ledger`,
    ]) {
      await c.query("savepoint sp");
      try {
        await c.query(op);
        await c.query("rollback to savepoint sp");
        bad(`postgres: ${op.split(" ").slice(0, 2).join(" ")} stock_ledger → bị từ chối`, "LỌT");
      } catch (e) {
        await c.query("rollback to savepoint sp");
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("chỉ được ghi thêm")) {
          ok(`postgres: ${op.split(" ").slice(0, 2).join(" ")} stock_ledger → bị từ chối`);
        } else {
          bad(`postgres: ${op.split(" ").slice(0, 2).join(" ")} stock_ledger → bị từ chối`, msg);
        }
      }
    }
    await c.query("rollback");
  });

  // ── 6. owner đọc được cả 2 cửa hàng ──────────────────────────────────────
  console.log("\n6. Owner xem được cả 2 cửa hàng");
  const ownerCh1 = await countRows(owner, "orders", fx.ch1);
  const ownerCh2 = await countRows(owner, "orders", fx.ch2);
  if (ownerCh1 > 0 && ownerCh2 > 0) {
    ok("owner đọc được đơn của cả CH1 lẫn CH2", `${String(ownerCh1)} / ${String(ownerCh2)}`);
  } else {
    bad("owner đọc được đơn của cả CH1 lẫn CH2",
      `CH1=${String(ownerCh1)}, CH2=${String(ownerCh2)}`);
  }

  const ownerStores = await countRows(owner, "stores");
  if (ownerStores === 2) ok("owner thấy đúng 2 cửa hàng");
  else bad("owner thấy đúng 2 cửa hàng", `thấy ${String(ownerStores)}`);

  const staffStores = await countRows(staff1, "stores");
  if (staffStores === 1) ok("staff chỉ thấy 1 cửa hàng");
  else bad("staff chỉ thấy 1 cửa hàng", `thấy ${String(staffStores)}`);

  // ── 7. anon không đọc được bất kỳ bảng nào ───────────────────────────────
  console.log("\n7. Chưa đăng nhập thì không đọc được gì");
  const anon = anonClient();
  const leaked: string[] = [];
  for (const table of fx.tables) {
    const n = await countRows(anon, table);
    if (n > 0) leaked.push(`${table} (${String(n)})`);
  }
  if (leaked.length === 0) {
    ok(`anon không đọc được dòng nào trong cả ${String(fx.tables.length)} bảng`);
  } else {
    bad("anon không đọc được dòng nào", `RÒ RỈ: ${leaked.join(", ")}`);
  }

  const anonRpc = await anon.rpc("rpc_rebuild_stock_balances", { p_store: fx.ch1 });
  if (anonRpc.error !== null) ok("anon gọi RPC → bị từ chối", anonRpc.error.code);
  else bad("anon gọi RPC → bị từ chối", "GỌI ĐƯỢC");

  // ── 8. Ca làm việc và quỹ tiền mặt (0014) ────────────────────────────────
  //
  // Không mở ca thật ở đây: test này chạy trên database dev có dữ liệu, và
  // ux_cash_shifts_one_open_store sẽ chặn ca thật của người đang dùng máy. Chỉ
  // khẳng định các nhánh TỪ CHỐI — nhánh thành công đã đi qua giao diện.
  console.log("\n8. Ca làm việc: cách ly cửa hàng và cấm ghi thẳng");

  const shiftsCh2AsStaff1 = await countRows(staff1, "cash_shifts", fx.ch2);
  if (shiftsCh2AsStaff1 === 0) ok("staff CH1 không đọc được ca của CH2");
  else bad("staff CH1 không đọc được ca của CH2", `thấy ${String(shiftsCh2AsStaff1)}`);

  const txnCh2AsStaff1 = await countRows(staff1, "cash_transactions", fx.ch2);
  if (txnCh2AsStaff1 === 0) ok("staff CH1 không đọc được phiếu thu/chi của CH2");
  else bad("staff CH1 không đọc được phiếu thu/chi của CH2", `thấy ${String(txnCh2AsStaff1)}`);

  const directShift = await staff1
    .from("cash_shifts")
    .insert({ store_id: fx.ch1, user_id: "00000000-0000-4000-8000-000000000000", opening_float: 1 });
  if (directShift.error !== null) {
    ok("INSERT thẳng vào cash_shifts → bị từ chối", directShift.error.code);
  } else {
    bad("INSERT thẳng vào cash_shifts → bị từ chối", "GHI ĐƯỢC");
  }

  const crossStore = await staff1.rpc("rpc_open_shift", {
    p_payload: { store_id: fx.ch2, opening_float: 1000 },
  });
  if (crossStore.error?.message === "PERMISSION_DENIED") {
    ok("staff CH1 mở ca ở CH2 → PERMISSION_DENIED");
  } else {
    bad("staff CH1 mở ca ở CH2 → PERMISSION_DENIED", crossStore.error?.message ?? "MỞ ĐƯỢC");
  }

  // fn_shift_expected_cash nhận shift_id và trả số tiền. Gọi thẳng được nghĩa là
  // đọc được tiền két của cửa hàng khác — 0014 revoke đúng vì lý do này.
  const directFn = await staff1.rpc("fn_shift_expected_cash", {
    p_shift: "00000000-0000-4000-8000-000000000000",
  });
  if (directFn.error !== null) {
    ok("authenticated không gọi thẳng được fn_shift_expected_cash", directFn.error.code);
  } else {
    bad("authenticated không gọi thẳng được fn_shift_expected_cash", "GỌI ĐƯỢC");
  }

  for (const fn of ["rpc_open_shift", "rpc_close_shift", "rpc_cash_txn", "rpc_current_shift"]) {
    const r = await anon.rpc(fn, { p_payload: { store_id: fx.ch1 } });
    if (r.error !== null) ok(`anon gọi ${fn} → bị từ chối`, r.error.code);
    else bad(`anon gọi ${fn} → bị từ chối`, "GỌI ĐƯỢC");
  }

  console.log(`\n${String(pass)} pass, ${String(fail)} fail`);
  if (fail > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
