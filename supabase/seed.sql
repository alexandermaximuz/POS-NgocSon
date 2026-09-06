-- seed.sql — dữ liệu mẫu cho môi trường DEV. Không bao giờ chạy trên production.
--
-- Chạy bằng `pnpm db:seed`, sau khi script đó đã tạo 3 user trong auth.users.
--
-- File này KHÔNG idempotent một cách có chủ đích: stock_ledger có trigger cấm
-- UPDATE/DELETE/TRUNCATE với mọi role, nên không thể dọn dữ liệu cũ rồi seed lại.
-- Muốn seed lại từ đầu: `drop schema public cascade; create schema public;`
-- rồi `pnpm db:push && pnpm db:seed`.

do $$
begin
  if exists (select 1 from public.stores) then
    raise exception
      'Database đã có dữ liệu. Muốn seed lại: drop schema public cascade; create schema public; rồi pnpm db:push && pnpm db:seed.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Cửa hàng
-- ---------------------------------------------------------------------------
insert into public.stores (code, name, address, phone, receipt_footer, return_window_days)
values
  ('CH1', 'Ngọc Sơn 1', '124 Trần Hưng Đạo, TP. Quy Nhơn', '0256 382 1234',
   'Cảm ơn quý khách. Đổi trả trong 30 ngày kèm hoá đơn.', 30),
  ('CH2', 'Ngọc Sơn 2', '57 Nguyễn Thái Học, TP. Quy Nhơn', '0256 382 5678',
   'Cảm ơn quý khách. Đổi trả trong 30 ngày kèm hoá đơn.', 30);

-- ---------------------------------------------------------------------------
-- Hồ sơ người dùng.
--
-- Bình thường trg_auth_user_created (0002) lo việc này. Nhưng nó chỉ chạy lúc
-- INSERT vào auth.users, mà auth.users KHÔNG bị xoá khi seed lại bằng
-- `drop schema public cascade` — chỉ public.profiles và chính cái trigger đó bị
-- xoá. Lần push tiếp theo dựng lại trigger, còn ba user cũ thì vĩnh viễn không có
-- profile, vì db-seed.ts thấy user đã tồn tại nên không tạo lại.
--
-- Hậu quả không hiện ra ngay: mọi chỗ hiển thị tên người dùng (topbar "người trực"
-- ở Phase 2) rơi về NULL. Backfill ở đây để seed tự chữa, không phụ thuộc vào việc
-- user được tạo trước hay sau lần push nào.
-- ---------------------------------------------------------------------------
insert into public.profiles (id, full_name, phone)
select u.id,
       nullif(u.raw_user_meta_data ->> 'full_name', ''),
       nullif(u.raw_user_meta_data ->> 'phone', '')
from auth.users u
on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      phone     = coalesce(excluded.phone, public.profiles.phone);

-- ---------------------------------------------------------------------------
-- Gán vai trò. User do scripts/db-seed.ts tạo trước qua Auth Admin API.
-- ---------------------------------------------------------------------------
insert into public.store_members (store_id, user_id, role)
select s.id, u.id, m.role::public.store_role
from (values
  ('owner@ngocson.local',  'CH1', 'owner'),
  ('owner@ngocson.local',  'CH2', 'owner'),
  ('staff1@ngocson.local', 'CH1', 'staff'),
  ('staff2@ngocson.local', 'CH2', 'staff')
) as m(email, store_code, role)
join auth.users u on u.email = m.email
join public.stores s on s.code = m.store_code;

do $$
begin
  if (select count(*) from public.store_members) <> 4 then
    raise exception
      'Thiếu user trong auth.users. Chạy pnpm db:seed (script tạo user trước rồi mới chạy file này), đừng chạy seed.sql trực tiếp.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Nhóm hàng và đơn vị tính
-- ---------------------------------------------------------------------------
insert into public.item_groups (code, name, sort_order) values
  ('NHUA', 'Nhựa gia dụng', 1),
  ('NHOM', 'Nhôm – inox', 2),
  ('TTS',  'Thuỷ tinh – sứ', 3),
  ('KHAC', 'Gia dụng khác', 4);

