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

const UOM_CHUC = "66666666-6666-6666-6666-666666666666";
const STORE_A = "77777777-7777-7777-7777-777777777777";
const STORE_B = "88888888-8888-8888-8888-888888888888";
const LIST_A = "99999999-9999-9999-9999-999999999999";
const LIST_B = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PROD_50 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const FIXTURE = `
insert into public.item_groups (id, code, name) values ('${GROUP}', 'ZZTEST', 'Nhóm thử');
insert into public.uoms (id, code, name) values
  ('${UOM_CAI}', 'ZZCAI', 'Cái'),
  ('${UOM_CHUC}', 'ZZCHUC', 'Chục'),
  ('${UOM_THUNG}', 'ZZTHUNG', 'Thùng');
insert into public.stores (id, code, name) values
  ('${STORE_A}', 'ZZCH1', 'Cửa hàng thử 1'),
  ('${STORE_B}', 'ZZCH2', 'Cửa hàng thử 2');
insert into public.price_lists (id, store_id, name, kind, is_default) values
  ('${LIST_A}', '${STORE_A}', 'ZZ CH1 lẻ', 'retail', false),
  ('${LIST_B}', '${STORE_B}', 'ZZ CH2 lẻ', 'retail', false);
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

/**
 * Quy đổi giá theo đơn vị — acceptance criteria của Phase 3, viết bằng số cụ thể.
 *
 * Giá gắn ở SẢN PHẨM, không gắn ở biến thể, nên 3 màu phải cho ra CÙNG một giá
 * thùng. Đây là khẳng định tự động thay cho việc mở màn hình lên nhìn: lỗi quy
 * đổi đơn vị mà chỉ kiểm bằng mắt thì tới Phase 5 mới lộ, lúc đó nó đã đi vào
 * đơn hàng thật.
 *
 * Dựng dữ liệu riêng thay vì đọc TH40 của seed: một khẳng định phụ thuộc vào nội
 * dung seed sẽ hỏng vu vơ mỗi lần seed đổi, và nó kiểm phép nhân chứ không kiểm
 * seed.
 */
async function runPriceChecks(c: Client): Promise<void> {
  console.log("\nBảng giá — quy đổi theo đơn vị lớn");

  await c.query(`
    insert into public.products (id, sku, name, item_group_id, base_uom_id)
      values ('${PROD_50}', 'ZZTH50', 'Thau nhựa thử 50cm', '${GROUP}', '${UOM_CAI}');
    insert into public.product_uoms (product_id, uom_id, factor) values
      ('${PROD_50}', '${UOM_CAI}', 1),
      ('${PROD_50}', '${UOM_CHUC}', 10),
      ('${PROD_50}', '${UOM_THUNG}', 12);
    insert into public.product_variants (product_id, variant_code, attr_color, is_default) values
      ('${PROD_50}', 'ZZTH50-XD', 'Xanh dương', true),
      ('${PROD_50}', 'ZZTH50-D', 'Đỏ', false),
      ('${PROD_50}', 'ZZTH50-LM', 'Lá mạ', false);
    insert into public.price_list_items (store_id, price_list_id, product_id, price_per_base_unit)
      values ('${STORE_A}', '${LIST_A}', '${PROD_50}', 40000);
  `);
  await c.query("set constraints all immediate");

  // Giá thùng của TỪNG biến thể: cùng một phép nhân 40.000 × 12, lặp lại 3 lần.
  const perVariant = await c.query<{ variant_code: string; price: string }>(
    `select pv.variant_code, (cp.price_per_base_unit * pu.factor)::text as price
       from public.product_variants pv
       join public.product_uoms pu on pu.product_id = pv.product_id
       join public.uoms u on u.id = pu.uom_id and u.code = 'ZZTHUNG'
       join public.v_current_prices cp
         on cp.product_id = pv.product_id and cp.price_list_id = '${LIST_A}'
      where pv.product_id = '${PROD_50}'
      order by pv.variant_code`
  );

  const prices = perVariant.rows.map((r) => r.price);
  if (prices.length === 3 && prices.every((p) => Number(p) === 480000)) {
    ok("giá lẻ 40.000 × hệ số thùng 12 = 480.000 cho cả 3 biến thể", prices.join(" / "));
  } else {
    bad(
      "giá lẻ 40.000 × hệ số thùng 12 = 480.000 cho cả 3 biến thể",
      `nhận được ${prices.length === 0 ? "0 dòng" : prices.join(" / ")}`
    );
  }

  const perUnit = await c.query<{ code: string; price: string }>(
    `select u.code, (cp.price_per_base_unit * pu.factor)::text as price
       from public.product_uoms pu
       join public.uoms u on u.id = pu.uom_id
       join public.v_current_prices cp
         on cp.product_id = pu.product_id and cp.price_list_id = '${LIST_A}'
      where pu.product_id = '${PROD_50}'
      order by pu.factor`
  );
  const expected = [
    ["ZZCAI", 40000],
    ["ZZCHUC", 400000],
    ["ZZTHUNG", 480000],
  ] as const;
  const matched = expected.every(
    ([code, value], i) => perUnit.rows[i]?.code === code && Number(perUnit.rows[i]?.price) === value
  );
  if (matched) ok("40.000/cái · 400.000/chục · 480.000/thùng");
  else bad("40.000/cái · 400.000/chục · 480.000/thùng", JSON.stringify(perUnit.rows));

  // Đặt giá ở cửa hàng thứ hai KHÔNG được đụng tới giá cửa hàng thứ nhất.
  await c.query(
    `insert into public.price_list_items (store_id, price_list_id, product_id, price_per_base_unit)
     values ('${STORE_B}', '${LIST_B}', '${PROD_50}', 42000)`
  );
  const isolated = await c.query<{ list: string; price: string }>(
    `select price_list_id::text as list, price_per_base_unit::text as price
       from public.v_current_prices where product_id = '${PROD_50}' order by price_per_base_unit`
  );
  if (
    isolated.rows.length === 2 &&
    Number(isolated.rows[0]?.price) === 40000 &&
    Number(isolated.rows[1]?.price) === 42000
  ) {
    ok("đặt giá 42.000 ở cửa hàng 2 → cửa hàng 1 vẫn 40.000");
  } else {
    bad("đặt giá 42.000 ở cửa hàng 2 → cửa hàng 1 vẫn 40.000", JSON.stringify(isolated.rows));
  }

  // Sửa giá là THÊM DÒNG, không update. Dòng cũ phải còn nguyên trong lịch sử.
  await c.query(
    `insert into public.price_list_items (store_id, price_list_id, product_id, price_per_base_unit)
     values ('${STORE_A}', '${LIST_A}', '${PROD_50}', 45000)`
  );
  const history = await c.query<{ n: string }>(
    `select count(*)::text as n from public.price_list_items
      where product_id = '${PROD_50}' and price_list_id = '${LIST_A}'`
  );
  const current = await c.query<{ price: string }>(
    `select price_per_base_unit::text as price from public.v_current_prices
      where product_id = '${PROD_50}' and price_list_id = '${LIST_A}'`
  );
  if (history.rows[0]?.n === "2" && Number(current.rows[0]?.price) === 45000) {
    ok("đổi giá thêm dòng mới, giá cũ vẫn còn trong lịch sử", "2 dòng, hiệu lực 45.000");
  } else {
    bad(
      "đổi giá thêm dòng mới, giá cũ vẫn còn trong lịch sử",
      `${String(history.rows[0]?.n)} dòng, hiệu lực ${String(current.rows[0]?.price)}`
    );
  }
}

/** Ràng buộc mà RPC danh mục ở 0016 dựa vào để từ chối xoá. */
async function runDeleteGuardChecks(c: Client): Promise<void> {
  console.log("\nDanh mục — chặn xoá khi còn tham chiếu");

  await expectBlocked(
    c,
    "xoá nhóm hàng còn sản phẩm → bị chặn",
    `delete from public.item_groups where id = '${GROUP}';`,
    "products_item_group_id_fkey"
  );

  await expectBlocked(
    c,
    "xoá sản phẩm đang có dòng bảng giá → bị chặn",
    `delete from public.products where id = '${PROD_50}';`,
    "price_list_items_product_id_fkey"
  );

  await expectBlocked(
    c,
    "mã vạch trùng giữa hai biến thể → bị chặn",
    `insert into public.product_barcodes (variant_id, barcode, source)
     select id, 'ZZBARCODE1', 'internal' from public.product_variants
      where variant_code in ('ZZTH50-XD', 'ZZTH50-D');`,
    "product_barcodes_barcode_key"
  );

  const seq = await c.query<{ code: string }>(
    `select 'NS' || lpad(nextval('public.seq_internal_barcode')::text, 8, '0') as code`
  );
  const code = seq.rows[0]?.code ?? "";
  if (/^NS\d{8}$/.test(code)) ok("seq_internal_barcode sinh đúng dạng NS########", code);
  else bad("seq_internal_barcode sinh đúng dạng NS########", code);
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
      await runPriceChecks(c);
      await runDeleteGuardChecks(c);
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
