-- 0007_receivables.sql
-- Công nợ khách — đối trừ theo TỪNG hoá đơn. Đây là yêu cầu rõ ràng của chủ
-- cửa hàng: cần biết tiền trả cho hoá đơn nào.
--
-- Khách hàng dùng chung giữa 2 cửa hàng, nhưng công nợ tính RIÊNG theo cửa hàng
-- vì hoá đơn thuộc về một cửa hàng cụ thể. Vì thế phiếu thu có store_id.

create table public.receipts (
  id uuid primary key default extensions.gen_random_uuid(),
  -- 01-du-lieu.md §2 xếp receipts vào nhóm chứng từ có client_uuid, nhưng DDL ở
  -- §8 lại thiếu. Thêm vào: chống thu tiền hai lần khi bấm đúp hoặc HTTP retry.
  client_uuid uuid not null unique,
  store_id uuid not null references public.stores (id),
  customer_id uuid not null references public.customers (id),
  receipt_no text not null unique,
  receipt_date date not null default public.fn_today_vn(),
  method public.receipt_method not null,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  -- Chỉ có giá trị khi method = 'credit': phiếu thu ảo sinh từ một phiếu trả hàng
  -- có refund_method = 'credit_next_order'. Khoá ngoại thêm ở 0009 vì bảng
  -- returns tạo sau file này.
  source_return_id uuid,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),

  constraint uq_receipts_id_store unique (id, store_id),
  -- 'credit' là đối trừ công nợ, không phải tiền thật; mọi phiếu thu 'credit'
  -- phải truy được về phiếu trả hàng sinh ra nó, và ngược lại.
  constraint ck_receipts_credit_source
    check ((method = 'credit') = (source_return_id is not null))
);

comment on column public.receipts.method is
  'cash/transfer là tiền thật. credit là đối trừ từ trả hàng — PHẢI loại khỏi mọi báo cáo tiền mặt và khỏi expected_cash khi đóng ca.';

create index ix_receipts_customer on public.receipts (store_id, customer_id, receipt_date desc);
create index ix_receipts_store_date on public.receipts (store_id, receipt_date desc);

create table public.receipt_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  receipt_id uuid not null,
  order_id uuid not null,
  allocated_amount numeric(14, 2) not null check (allocated_amount > 0),
  created_at timestamptz not null default now(),

  constraint fk_receipt_allocations_receipt
    foreign key (receipt_id, store_id) references public.receipts (id, store_id),
  constraint fk_receipt_allocations_order
    foreign key (order_id, store_id) references public.orders (id, store_id),
  -- Một phiếu thu phân bổ vào một đơn nhiều nhất một lần; muốn sửa thì sửa số tiền.
  constraint uq_receipt_allocations unique (receipt_id, order_id)
);

create index ix_receipt_allocations_order on public.receipt_allocations (order_id);
create index ix_receipt_allocations_receipt on public.receipt_allocations (receipt_id);

-- ---------------------------------------------------------------------------
-- Tổng phân bổ phải bằng tổng phiếu thu.
--
-- 01-du-lieu.md §8 nói kiểm tra trong RPC. Vẫn ràng buộc ở database: tiền là chỗ
-- không được phép sai, và một RPC viết sau này quên kiểm tra thì không có gì bắt.
-- Deferred để RPC ghi phiếu trước, ghi phân bổ sau trong cùng transaction.
--
-- Ràng buộc còn lại — "mỗi đơn: SUM(allocated) ≤ orders.debt_amount" — KHÔNG đặt
-- ở đây được, vì chính RPC cập nhật debt_amount ngay sau khi phân bổ nên trigger
-- sẽ soi vào một con số đang thay đổi. Chỗ đó thuộc rpc_create_receipt (Phase 7).
-- ---------------------------------------------------------------------------
create or replace function public.fn_assert_receipt_allocation_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt_id uuid;
  v_total numeric(14, 2);
  v_sum numeric(14, 2);
begin
  -- IF/ELSIF chứ không phải biểu thức CASE — xem ghi chú ở 0006_sales.sql.
  if tg_table_name = 'receipts' then
    v_receipt_id := new.id;
  elsif tg_op = 'DELETE' then
    v_receipt_id := old.receipt_id;
  else
    v_receipt_id := new.receipt_id;
  end if;

  select r.total_amount into v_total from public.receipts r where r.id = v_receipt_id;
  if not found then
    return null;
  end if;

  select coalesce(sum(ra.allocated_amount), 0) into v_sum
  from public.receipt_allocations ra where ra.receipt_id = v_receipt_id;

  if v_total <> v_sum then
    raise exception
      'Phiếu thu % có tổng tiền % nhưng tổng phân bổ %', v_receipt_id, v_total, v_sum
      using errcode = '23514';
  end if;

  return null;
end
$$;

create constraint trigger trg_receipts_allocation_total
  after insert or update of total_amount on public.receipts
  deferrable initially deferred
  for each row execute function public.fn_assert_receipt_allocation_total();

create constraint trigger trg_receipt_allocations_total
  after insert or delete or update of allocated_amount, receipt_id
  on public.receipt_allocations
  deferrable initially deferred
  for each row execute function public.fn_assert_receipt_allocation_total();
