import type { Client } from "pg";
import { withDb } from "./lib/db";

/**
 * Kiểm tra các ràng buộc BẮT BUỘC nằm ở tầng database (phase-1.md §3).
 *
 * Toàn bộ chạy trong một transaction và luôn rollback ở cuối — không để lại
 * dữ liệu rác trên database dev.
 *
 * Chạy: pnpm test:schema  (cần SUPABASE_DB_URL trong .env.local)
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

/** Khẳng định khối SQL chạy lọt. */
async function expectOk(c: Client, name: string, sql: string): Promise<void> {
  const err = await attempt(c, sql);
  if (err === null) ok(name);
  else bad(name, err);
}

/** Khẳng định khối SQL bị chặn, và thông báo lỗi chứa `needle`. */
async function expectBlocked(
  c: Client,
  name: string,
  sql: string,
  needle: string
): Promise<void> {
  const err = await attempt(c, sql);
  if (err === null) bad(name, "không bị chặn");
  else if (!err.includes(needle)) bad(name, `bị chặn nhưng sai lý do: ${err}`);
  else ok(name);
}

/**
 * Chạy SQL trong savepoint, ÉP kiểm tra deferred constraint, rồi luôn rollback.
 *
 * `set constraints all immediate` là bắt buộc: RELEASE SAVEPOINT KHÔNG kích hoạt
 * constraint trigger đang deferred — chỉ COMMIT hoặc lệnh này mới làm được.
 * Đây đúng là cơ chế RPC danh mục ở Phase 3 phải dùng để bắt lỗi và dịch sang
 * thông báo cho người dùng.
 */
async function attempt(c: Client, sql: string): Promise<string | null> {
  await c.query("savepoint sp");
  try {
    await c.query(sql);
    await c.query("set constraints all immediate");
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  } finally {
    await c.query("rollback to savepoint sp");
  }
}

const GROUP = "11111111-1111-1111-1111-111111111111";
const UOM_CAI = "22222222-2222-2222-2222-222222222222";
const UOM_THUNG = "33333333-3333-3333-3333-333333333333";
const PROD = "44444444-4444-4444-4444-444444444444";

const FIXTURE = `
insert into public.item_groups (id, code, name) values ('${GROUP}', 'ZZTEST', 'Nhóm thử');
insert into public.uoms (id, code, name) values
  ('${UOM_CAI}', 'ZZCAI', 'Cái'),
  ('${UOM_THUNG}', 'ZZTHUNG', 'Thùng');
`;

const PRODUCT = `
insert into public.products (id, sku, name, item_group_id, base_uom_id)
values ('${PROD}', 'ZZTH40', 'Thau nhựa Duy Thành 40cm', '${GROUP}', '${UOM_CAI}');
insert into public.product_uoms (product_id, uom_id, factor) values ('${PROD}', '${UOM_CAI}', 1);
`;

const DEFAULT_VARIANT = `
insert into public.product_variants (product_id, variant_code, attr_color, is_default)
values ('${PROD}', 'ZZTH40-XD', 'Xanh dương', true);
`;

