-- 0005_stock.sql
-- Sổ kho và tồn kho. CÓ store_id.
--
-- Hai kỷ luật không được vi phạm:
--   1. stock_ledger CHỈ GHI THÊM. Sai thì lập phiếu điều chỉnh, không bao giờ ghi đè.
--   2. stock_ledger LUÔN trỏ variant_id, KHÔNG BAO GIỜ trỏ product_id. Nếu cho phép
--      cả hai sẽ có hai đường tính tồn song song và sớm muộn cũng lệch nhau.
--
-- stock_balances chỉ là cache do trigger cập nhật, dựng lại được bất cứ lúc nào
-- bằng rpc_rebuild_stock_balances (0011).

create table public.stock_balances (
  store_id uuid not null references public.stores (id),
  variant_id uuid not null references public.product_variants (id),
  qty_base numeric(14, 3) not null default 0,
  updated_at timestamptz not null default now(),
  primary key (store_id, variant_id)
);

create index ix_stock_balances_variant on public.stock_balances (variant_id);

comment on table public.stock_balances is
  'Cache của SUM(stock_ledger.qty_base). Không phải nguồn sự thật — dựng lại được bằng rpc_rebuild_stock_balances.';

create table public.stock_ledger (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  variant_id uuid not null references public.product_variants (id),
  qty_base numeric(14, 3) not null,
  ref_type public.stock_ref_type not null,
  ref_id uuid not null,
  unit_cost numeric(14, 2),
  balance_after numeric(14, 3) not null,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id),
  -- Dòng qty = 0 duy nhất được phép là hàng khách trả bị nứt vỡ: không nhập lại
  -- kho nhưng vẫn phải có dòng để truy vết hao hụt. Mọi dòng 0 khác là lỗi.
  constraint ck_stock_ledger_qty_nonzero
    check (qty_base <> 0 or ref_type = 'return_scrap')
);

comment on column public.stock_ledger.unit_cost is
  'CHỈ LƯU, không tính gì từ nó. Không MAC, không COGS, không lãi gộp.';
comment on column public.stock_ledger.balance_after is
  'Do trigger trg_stock_ledger_apply điền. Không bao giờ truyền vào từ client hay RPC.';

create index ix_stock_ledger_variant
  on public.stock_ledger (store_id, variant_id, created_at);
-- Truy ngược về chứng từ gốc — đây là lý do tồn tại của ref_type/ref_id.
create index ix_stock_ledger_ref on public.stock_ledger (ref_type, ref_id);
create index ix_stock_ledger_store_time on public.stock_ledger (store_id, created_at);

-- ---------------------------------------------------------------------------
-- Trigger cập nhật tồn kho
--
-- phase-1.md §2 mô tả "after insert ... đồng thời điền balance_after vào chính
-- dòng ledger vừa ghi". Điền vào dòng đã ghi nghĩa là UPDATE stock_ledger, mâu
-- thuẫn trực tiếp với kỷ luật append-only ở §3 cùng file. Dùng BEFORE INSERT:
-- một trigger duy nhất vừa cộng dồn tồn vừa gán balance_after, không cần UPDATE.
--
-- Trigger chạy THEO TỪNG DÒNG nên một đơn có 2 dòng cùng variant_id vẫn cộng dồn
-- đúng. Nếu ai đó "tối ưu" thành một câu upsert cho cả lô, Postgres sẽ raise
-- 21000 "cannot affect row a second time". Đừng làm.
--
-- Đây phải là trigger BEFORE INSERT DUY NHẤT trên bảng này. Một trigger BEFORE
-- khác trả về NULL sẽ huỷ dòng ledger nhưng tồn kho ĐÃ bị cộng, và không có lỗi
-- nào được raise — tồn kho sai âm thầm.
-- ---------------------------------------------------------------------------
create or replace function public.fn_stock_ledger_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance numeric(14, 3);
begin
  insert into public.stock_balances as sb (store_id, variant_id, qty_base, updated_at)
  values (new.store_id, new.variant_id, new.qty_base, now())
  on conflict (store_id, variant_id) do update
    set qty_base = sb.qty_base + new.qty_base,
        updated_at = now()
  returning sb.qty_base into v_balance;

  new.balance_after := v_balance;
  return new;
end
$$;

create trigger trg_stock_ledger_apply
  before insert on public.stock_ledger
  for each row execute function public.fn_stock_ledger_apply();

-- ---------------------------------------------------------------------------
-- Sổ kho bất biến
--
-- REVOKE UPDATE/DELETE (0013) KHÔNG có tác dụng với chủ sở hữu bảng, mà RPC
-- SECURITY DEFINER chạy chính dưới quyền `postgres` là chủ bảng ở đây. Muốn
-- tiêu chí "UPDATE stock_ledger bị từ chối với MỌI role" đúng theo nghĩa đen
-- thì phải chặn bằng trigger, vì trigger không dựa trên quyền.
--
-- Trung thực về giới hạn: `ALTER TABLE ... DISABLE TRIGGER` vẫn vô hiệu hoá được
-- nó. Đây là chống nhầm lẫn và chống code sai, không phải chống người đã có
-- service key và SQL Editor.
-- ---------------------------------------------------------------------------
create or replace function public.fn_stock_ledger_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception
    'stock_ledger chỉ được ghi thêm — % bị từ chối. Sai thì lập phiếu điều chỉnh.', tg_op
    using errcode = '0A000';
end
$$;

create trigger trg_stock_ledger_no_update_delete
  before update or delete on public.stock_ledger
  for each row execute function public.fn_stock_ledger_immutable();

-- Trigger cấp dòng KHÔNG bắt TRUNCATE, phải có trigger cấp câu lệnh riêng.
create trigger trg_stock_ledger_no_truncate
  before truncate on public.stock_ledger
  for each statement execute function public.fn_stock_ledger_immutable();