insert into public.uoms (code, name) values
  ('CAI',   'Cái'),
  ('CHUC',  'Chục'),
  ('THUNG', 'Thùng'),
  ('HOP',   'Hộp'),
  ('BO',    'Bộ'),
  ('CAP',   'Cặp');

-- ---------------------------------------------------------------------------
-- Nhà cung cấp và khách hàng
-- ---------------------------------------------------------------------------
insert into public.suppliers (code, name, phone, address) values
  ('NCC01', 'Nhựa Duy Tân – CN Quy Nhơn', '0283 123 4567', 'KCN Tân Tạo, TP.HCM'),
  ('NCC02', 'Kim Hằng – Đại lý miền Trung', '0236 355 8899', 'Hải Châu, Đà Nẵng'),
  ('NCC03', 'Thuỷ tinh Union – Nhà phân phối', '0274 366 2211', 'Thuận An, Bình Dương');

-- 5 khách sỉ (có công nợ) + 3 khách lẻ quen
insert into public.customers (code, name, phone, address, customer_group) values
  ('KH01', 'Tạp hoá Bà Tư',        '0905 111 222', 'Chợ Đầm, Quy Nhơn',      'wholesale'),
  ('KH02', 'Cửa hàng Minh Phát',   '0905 333 444', 'Chợ Lớn, Quy Nhơn',      'wholesale'),
  ('KH03', 'Tạp hoá Hồng Loan',    '0905 555 666', 'Phù Cát, Bình Định',     'wholesale'),
  ('KH04', 'Đại lý Thanh Bình',    '0905 777 888', 'An Nhơn, Bình Định',     'wholesale'),
  ('KH05', 'Tạp hoá Sáu Nở',       '0905 999 000', 'Tuy Phước, Bình Định',   'wholesale'),
  ('KH06', 'Chị Lan',              '0912 121 212', 'Trần Cao Vân, Quy Nhơn', 'retail'),
  ('KH07', 'Anh Dũng',             '0912 343 434', 'Lê Hồng Phong, Quy Nhơn','retail'),
  ('KH08', 'Cô Bảy',               '0912 565 656', 'Nguyễn Huệ, Quy Nhơn',   'retail');

-- ---------------------------------------------------------------------------
-- 30 sản phẩm
--
-- Bảng tạm giữ cả dữ liệu phái sinh (màu, đơn vị lớn, giá gốc) để các bước sau
-- sinh biến thể, quy đổi đơn vị và bảng giá mà không phải chép tay 4 lần.
-- ---------------------------------------------------------------------------
create temporary table seed_products (
  sku text primary key,
  name text not null,
  group_code text not null,
  base_uom text not null,
  brand text,
  base_price numeric(14, 2) not null,
  colors text[],
  color_codes text[],
  has_bulk_uoms boolean not null default false
) on commit drop;

insert into seed_products
  (sku, name, group_code, base_uom, brand, base_price, colors, color_codes, has_bulk_uoms)
