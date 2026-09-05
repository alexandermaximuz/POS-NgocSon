-- 0012_rls_helpers.sql
-- Hàm hỗ trợ cho policy, và công cụ cứu hộ tồn kho.
--
-- Cả ba hàm đều SECURITY DEFINER: policy trên store_members (0013) không được
-- gọi chúng, nhưng policy trên MỌI bảng khác thì có — và chúng phải đọc được
-- store_members bất kể RLS của bảng đó.

create or replace function public.fn_my_store_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sm.store_id from public.store_members sm where sm.user_id = auth.uid()
$$;

create or replace function public.fn_is_owner(p_store uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.store_members sm
    where sm.user_id = auth.uid()
      and sm.store_id = p_store
      and sm.role = 'owner'
  )
$$;

create or replace function public.fn_is_any_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.store_members sm
    where sm.user_id = auth.uid() and sm.role = 'owner'
  )
$$;

-- ---------------------------------------------------------------------------
-- rpc_rebuild_stock_balances — công cụ cứu hộ
--
-- Đặt ở 0012 chứ không phải 0011 như kế hoạch ban đầu, vì nó gọi fn_is_owner.
-- plpgsql phân giải tên hàm lúc chạy nên để ở 0011 vẫn tạo được, nhưng người
-- đọc 0011 sẽ thấy một lời gọi tới hàm chưa tồn tại.
--
-- Xoá và dựng lại toàn bộ stock_balances của một cửa hàng từ stock_ledger.
-- KHÔNG bao giờ ghi vào stock_ledger — sổ kho là nguồn sự thật, balances là cache.
-- Trả về số biến thể đã dựng lại và số dòng LỆCH so với trước khi dựng;
-- lệch > 0 là có vấn đề cần điều tra, không phải chuyện bình thường.
-- ---------------------------------------------------------------------------
create or replace function public.rpc_rebuild_stock_balances(p_store uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mismatched integer;
  v_rebuilt integer;
begin
  if not public.fn_is_owner(p_store) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  -- Đếm trước khi dựng lại, để biết cache đã sai bao nhiêu dòng.
  select count(*) into v_mismatched
  from public.fn_assert_stock_integrity(p_store);

  delete from public.stock_balances sb where sb.store_id = p_store;

  insert into public.stock_balances (store_id, variant_id, qty_base, updated_at)
  select sl.store_id, sl.variant_id, sum(sl.qty_base), now()
  from public.stock_ledger sl
  where sl.store_id = p_store
  group by sl.store_id, sl.variant_id;

  get diagnostics v_rebuilt = row_count;

  return jsonb_build_object(
    'store_id', p_store,
    'rebuilt_variants', v_rebuilt,
    'mismatched_before', v_mismatched
  );
end
$$;
