-- 0008_purchasing.sql
-- Nhập kho và công nợ nhà cung cấp. Đối xứng với 0006 + 0007.
--
-- KHÔNG tính giá vốn bình quân. KHÔNG phân bổ chi phí vận chuyển.
-- unit_cost_base chỉ được ghi vào stock_ledger.unit_cost và DỪNG Ở ĐÓ.

create table public.inbound_receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  client_uuid uuid not null unique,
  store_id uuid not null references public.stores (id),
  receipt_no text not null unique,
  supplier_id uuid not null references public.suppliers (id),
  receipt_date date not null default public.fn_today_vn(),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0),
  debt_amount numeric(14, 2) not null default 0 check (debt_amount >= 0),
  payment_status public.payment_status not null default 'unpaid',
  -- Không có bước nháp: nhập trực tiếp, không có quy trình đặt hàng (phase-6.md).
  -- Phiếu đã lưu không sửa được; sai thì huỷ phiếu và nhập lại.
  status public.inbound_status not null default 'submitted',
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),
  updated_at timestamptz not null default now(),
  voided_at timestamptz,
  void_reason text,

  constraint uq_inbound_receipts_id_store unique (id, store_id),
  constraint ck_inbound_debt check (debt_amount = total - paid_amount)
);

create index ix_inbound_receipts_supplier
  on public.inbound_receipts (store_id, supplier_id, receipt_date desc);
create index ix_inbound_receipts_unpaid
  on public.inbound_receipts (store_id, supplier_id, receipt_date)
  where payment_status in ('unpaid', 'partial');

create trigger trg_inbound_receipts_touch
  before update on public.inbound_receipts
  for each row execute function public.fn_touch_updated_at();

create table public.inbound_items (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  receipt_id uuid not null,
  variant_id uuid not null references public.product_variants (id),
  uom_id uuid not null references public.uoms (id),
  factor numeric(12, 4) not null check (factor > 0),
  qty_input numeric(14, 3) not null check (qty_input > 0),
  qty_base numeric(14, 3) not null check (qty_base > 0),
  -- Giá theo đơn vị NHẬP (ví dụ 360.000/thùng)
  unit_cost_input numeric(14, 2) not null check (unit_cost_input >= 0),
  -- Giá theo đơn vị GỐC (360.000 / 12 = 30.000/cái). Để database tính, không để
  -- client gửi lên — đây là con số duy nhất đi vào stock_ledger.unit_cost.
  unit_cost_base numeric(14, 2)
    generated always as (round(unit_cost_input / factor, 2)) stored,
  line_total numeric(14, 2)
    generated always as (round(qty_input * unit_cost_input)) stored,
  line_no integer not null check (line_no > 0),
  created_at timestamptz not null default now(),

  constraint fk_inbound_items_receipt
    foreign key (receipt_id, store_id) references public.inbound_receipts (id, store_id),
  constraint uq_inbound_items_line unique (receipt_id, line_no),
  constraint ck_inbound_items_qty_base
    check (abs(qty_base - qty_input * factor) < 0.001)
);

comment on column public.inbound_items.unit_cost_base is
  'CHỈ LƯU. Không dùng để tính giá vốn bình quân, COGS hay lãi gộp — những thứ đó nằm ngoài scope một cách CÓ CHỦ ĐÍCH.';

create index ix_inbound_items_receipt on public.inbound_items (receipt_id);
create index ix_inbound_items_variant on public.inbound_items (store_id, variant_id);

-- ---------------------------------------------------------------------------
-- supplier_payments — phiếu chi, đối xứng với receipts
-- ---------------------------------------------------------------------------
create table public.supplier_payments (
  id uuid primary key default extensions.gen_random_uuid(),
  -- Chi trùng cho nhà cung cấp là mất tiền thật, nên cũng cần idempotency dù
  -- 01-du-lieu.md §2 không liệt kê bảng này.
  client_uuid uuid not null unique,
  store_id uuid not null references public.stores (id),
  supplier_id uuid not null references public.suppliers (id),
  payment_no text not null unique,
  payment_date date not null default public.fn_today_vn(),
  method public.supplier_payment_method not null,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),

  constraint uq_supplier_payments_id_store unique (id, store_id)
);

create index ix_supplier_payments_supplier
  on public.supplier_payments (store_id, supplier_id, payment_date desc);

create table public.supplier_payment_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  -- 01-du-lieu.md §9 viết `payment_no_id`, là lỗi đánh máy. Không đặt tên
  -- `payment_id` vì bảng `payments` đã là thứ khác (tiền khách trả trên đơn bán).
  supplier_payment_id uuid not null,
  inbound_receipt_id uuid not null,
  allocated_amount numeric(14, 2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now(),

  constraint fk_spa_payment
    foreign key (supplier_payment_id, store_id)
    references public.supplier_payments (id, store_id),
  constraint fk_spa_receipt
    foreign key (inbound_receipt_id, store_id)
    references public.inbound_receipts (id, store_id),
  constraint uq_spa unique (supplier_payment_id, inbound_receipt_id)
);

create index ix_spa_receipt on public.supplier_payment_allocations (inbound_receipt_id);
create index ix_spa_payment on public.supplier_payment_allocations (supplier_payment_id);

-- Tổng phân bổ phải bằng tổng phiếu chi — đối xứng với 0007.
create or replace function public.fn_assert_supplier_payment_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_id uuid;
  v_total numeric(14, 2);
  v_sum numeric(14, 2);
begin
  -- IF/ELSIF chứ không phải biểu thức CASE — xem ghi chú ở 0006_sales.sql.
  if tg_table_name = 'supplier_payments' then
    v_payment_id := new.id;
  elsif tg_op = 'DELETE' then
    v_payment_id := old.supplier_payment_id;
  else
    v_payment_id := new.supplier_payment_id;
  end if;

  select sp.total_amount into v_total
  from public.supplier_payments sp where sp.id = v_payment_id;
  if not found then
    return null;
  end if;

  select coalesce(sum(spa.allocated_amount), 0) into v_sum
  from public.supplier_payment_allocations spa
  where spa.supplier_payment_id = v_payment_id;

  if v_total <> v_sum then
    raise exception
      'Phiếu chi % có tổng tiền % nhưng tổng phân bổ %', v_payment_id, v_total, v_sum
      using errcode = '23514';
  end if;

  return null;
end
$$;

create constraint trigger trg_supplier_payments_allocation_total
  after insert or update of total_amount on public.supplier_payments
  deferrable initially deferred
  for each row execute function public.fn_assert_supplier_payment_total();

create constraint trigger trg_spa_total
  after insert or delete or update of allocated_amount, supplier_payment_id
  on public.supplier_payment_allocations
  deferrable initially deferred
  for each row execute function public.fn_assert_supplier_payment_total();