values
  -- Nhựa gia dụng (12)
  ('TH40',   'Thau nhựa Duy Thành 40cm',        'NHUA', 'CAI', 'Duy Thành',  40000,
   array['Xanh dương','Đỏ','Trắng'], array['XD','D','T'], true),
  ('TH45',   'Thau nhựa Duy Thành 45cm',        'NHUA', 'CAI', 'Duy Thành',  52000,
   array['Xanh dương','Đỏ','Trắng'], array['XD','D','T'], true),
  ('RO35',   'Rổ nhựa vuông Duy Tân 35cm',      'NHUA', 'CAI', 'Duy Tân',    28000,
   array['Xanh dương','Đỏ','Trắng'], array['XD','D','T'], true),
  ('GHE01',  'Ghế nhựa thấp Duy Tân',           'NHUA', 'CAI', 'Duy Tân',    35000,
   array['Xanh dương','Đỏ','Trắng'], array['XD','D','T'], true),
  ('GHE02',  'Ghế nhựa cao Duy Tân',            'NHUA', 'CAI', 'Duy Tân',    68000,
   array['Xanh dương','Đỏ','Trắng'], array['XD','D','T'], true),
  ('CHAU25', 'Chậu nhựa tròn 25cm',             'NHUA', 'CAI', 'Duy Thành',  22000,
   array['Xanh dương','Đỏ','Trắng'], array['XD','D','T'], true),
  ('HOP1L',  'Hộp nhựa đựng thực phẩm 1L',      'NHUA', 'CAI', 'Duy Tân',    26000,
   array['Xanh dương','Đỏ','Trắng'], array['XD','D','T'], true),
  ('XO20',   'Xô nhựa có quai 20L',             'NHUA', 'CAI', 'Duy Thành',  58000, null, null, true),
  ('HOP2L',  'Hộp nhựa đựng thực phẩm 2L',      'NHUA', 'CAI', 'Duy Tân',    38000, null, null, true),
  ('KE3T',   'Kệ nhựa 3 tầng Việt Nhật',        'NHUA', 'CAI', 'Việt Nhật', 245000, null, null, false),
  ('SOT30',  'Sọt rác nhựa 30L',                'NHUA', 'CAI', 'Duy Tân',    72000, null, null, false),
  ('MOC10',  'Móc treo quần áo nhựa bộ 10',     'NHUA', 'BO',  'Duy Tân',    32000, null, null, false),

  -- Nhôm – inox (8)
  ('NOI24',   'Nồi nhôm Kim Hằng 24cm',         'NHOM', 'CAI', 'Kim Hằng',  135000, null, null, false),
  ('NOI28',   'Nồi nhôm Kim Hằng 28cm',         'NHOM', 'CAI', 'Kim Hằng',  178000, null, null, false),
  ('CHAO26',  'Chảo chống dính Sunhouse 26cm',  'NHOM', 'CAI', 'Sunhouse',  165000, null, null, false),
  ('CHAO30',  'Chảo chống dính Sunhouse 30cm',  'NHOM', 'CAI', 'Sunhouse',  198000, null, null, false),
  ('AM3L',    'Ấm đun nước inox 3L',            'NHOM', 'CAI', 'Kim Hằng',  156000, null, null, false),
  ('ROI30',   'Rổ inox tròn 30cm',              'NHOM', 'CAI', 'Kim Hằng',   85000, null, null, false),
  ('MUONG12', 'Bộ muỗng inox 12 cái',           'NHOM', 'BO',  'Kim Hằng',   62000, null, null, false),
  ('DUA10',   'Bộ đũa inox 10 đôi',             'NHOM', 'BO',  'Kim Hằng',   78000, null, null, false),

  -- Thuỷ tinh – sứ (6)
  ('LY180',  'Ly thuỷ tinh Union 180ml',        'TTS', 'CAI', 'Union',       9000, null, null, true),
  ('LY300',  'Ly thuỷ tinh Union 300ml',        'TTS', 'CAI', 'Union',      12000, null, null, true),
  ('CHEN',   'Chén sứ Minh Long trắng',         'TTS', 'CAI', 'Minh Long',  18000, null, null, true),
  ('DIA20',  'Đĩa sứ Minh Long 20cm',           'TTS', 'CAI', 'Minh Long',  26000, null, null, true),
  ('TO18',   'Tô sứ Minh Long 18cm',            'TTS', 'CAI', 'Minh Long',  34000, null, null, false),
  ('BINH15', 'Bình thuỷ tinh 1.5L',             'TTS', 'CAI', 'Union',      68000, null, null, false),

  -- Gia dụng khác (4)
  ('CAY360', 'Cây lau nhà xoay 360',            'KHAC', 'CAI', 'Việt Nhật', 185000,
   array['Xanh dương','Đỏ','Trắng'], array['XD','D','T'], false),
  ('CHOI',   'Chổi quét nhà cán dài',           'KHAC', 'CAI', null,         45000, null, null, false),
  ('KHAN3',  'Khăn lau đa năng bộ 3',           'KHAC', 'BO',  null,         28000, null, null, false),
  ('BAT01',  'Bàn chải cọ nhà tắm',             'KHAC', 'CAI', null,         32000, null, null, false);

do $$
begin
  if (select count(*) from seed_products) <> 30 then
    raise exception 'seed_products phải có đúng 30 dòng, đang có %',
      (select count(*) from seed_products);
  end if;
end
$$;

insert into public.products
  (sku, name, item_group_id, base_uom_id, brand, default_supplier_id, safety_stock, status)
