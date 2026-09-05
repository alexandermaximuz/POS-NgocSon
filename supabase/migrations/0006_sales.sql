-- 0006_sales.sql
-- Bán hàng. CÓ store_id trên cả bảng cha lẫn bảng con.
--
-- Bảng con mang store_id denormalized để policy RLS chỉ là một phép so sánh cột,
-- không phải subquery EXISTS chạy lại cho từng dòng khi PostgREST embed
-- (orders?select=*,order_items(*)). Lệch store_id giữa cha và con là KHÔNG BIỂU
-- DIỄN ĐƯỢC nhờ khoá ngoại tổ hợp (order_id, store_id) → orders (id, store_id).

create table public.orders (
  id uuid primary key default extensions.gen_random_uuid(),
  -- Idempotency khi đồng bộ offline và khi người dùng bấm hai lần.
  client_uuid uuid not null unique,
  store_id uuid not null references public.stores (id),
  -- NULL khi đơn đang treo. Số chứng từ chỉ sinh lúc thanh toán, nếu không đơn
  -- treo bị bỏ sẽ để lại lỗ hổng trong dãy số và chủ cửa hàng sẽ đi tìm.
  order_no text unique,
  shift_id uuid not null,
  customer_id uuid references public.customers (id),
  price_list_id uuid not null,
  order_kind public.order_kind not null,
  status public.order_status not null default 'held',
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount_order numeric(14, 2) not null default 0 check (discount_order >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0),
  debt_amount numeric(14, 2) not null default 0 check (debt_amount >= 0),
  payment_status public.payment_status not null default 'unpaid',
  due_date date,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  voided_at timestamptz,
  void_reason text,

  constraint uq_orders_id_store unique (id, store_id),
  constraint fk_orders_price_list
    foreign key (price_list_id, store_id) references public.price_lists (id, store_id),

  -- Số chứng từ theo trạng thái. Hai vế viết TÁCH RỜI có chủ đích: đơn treo bị bỏ
  -- rồi chuyển sang 'void' vẫn ghi được. Một CHECK hai chiều sẽ chặn oan ca đó.
  constraint ck_orders_held_no_number check (status <> 'held' or order_no is null),
  constraint ck_orders_paid_has_number check (status <> 'paid' or order_no is not null),

  -- Ghi nợ bắt buộc phải có khách cụ thể (phase-5.md §3). Biến quy tắc nghiệp vụ
  -- thành cấu trúc thay vì chỉ kiểm tra trong RPC. Không áp cho đơn treo vì đơn
  -- treo chưa chốt thanh toán.
  constraint ck_orders_debt_needs_customer
    check (status <> 'paid' or payment_status = 'paid' or customer_id is not null),

  -- Số học của đơn. v1 từng hiển thị `1 × 165.000 = 155.000`; ở đây con số đó
  -- không ghi được vào database.
  constraint ck_orders_total check (total = subtotal - discount_order),
  constraint ck_orders_debt check (debt_amount = total - paid_amount)
);

create index ix_orders_store_created on public.orders (store_id, created_at desc);
create index ix_orders_customer on public.orders (customer_id, store_id)
  where customer_id is not null;
-- Màn thu nợ: đơn chưa trả hết của một khách, cũ nhất trước.
create index ix_orders_unpaid on public.orders (store_id, customer_id, created_at)
  where payment_status in ('unpaid', 'partial');
create index ix_orders_held on public.orders (store_id, created_at) where status = 'held';
create index ix_orders_shift on public.orders (shift_id);

