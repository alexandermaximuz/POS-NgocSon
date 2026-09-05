-- 0011_system.sql
-- Nhật ký thao tác, dãy số chứng từ, và hàm kiểm tra toàn vẹn tồn kho.

-- ---------------------------------------------------------------------------
-- audit_log — store_id NULLABLE có chủ đích
--
-- Sửa danh mục, sản phẩm hay bảng giá dùng chung là hành động toàn cục, không
-- thuộc cửa hàng nào. Policy ở 0013 phải có nhánh cho store_id IS NULL, nếu
-- không đúng nhóm log mà owner quan tâm nhất lại bị RLS ẩn đi.
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_id uuid default auth.uid() references auth.users (id),
  store_id uuid references public.stores (id),
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create index ix_audit_log_store_at on public.audit_log (store_id, at desc);
create index ix_audit_log_entity on public.audit_log (entity, entity_id);
create index ix_audit_log_global_at on public.audit_log (at desc) where store_id is null;

-- ---------------------------------------------------------------------------
-- number_sequences — client không bao giờ đọc bảng này.
-- Ở 0013 nó được bật RLS và KHÔNG có policy nào: RLS bật + 0 policy = từ chối
-- mọi thứ cho role không bypass. Đó mới là "deny by default" đúng nghĩa.
-- ---------------------------------------------------------------------------
create table public.number_sequences (
  store_id uuid not null references public.stores (id),
  doc_type text not null,
  period text not null,
  current_no integer not null default 0 check (current_no >= 0),
  primary key (store_id, doc_type, period)
);

-- ---------------------------------------------------------------------------
-- fn_next_doc_no — sinh số chứng từ
--
-- KHÁC spec 01-du-lieu.md §13: có nhúng mã cửa hàng. Bản trong spec sinh
-- 'HD-2026-00001' theo dãy riêng của từng cửa hàng (number_sequences khoá theo
-- store_id), trong khi orders.order_no lại UNIQUE toàn cục — hai cửa hàng sẽ
-- đụng nhau ngay đơn đầu tiên của năm. Nhúng mã cửa hàng giữ được cả tính duy
-- nhất toàn cục lẫn khả năng đọc số qua điện thoại mà biết ngay cửa hàng nào.
--
-- Kết quả: HD-CH1-2026-00001
-- Loại chứng từ: HD đơn bán · PN phiếu nhập · TH trả hàng · PT phiếu thu ·
--                PC phiếu chi NCC · KK kiểm kê
-- ---------------------------------------------------------------------------
create or replace function public.fn_next_doc_no(p_store uuid, p_type text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Năm theo giờ Việt Nam, không theo UTC: đơn bán lúc 23:30 ngày 31/12 phải
  -- mang số của năm cũ chứ không nhảy sang năm mới.
  v_period text := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYYY');
  v_code text;
  v_no integer;
begin
  select s.code into v_code from public.stores s where s.id = p_store;
  if v_code is null then
    raise exception 'Không tìm thấy cửa hàng %', p_store using errcode = '23503';
  end if;

  insert into public.number_sequences as ns (store_id, doc_type, period, current_no)
  values (p_store, p_type, v_period, 1)
  on conflict (store_id, doc_type, period)
  do update set current_no = ns.current_no + 1
  returning ns.current_no into v_no;

  return p_type || '-' || v_code || '-' || v_period || '-' || lpad(v_no::text, 5, '0');
end
$$;

-- ---------------------------------------------------------------------------
-- fn_assert_stock_integrity — kiểm tra bắt buộc sau mỗi phase động tới dữ liệu
--
-- Với MỌI (store_id, variant_id): SUM(stock_ledger.qty_base) phải bằng
-- stock_balances.qty_base. Trả về các dòng LỆCH; không lệch thì trả về rỗng.
--
-- Dùng FULL OUTER JOIN chứ không phải INNER JOIN. Inner join bỏ sót đúng hai
-- kiểu hỏng hay xảy ra nhất: có dòng stock_balances mà không có ledger nào, và
-- có ledger mà không có balance sau một lần rebuild dở dang.
-- ---------------------------------------------------------------------------
create or replace function public.fn_assert_stock_integrity(p_store uuid default null)
returns table (
  store_id uuid,
  variant_id uuid,
  ledger_sum numeric,
  balance_qty numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    coalesce(l.store_id, b.store_id),
    coalesce(l.variant_id, b.variant_id),
    coalesce(l.total, 0),
    coalesce(b.qty_base, 0)
  from (
    select sl.store_id, sl.variant_id, sum(sl.qty_base) as total
    from public.stock_ledger sl
    where p_store is null or sl.store_id = p_store
    group by sl.store_id, sl.variant_id
  ) l
  full outer join (
    select sb.store_id, sb.variant_id, sb.qty_base
    from public.stock_balances sb
    where p_store is null or sb.store_id = p_store
  ) b on b.store_id = l.store_id and b.variant_id = l.variant_id
  where coalesce(l.total, 0) <> coalesce(b.qty_base, 0)
$$;