select
  sp.sku, sp.name, ig.id, u.id, sp.brand,
  case sp.group_code
    when 'NHUA' then (select id from public.suppliers where code = 'NCC01')
    when 'NHOM' then (select id from public.suppliers where code = 'NCC02')
    when 'TTS'  then (select id from public.suppliers where code = 'NCC03')
    else null
  end,
  10, 'active'
from seed_products sp
join public.item_groups ig on ig.code = sp.group_code
join public.uoms u on u.code = sp.base_uom;

-- Đơn vị gốc: bắt buộc đúng 1 dòng factor = 1 khớp base_uom_id
insert into public.product_uoms (product_id, uom_id, factor)
select p.id, p.base_uom_id, 1 from public.products p;

-- Đơn vị lớn cho 12 mặt hàng bán theo chục và theo thùng
insert into public.product_uoms (product_id, uom_id, factor)
select p.id, u.id, f.factor
from public.products p
join seed_products sp on sp.sku = p.sku and sp.has_bulk_uoms
cross join (values ('CHUC', 10::numeric), ('THUNG', 12::numeric)) as f(code, factor)
join public.uoms u on u.code = f.code;

-- ---------------------------------------------------------------------------
-- Biến thể: 8 sản phẩm có 3 màu, 22 sản phẩm có 1 biến thể mặc định = 46 biến thể
-- ---------------------------------------------------------------------------
insert into public.product_variants (product_id, variant_code, attr_color, is_default, status)
select
  p.id,
  case when c.code is null then p.sku else p.sku || '-' || c.code end,
  c.color,
  coalesce(c.ord, 1) = 1,
  'active'
from public.products p
join seed_products sp on sp.sku = p.sku
left join lateral unnest(sp.colors, sp.color_codes) with ordinality as c(color, code, ord)
  on true;

-- Mỗi biến thể một mã vạch. 24 biến thể đầu là mã nhà sản xuất (EAN-13 giả lập),
-- phần còn lại là tem tự in — sát thực tế ~50/50 của cửa hàng.
insert into public.product_barcodes (variant_id, barcode, source)
select
  v.id,
  case when v.rn <= 24
    then '893' || lpad(v.rn::text, 10, '0')
    else 'NS' || lpad(v.rn::text, 8, '0')
  end,
  case when v.rn <= 24 then 'manufacturer' else 'internal' end::public.barcode_source
from (
  select pv.id, row_number() over (order by pv.variant_code) as rn
  from public.product_variants pv
) v;

-- ---------------------------------------------------------------------------
-- Bảng giá: mỗi cửa hàng 1 lẻ + 1 sỉ. Giá CH2 cao hơn CH1 5%, giá sỉ bằng 88% giá lẻ.
-- Khác nhau giữa 2 cửa hàng là CÓ CHỦ ĐÍCH: đó là thứ test cách ly dữ liệu soi vào.
-- ---------------------------------------------------------------------------
insert into public.price_lists (store_id, name, kind, is_default)
select s.id, s.name || ' – Bảng giá ' || k.label, k.kind::public.price_list_kind, true
from public.stores s
cross join (values ('retail', 'lẻ'), ('wholesale', 'sỉ')) as k(kind, label);

insert into public.price_list_items
  (store_id, price_list_id, product_id, price_per_base_unit, effective_from)
select
  pl.store_id, pl.id, p.id,
  round(
    sp.base_price
      * case when s.code = 'CH2' then 1.05 else 1 end
      * case when pl.kind = 'wholesale' then 0.88 else 1 end,
    -2
  ),
  public.fn_today_vn() - 30
from public.price_lists pl
join public.stores s on s.id = pl.store_id
cross join public.products p
join seed_products sp on sp.sku = p.sku;

-- ---------------------------------------------------------------------------
-- Tồn đầu kỳ: một phiếu kiểm kê kind = 'opening' mỗi cửa hàng, đã chốt.
-- Số lượng khác nhau giữa 2 cửa hàng, sinh xác định từ mã biến thể.
-- ---------------------------------------------------------------------------
insert into public.stock_takes (store_id, take_no, take_date, kind, status, submitted_at, note)
select s.id, public.fn_next_doc_no(s.id, 'KK'), public.fn_today_vn() - 20,
       'opening', 'submitted', now(), 'Tồn đầu kỳ khi bắt đầu dùng phần mềm'
