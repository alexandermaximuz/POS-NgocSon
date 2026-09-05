-- 0010_stocktake_shift.sql
-- Kiểm kê, tồn đầu kỳ, ca làm việc và quỹ tiền mặt.

-- ---------------------------------------------------------------------------
-- cash_shifts
-- ---------------------------------------------------------------------------
create table public.cash_shifts (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  user_id uuid not null references auth.users (id),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_float numeric(14, 2) not null default 0 check (opening_float >= 0),
  expected_cash numeric(14, 2),
  counted_cash numeric(14, 2),
  -- Generated: không có đường nào ghi variance sai lệch so với hai số gốc.
  variance numeric(14, 2) generated always as (counted_cash - expected_cash) stored,
  status public.shift_status not null default 'open',
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),

  constraint uq_cash_shifts_id_store unique (id, store_id),
  constraint ck_cash_shifts_state check (
    (status = 'open' and closed_at is null)
    or (status = 'closed'
        and closed_at is not null
        and expected_cash is not null
        and counted_cash is not null)
  )
);

comment on column public.cash_shifts.variance is
  'counted_cash − expected_cash. Lệch KHÔNG chặn đóng ca, chỉ ghi nhận và hiển thị.';

-- Một user chỉ được có một ca đang mở trên mỗi cửa hàng (03-rpc.md, rpc_open_shift).
create unique index ux_cash_shifts_one_open
  on public.cash_shifts (store_id, user_id) where status = 'open';

create index ix_cash_shifts_store_opened on public.cash_shifts (store_id, opened_at desc);

-- Khép vòng với 0006: orders.shift_id không đặt được khoá ngoại lúc đó vì bảng
-- cash_shifts sinh sau. Khoá tổ hợp buộc đơn và ca phải cùng cửa hàng.
alter table public.orders
  add constraint fk_orders_shift
  foreign key (shift_id, store_id) references public.cash_shifts (id, store_id);

create table public.cash_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  shift_id uuid not null,
  type public.cash_txn_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  reason text not null,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),

  constraint fk_cash_transactions_shift
    foreign key (shift_id, store_id) references public.cash_shifts (id, store_id)
);

create index ix_cash_transactions_shift on public.cash_transactions (shift_id);

-- ---------------------------------------------------------------------------
-- stock_takes — kiểm kê định kỳ và nhập tồn đầu kỳ
-- ---------------------------------------------------------------------------
create table public.stock_takes (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  take_no text not null unique,
  take_date date not null default public.fn_today_vn(),
  kind public.stock_take_kind not null,
  -- NULL = kiểm kê toàn bộ. Có giá trị = kiểm kê cuốn chiếu theo nhóm hàng.
  item_group_id uuid references public.item_groups (id),
  status public.stock_take_status not null default 'draft',
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,

  constraint uq_stock_takes_id_store unique (id, store_id),
  constraint ck_stock_takes_submitted
    check ((status = 'submitted') = (submitted_at is not null))
);

create index ix_stock_takes_store_date on public.stock_takes (store_id, take_date desc);
create index ix_stock_takes_draft on public.stock_takes (store_id) where status = 'draft';

create trigger trg_stock_takes_touch
  before update on public.stock_takes
  for each row execute function public.fn_touch_updated_at();

create table public.stock_take_items (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  take_id uuid not null,
  variant_id uuid not null references public.product_variants (id),
  -- Tồn hệ thống tại thời điểm chốt phiếu.
  system_qty numeric(14, 3),
  -- NULL nghĩa là CHƯA ĐẾM. Phiếu draft đếm nhiều ngày nên đây là trạng thái
  -- bình thường, không phải lỗi.
  counted_qty numeric(14, 3) check (counted_qty >= 0),
  diff numeric(14, 3) generated always as (counted_qty - system_qty) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint fk_stock_take_items_take
    foreign key (take_id, store_id) references public.stock_takes (id, store_id),
  constraint uq_stock_take_items unique (take_id, variant_id)
);

comment on column public.stock_take_items.diff is
  'NULL khi chưa đếm (counted_qty NULL). rpc_submit_stock_take phải BỎ QUA dòng có diff IS NULL một cách CÓ Ý THỨC, không phải bỏ qua do tình cờ vì NULL <> 0 là NULL.';

create index ix_stock_take_items_take on public.stock_take_items (take_id);
create index ix_stock_take_items_variant on public.stock_take_items (store_id, variant_id);

create trigger trg_stock_take_items_touch
  before update on public.stock_take_items
  for each row execute function public.fn_touch_updated_at();