async function runCatalogChecks(c: Client): Promise<void> {
  console.log("\nDanh mục — ràng buộc biến thể và đơn vị");

  await expectBlocked(
    c,
    "products không có biến thể mặc định → bị chặn",
    PRODUCT,
    "biến thể mặc định"
  );

  await expectOk(
    c,
    "products + biến thể mặc định + base uom → ghi được",
    PRODUCT + DEFAULT_VARIANT
  );

  // Ghi thật làm nền cho các khẳng định phía sau.
  await c.query(PRODUCT + DEFAULT_VARIANT);

  const norm = await c.query<{ name_normalized: string }>(
    `select name_normalized from public.products where sku = 'ZZTH40'`
  );
  const value = norm.rows[0]?.name_normalized;
  if (value === "thau nhua duy thanh 40cm") {
    ok("fn_unaccent_lower trong generated column", `"${value}"`);
  } else {
    bad("fn_unaccent_lower trong generated column", `nhận được "${String(value)}"`);
  }

  // Neo vào đúng dòng fixture, KHÔNG đếm toàn bảng: seed có sản phẩm thật cũng
  // khớp chuỗi này, và một test phụ thuộc vào nội dung seed sẽ hỏng vu vơ.
  const search = await c.query<{ n: string }>(
    `select count(*)::text as n from public.products
     where sku = 'ZZTH40' and name_normalized like '%nhua duy thanh 40cm%'`
  );
  if (search.rows[0]?.n === "1") ok("tìm kiếm bỏ dấu khớp đúng dòng fixture");
  else bad("tìm kiếm bỏ dấu khớp đúng dòng fixture", `count = ${String(search.rows[0]?.n)}`);

  await expectBlocked(
    c,
    "biến thể mặc định thứ 2 → bị chặn",
    `insert into public.product_variants (product_id, variant_code, is_default)
     values ('${PROD}', 'ZZTH40-D', true);`,
    "ux_product_variants_one_default"
  );

  await expectOk(
    c,
    "biến thể thứ 2 không mặc định → cho phép",
    `insert into public.product_variants (product_id, variant_code, attr_color, is_default)
     values ('${PROD}', 'ZZTH40-D', 'Đỏ', false);`
  );

  await expectBlocked(
    c,
    "xoá biến thể mặc định duy nhất → bị chặn",
    `delete from public.product_variants where variant_code = 'ZZTH40-XD';`,
    "biến thể mặc định"
  );

  // Xoá cả sản phẩm thì cascade xoá biến thể — trigger phải bỏ qua, không báo lỗi giả.
  await expectOk(
    c,
    "xoá sản phẩm kèm cascade biến thể → cho phép",
    `delete from public.products where sku = 'ZZTH40';`
  );

  await expectBlocked(
    c,
    "product_uoms factor = 1 trỏ sai base_uom → bị chặn",
    `insert into public.products (id, sku, name, item_group_id, base_uom_id)
       values ('55555555-5555-5555-5555-555555555555', 'ZZTH45', 'Thau nhựa 45cm', '${GROUP}', '${UOM_CAI}');
     insert into public.product_uoms (product_id, uom_id, factor)
       values ('55555555-5555-5555-5555-555555555555', '${UOM_THUNG}', 1);
     insert into public.product_variants (product_id, variant_code, is_default)
       values ('55555555-5555-5555-5555-555555555555', 'ZZTH45-DEF', true);`,
    "factor = 1"
  );
}

async function runViewChecks(c: Client): Promise<void> {
  console.log("\nView — bắt buộc security_invoker");

  const views = await c.query<{ relname: string; opts: string | null }>(
    `select c.relname, array_to_string(c.reloptions, ',') as opts
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'v'
     order by c.relname`
  );

  if (views.rows.length === 0) {
    bad("có ít nhất 1 view để kiểm tra", "không tìm thấy view nào trong schema public");
    return;
  }

  for (const v of views.rows) {
    // Thiếu security_invoker là staff cửa hàng A đọc được dữ liệu cửa hàng B
    // xuyên qua RLS, vì view do postgres tạo chạy bằng quyền chủ view.
    if (v.opts?.includes("security_invoker=true")) {
      ok(`view ${v.relname} có security_invoker=true`);
    } else {
      bad(`view ${v.relname} có security_invoker=true`, `reloptions = ${String(v.opts)}`);
    }
  }
}

async function main(): Promise<void> {
  await withDb(async (c) => {
    await c.query("begin");
    try {
      await c.query(FIXTURE);
      await runCatalogChecks(c);
      await runViewChecks(c);
    } finally {
      await c.query("rollback");
    }
  });

  console.log(`\n${String(pass)} pass, ${String(fail)} fail`);
  if (fail > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