from public.stores s;

insert into public.stock_take_items (store_id, take_id, variant_id, system_qty, counted_qty)
select st.store_id, st.id, pv.id, 0,
       case when s.code = 'CH1'
         then 100 + (abs(hashtext(pv.variant_code)) % 60)
         else  40 + (abs(hashtext(pv.variant_code)) % 35)
       end
from public.stock_takes st
join public.stores s on s.id = st.store_id
cross join public.product_variants pv;

insert into public.stock_ledger (store_id, variant_id, qty_base, ref_type, ref_id, note)
select sti.store_id, sti.variant_id, sti.counted_qty, 'opening', sti.take_id, 'Tồn đầu kỳ'
from public.stock_take_items sti;

-- ---------------------------------------------------------------------------
-- Ca làm việc: mỗi cửa hàng một ca đã đóng, để các đơn bán có shift_id hợp lệ.
-- ---------------------------------------------------------------------------
insert into public.cash_shifts
  (store_id, user_id, opened_at, closed_at, opening_float, expected_cash, counted_cash, status)
select
  s.id, u.id,
  now() - interval '2 days', now() - interval '2 days' + interval '9 hours',
  1000000, 1000000, 1000000, 'closed'
from public.stores s
join public.store_members sm on sm.store_id = s.id and sm.role = 'staff'
join auth.users u on u.id = sm.user_id;

-- ---------------------------------------------------------------------------
-- Đơn bán mẫu
--
-- 5 đơn sỉ còn nợ (mỗi khách sỉ một đơn, 3 ở CH1 + 2 ở CH2) và 4 đơn lẻ trả đủ.
-- Ghi theo 3 bước: tạo đơn với số 0 → thêm dòng → cộng ngược lên đơn. Ràng buộc
-- "subtotal khớp tổng các dòng" là deferred nên chỉ kiểm tra lúc COMMIT.
-- ---------------------------------------------------------------------------
create temporary table seed_orders (
  seq integer primary key,
  store_code text not null,
  customer_code text,
  kind text not null,
  paid_ratio numeric not null
) on commit drop;

insert into seed_orders (seq, store_code, customer_code, kind, paid_ratio) values
  (1, 'CH1', 'KH01', 'wholesale', 0.60),
  (2, 'CH1', 'KH02', 'wholesale', 0.50),
  (3, 'CH1', 'KH03', 'wholesale', 0.00),
  (4, 'CH2', 'KH04', 'wholesale', 0.70),
  (5, 'CH2', 'KH05', 'wholesale', 0.40),
  (6, 'CH1', null,   'retail',    1.00),
  (7, 'CH1', null,   'retail',    1.00),
  (8, 'CH2', null,   'retail',    1.00),
  (9, 'CH2', 'KH06', 'retail',    1.00);

-- client_uuid sinh XÁC ĐỊNH từ seq, để các bước sau nối ngược về seed_orders được
-- mà không cần bảng ánh xạ. Đây cũng đúng vai trò thật của cột này: khoá
-- idempotency do client sinh ra.
insert into public.orders (
  client_uuid, store_id, order_no, shift_id, customer_id, price_list_id,
  order_kind, status, payment_status, due_date, created_at, paid_at
)
select
  ('00000000-0000-4000-8000-' || lpad(so.seq::text, 12, '0'))::uuid,
  s.id,
  public.fn_next_doc_no(s.id, 'HD'),
  cs.id,
  c.id,
  pl.id,
  so.kind::public.order_kind,
  'paid',
  'paid',
  case when so.paid_ratio < 1 then public.fn_today_vn() + 15 end,
  now() - (so.seq || ' hours')::interval,
  now() - (so.seq || ' hours')::interval
from seed_orders so
join public.stores s on s.code = so.store_code
join public.cash_shifts cs on cs.store_id = s.id
join public.price_lists pl
  on pl.store_id = s.id and pl.kind = so.kind::public.price_list_kind
left join public.customers c on c.code = so.customer_code;

