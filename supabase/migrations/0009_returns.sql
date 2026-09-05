-- 0009_returns.sql
-- Trả hàng. Đồ nhựa, thuỷ tinh, sành sứ hay nứt vỡ khi bốc xếp: hàng nguyên vẹn
-- nhập lại kho, hàng nứt vỡ ghi nhận hao hụt chứ không nhập lại. Gộp chung là
-- tồn kho nói dối.

-- order_items cần khoá tổ hợp (id, store_id) để return_items trỏ vào bằng khoá
-- ngoại tổ hợp. Đặt ALTER ở đây thay vì sửa 0006 vì 0006 đã push — migration đã
-- áp dụng thì không sửa, luôn viết file mới.
alter table public.order_items
  add constraint uq_order_items_id_store unique (id, store_id);

create table public.returns (
  id uuid primary key default extensions.gen_random_uuid(),
  client_uuid uuid not null unique,
  store_id uuid not null references public.stores (id),
  order_id uuid not null,
  return_no text not null unique,
  return_date date not null default public.fn_today_vn(),
  refund_method public.refund_method not null,
  total_refund numeric(14, 2) not null default 0 check (total_refund >= 0),
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),

  constraint uq_returns_id_store unique (id, store_id),
  constraint fk_returns_order
    foreign key (order_id, store_id) references public.orders (id, store_id)
);

create index ix_returns_order on public.returns (order_id);
create index ix_returns_store_date on public.returns (store_id, return_date desc);

create table public.return_items (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  return_id uuid not null,
  order_item_id uuid not null,
  variant_id uuid not null references public.product_variants (id),
  qty_base numeric(14, 3) not null check (qty_base > 0),
  condition public.return_condition not null,
  refund_amount numeric(14, 2) not null default 0 check (refund_amount >= 0),
  created_at timestamptz not null default now(),

  constraint fk_return_items_return
    foreign key (return_id, store_id) references public.returns (id, store_id),
  -- Khoá tổ hợp: không thể trả hàng của đơn thuộc cửa hàng khác.
  constraint fk_return_items_order_item
    foreign key (order_item_id, store_id) references public.order_items (id, store_id),
  -- Một dòng gốc tách được thành 2 dòng trả: 3 cái nguyên vẹn + 1 cái nứt.
  constraint uq_return_items unique (return_id, order_item_id, condition)
);

comment on column public.return_items.qty_base is
  'Số lượng trả THẬT, kể cả hàng nứt vỡ. Báo cáo hao hụt đọc từ đây, KHÔNG đọc từ stock_ledger — dòng ledger return_scrap có qty_base = 0 và chỉ để truy vết.';

create index ix_return_items_return on public.return_items (return_id);
create index ix_return_items_order_item on public.return_items (order_item_id);
create index ix_return_items_variant on public.return_items (store_id, variant_id);
-- Báo cáo hao hụt
create index ix_return_items_damaged on public.return_items (store_id, created_at)
  where condition = 'damaged';

-- Khép vòng với 0007: phiếu thu 'credit' phải trỏ về đúng phiếu trả hàng, và
-- phải cùng cửa hàng với nó.
alter table public.receipts
  add constraint fk_receipts_source_return
  foreign key (source_return_id, store_id) references public.returns (id, store_id);