create trigger trg_orders_touch
  before update on public.orders
  for each row execute function public.fn_touch_updated_at();

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  order_id uuid not null,
  variant_id uuid not null references public.product_variants (id),
  uom_id uuid not null references public.uoms (id),
  factor numeric(12, 4) not null check (factor > 0),
  qty_input numeric(14, 3) not null check (qty_input > 0),
  qty_base numeric(14, 3) not null check (qty_base > 0),
  unit_price_input numeric(14, 2) not null check (unit_price_input >= 0),
  line_discount numeric(14, 2) not null default 0 check (line_discount >= 0),
  -- Thành tiền = SL × Đơn giá − Giảm, tính bởi database chứ không phải client.
  line_total numeric(14, 2)
    generated always as (round(qty_input * unit_price_input) - line_discount) stored,
  line_no integer not null check (line_no > 0),
  created_at timestamptz not null default now(),

  constraint fk_order_items_order
    foreign key (order_id, store_id) references public.orders (id, store_id),
  constraint uq_order_items_line unique (order_id, line_no),
  -- Dung sai 0.001 vì factor là numeric(12,4): tích có thể lẻ hơn 3 chữ số thập
  -- phân của qty_base. Không dùng dấu bằng tuyệt đối để tránh chặn oan.
  constraint ck_order_items_qty_base
    check (abs(qty_base - qty_input * factor) < 0.001),
  constraint ck_order_items_line_total check (line_total >= 0)
);

comment on column public.order_items.unit_price_input is
  'Giá theo ĐƠN VỊ NHẬP, không phải đơn vị gốc. Đổi Cái sang Thùng thì giá tự nhân factor (phase-5.md §2).';

create index ix_order_items_order on public.order_items (order_id);
create index ix_order_items_variant on public.order_items (store_id, variant_id);

-- ---------------------------------------------------------------------------
-- payments — tiền khách trả trên đơn. method = 'debt' là ghi nợ, KHÔNG phải
-- tiền vào két, phải loại khỏi expected_cash khi đóng ca.
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  order_id uuid not null,
  method public.payment_method not null,
  amount numeric(14, 2) not null check (amount > 0),
  ref_no text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),
  constraint fk_payments_order
    foreign key (order_id, store_id) references public.orders (id, store_id)
);

create index ix_payments_order on public.payments (order_id);
create index ix_payments_store_created on public.payments (store_id, created_at);

-- ---------------------------------------------------------------------------
-- Tổng đơn phải khớp tổng các dòng.
--
-- Không dùng generated column được: biểu thức generated không được tổng hợp qua
-- bảng khác. Dùng constraint trigger deferred, kiểm tra lúc COMMIT — cho phép
-- RPC ghi orders trước rồi ghi order_items sau trong cùng transaction.
--
-- Chỉ kiểm tra đơn đã chốt: đơn 'held' đang sửa dở và đơn 'void' không cần khớp.
-- ---------------------------------------------------------------------------
create or replace function public.fn_assert_order_subtotal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
  v_status public.order_status;
  v_subtotal numeric(14, 2);
  v_sum numeric(14, 2);
begin
  -- Dùng IF/ELSIF chứ KHÔNG dùng biểu thức CASE: plpgsql dịch một biểu thức CASE
  -- thành một câu SQL duy nhất và phân giải MỌI trường record xuất hiện trong đó,
  -- không short-circuit. `old.order_id` sẽ nổ "record old has no field order_id"
  -- khi trigger chạy trên bảng orders.
  if tg_table_name = 'orders' then
    v_order_id := new.id;
  elsif tg_op = 'DELETE' then
    v_order_id := old.order_id;
  else
    v_order_id := new.order_id;
  end if;

  select o.status, o.subtotal into v_status, v_subtotal
  from public.orders o where o.id = v_order_id;

  -- Đơn đã bị xoá trong cùng transaction thì không còn gì để kiểm tra.
  if not found or v_status <> 'paid' then
    return null;
  end if;

  select coalesce(sum(oi.line_total), 0) into v_sum
  from public.order_items oi where oi.order_id = v_order_id;

  if v_subtotal <> v_sum then
    raise exception
      'Đơn % có subtotal = % nhưng tổng các dòng = %', v_order_id, v_subtotal, v_sum
      using errcode = '23514';
  end if;

  return null;
end
$$;

create constraint trigger trg_orders_subtotal_matches
  after insert or update of subtotal, status on public.orders
  deferrable initially deferred
  for each row execute function public.fn_assert_order_subtotal();

create constraint trigger trg_order_items_subtotal_matches
  after insert or delete or update of qty_input, unit_price_input, line_discount
  on public.order_items
  deferrable initially deferred
  for each row execute function public.fn_assert_order_subtotal();