-- Mỗi đơn 3 dòng, sản phẩm chọn xoay vòng theo số thứ tự đơn.
insert into public.order_items (
  store_id, order_id, variant_id, uom_id, factor,
  qty_input, qty_base, unit_price_input, line_no
)
select
  o.store_id, o.id, pv.id, p.base_uom_id, 1,
  ln.qty, ln.qty,
  vcp.price_per_base_unit,
  ln.line_no
from public.orders o
join seed_orders so on so.seq = right(o.client_uuid::text, 12)::integer
cross join lateral (values (1, 3::numeric), (2, 5::numeric), (3, 2::numeric)) as ln(line_no, qty)
join lateral (
  select pr.id, pr.base_uom_id from public.products pr
  order by pr.sku offset ((so.seq * 3 + ln.line_no) % 30) limit 1
) p on true
join lateral (
  select pv2.id from public.product_variants pv2
  where pv2.product_id = p.id and pv2.is_default limit 1
) pv on true
join public.v_current_prices vcp
  on vcp.price_list_id = o.price_list_id and vcp.product_id = p.id;

-- Cộng ngược tổng đơn từ các dòng. Dùng floor tới hàng trăm chứ không round:
-- round có thể cho số tiền đã trả LỚN HƠN tổng đơn, và khi đó debt_amount âm sẽ
-- vi phạm ràng buộc — đúng như thiết kế, nhưng seed thì không nên tự bắn vào chân.
update public.orders o
set subtotal = t.line_sum,
    total = t.line_sum,
    paid_amount = t.paid,
    debt_amount = t.line_sum - t.paid,
    payment_status = (case
      when t.paid >= t.line_sum then 'paid'
      when t.paid > 0 then 'partial'
      else 'unpaid'
    end)::public.payment_status
from (
  select
    oi.order_id,
    sum(oi.line_total) as line_sum,
    case when so.paid_ratio >= 1
      then sum(oi.line_total)
      else floor(sum(oi.line_total) * so.paid_ratio / 100) * 100
    end as paid
  from public.order_items oi
  join public.orders o2 on o2.id = oi.order_id
  join seed_orders so on so.seq = right(o2.client_uuid::text, 12)::integer
  group by oi.order_id, so.paid_ratio
) t
where t.order_id = o.id;

insert into public.payments (store_id, order_id, method, amount)
-- Cast tường minh: UNION ALL buộc Postgres phải quyết kiểu của literal TRƯỚC khi
-- ép về kiểu cột đích, và nó sẽ chọn text rồi báo lỗi.
select o.store_id, o.id, 'cash'::public.payment_method, o.paid_amount
from public.orders o where o.paid_amount > 0
union all
select o.store_id, o.id, 'debt'::public.payment_method, o.debt_amount
from public.orders o where o.debt_amount > 0;

-- Trừ kho theo từng dòng bán. Trigger tự cộng dồn stock_balances và điền
-- balance_after — seed không được tự tính hai con số đó.
insert into public.stock_ledger (store_id, variant_id, qty_base, ref_type, ref_id, note)
select oi.store_id, oi.variant_id, -oi.qty_base, 'sale', oi.order_id, 'Bán hàng'
from public.order_items oi
order by oi.store_id, oi.variant_id, oi.id;

-- ---------------------------------------------------------------------------
-- Kiểm tra ngay tại đây, đừng để phát hiện muộn
-- ---------------------------------------------------------------------------
do $$
declare
  v_products integer;
  v_variants integer;
  v_mismatch integer;
begin
  select count(*) into v_products from public.products;
  select count(*) into v_variants from public.product_variants;
  select count(*) into v_mismatch from public.fn_assert_stock_integrity();

  if v_products <> 30 then
    raise exception 'Phải có đúng 30 sản phẩm, đang có %', v_products;
  end if;
  if v_variants < 45 then
    raise exception 'Phải có ít nhất 45 biến thể, đang có %', v_variants;
  end if;
  if v_mismatch <> 0 then
    raise exception 'Tồn kho lệch ở % dòng ngay sau seed', v_mismatch;
  end if;

  raise notice 'Seed xong: % sản phẩm, % biến thể, tồn kho khớp.', v_products, v_variants;
end
$$;
