-- 0013_rls_policies.sql
-- Toàn bộ RLS, policy và phân quyền cấp bảng.
--
-- Mục đích của RLS ở dự án này là TÁCH DỮ LIỆU GIỮA 2 CỬA HÀNG, không phải chống
-- người dùng nội bộ. Người bán là người nhà, và giá vốn đã bị loại khỏi scope.
--
-- KHÔNG policy nào được để điều kiện là hằng đúng. Câu này cố tình không viết ra
-- chuỗi bị cấm, vì tiêu chí nghiệm thu của phase là một lệnh grep trên thư mục
-- này — một chú thích nhắc quy tắc mà lại làm grep báo đỏ thì tự phá chính nó.

-- ---------------------------------------------------------------------------
-- 0. Kiểm tra giả định nền
--
-- Mọi đường ghi vào bảng giao dịch là RPC SECURITY DEFINER do `postgres` sở hữu.
-- FORCE ROW LEVEL SECURITY áp RLS lên cả chủ bảng, nhưng thuộc tính BYPASSRLS
-- của role thì thắng cả FORCE. Nếu giả định đó sai thì mọi RPC sẽ chết ngay khi
-- viết, và tốt nhất là chết ở đây với thông báo rõ ràng.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_roles
    where rolname = 'postgres' and (rolsuper or rolbypassrls)
  ) then
    raise exception
      'Role postgres không có BYPASSRLS: FORCE RLS sẽ chặn chính các RPC SECURITY DEFINER. Bỏ FORCE trên các bảng giao dịch trước khi đi tiếp.';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 1. Thu hồi quyền mặc định của Supabase
--
-- Supabase cấp mặc định ALL trên bảng mới trong schema public cho anon,
-- authenticated và service_role (config.toml: auto_expose_new_tables mặc định
-- true trên cloud). 02-phan-quyen.md §4.3 chỉ thu hồi từ authenticated — chưa đủ.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;

-- authenticated có quyền CREATE trên schema public theo mặc định của Supabase.
-- Nghĩa là người dùng thường tạo được hàm đè lên tên mà hàm SECURITY DEFINER của
-- ta gọi. Đây là leo thang đặc quyền có thật, không phải giả định.
revoke create on schema public from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Bật RLS trên MỌI bảng
--
-- Duyệt toàn bộ schema thay vì liệt kê tay: liệt kê tay thì quên một bảng là
-- bảng đó mở toang, và không có gì báo cho biết.
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format('alter table public.%I force row level security', r.tablename);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. Policy — bảng tổ chức
-- ---------------------------------------------------------------------------

-- Chỉ thấy cửa hàng mình được gán. Owner cả 2 cửa hàng thì thấy cả 2.
create policy sel_stores on public.stores for select to authenticated
  using (id in (select public.fn_my_store_ids()));

create policy upd_stores on public.stores for update to authenticated
  using (public.fn_is_owner(id))
  with check (public.fn_is_owner(id));

-- store_members: thấy dòng của chính mình, và owner thấy mọi dòng của cửa hàng
-- mình quản lý. fn_is_owner là SECURITY DEFINER nên tự nó đọc được store_members,
-- không có đệ quy policy.
create policy sel_store_members on public.store_members for select to authenticated
  using (user_id = auth.uid() or public.fn_is_owner(store_id));

-- Hồ sơ người dùng đọc được cho mọi người đã đăng nhập, để hiển thị "người tạo
-- đơn". Chỉ sửa được hồ sơ của chính mình.
create policy sel_profiles on public.profiles for select to authenticated
  using (auth.uid() is not null);

create policy upd_profiles_self on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. Policy — bảng DÙNG CHUNG (không có store_id)
--
-- Đọc: mọi user đã đăng nhập. Ghi: chỉ owner.
-- Ngoại lệ duy nhất là customers — staff được THÊM khách mới (khách mới tới mua
-- sỉ) nhưng không được sửa hay xoá khách đã có.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'item_groups', 'uoms', 'suppliers', 'products',
    'product_uoms', 'product_variants', 'product_barcodes'
  ]
  loop
    execute format(
      'create policy sel_%1$s on public.%1$I for select to authenticated
         using (auth.uid() is not null)', t);
    execute format(
      'create policy ins_%1$s on public.%1$I for insert to authenticated
         with check (public.fn_is_any_owner())', t);
    execute format(
      'create policy upd_%1$s on public.%1$I for update to authenticated
         using (public.fn_is_any_owner()) with check (public.fn_is_any_owner())', t);
    execute format(
      'create policy del_%1$s on public.%1$I for delete to authenticated
         using (public.fn_is_any_owner())', t);
  end loop;
end
$$;

create policy sel_customers on public.customers for select to authenticated
  using (auth.uid() is not null);

-- Ngoại lệ có chủ đích: staff thêm được khách mới.
create policy ins_customers on public.customers for insert to authenticated
  with check (auth.uid() is not null);

create policy upd_customers on public.customers for update to authenticated
  using (public.fn_is_any_owner())
  with check (public.fn_is_any_owner());

create policy del_customers on public.customers for delete to authenticated
  using (public.fn_is_any_owner());

-- ---------------------------------------------------------------------------
-- 5. Policy — bảng CẤU HÌNH theo cửa hàng
-- Chỉ owner của ĐÚNG cửa hàng đó được ghi.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array['price_lists', 'price_list_items']
  loop
    execute format(
      'create policy sel_%1$s on public.%1$I for select to authenticated
         using (store_id in (select public.fn_my_store_ids()))', t);
    execute format(
      'create policy ins_%1$s on public.%1$I for insert to authenticated
         with check (public.fn_is_owner(store_id))', t);
    execute format(
      'create policy upd_%1$s on public.%1$I for update to authenticated
         using (public.fn_is_owner(store_id))
         with check (public.fn_is_owner(store_id))', t);
    execute format(
      'create policy del_%1$s on public.%1$I for delete to authenticated
         using (public.fn_is_owner(store_id))', t);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 6. Policy — bảng GIAO DỊCH: chỉ ĐỌC, ghi hoàn toàn qua RPC
--
-- Không có policy INSERT/UPDATE/DELETE nào, và quyền cấp bảng cũng không được
-- cấp lại ở mục 9. Hai lớp cùng chặn.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'stock_ledger', 'stock_balances',
    'orders', 'order_items', 'payments',
    'receipts', 'receipt_allocations',
    'inbound_receipts', 'inbound_items',
    'supplier_payments', 'supplier_payment_allocations',
    'returns', 'return_items',
    'cash_transactions'
  ]
  loop
    execute format(
      'create policy sel_%1$s on public.%1$I for select to authenticated
         using (store_id in (select public.fn_my_store_ids()))', t);
  end loop;
end
$$;

-- Ca làm việc: staff chỉ thấy ca của chính mình, owner thấy mọi ca của cửa hàng
-- mình quản lý (02-phan-quyen.md §4.5).
create policy sel_cash_shifts on public.cash_shifts for select to authenticated
  using (
    store_id in (select public.fn_my_store_ids())
    and (user_id = auth.uid() or public.fn_is_owner(store_id))
  );

-- ---------------------------------------------------------------------------
-- 7. Policy — kiểm kê: ghi trực tiếp được khi còn draft
--
-- Cả staff lẫn owner của cửa hàng đó đều thao tác được, nhưng chỉ khi phiếu ở
-- trạng thái draft. Chuyển sang 'submitted' KHÔNG làm được bằng UPDATE trực tiếp
-- vì WITH CHECK sẽ chặn — đó là chủ ý: chốt phiếu phải đi qua
-- rpc_submit_stock_take để còn sinh bút toán kho.
-- ---------------------------------------------------------------------------
create policy sel_stock_takes on public.stock_takes for select to authenticated
  using (store_id in (select public.fn_my_store_ids()));

create policy ins_stock_takes on public.stock_takes for insert to authenticated
  with check (store_id in (select public.fn_my_store_ids()) and status = 'draft');

create policy upd_stock_takes on public.stock_takes for update to authenticated
  using (store_id in (select public.fn_my_store_ids()) and status = 'draft')
  with check (store_id in (select public.fn_my_store_ids()) and status = 'draft');

create policy del_stock_takes on public.stock_takes for delete to authenticated
  using (store_id in (select public.fn_my_store_ids()) and status = 'draft');

create policy sel_stock_take_items on public.stock_take_items for select to authenticated
  using (store_id in (select public.fn_my_store_ids()));

create policy ins_stock_take_items on public.stock_take_items for insert to authenticated
  with check (
    store_id in (select public.fn_my_store_ids())
    and exists (
      select 1 from public.stock_takes st
      where st.id = take_id and st.status = 'draft'
    )
  );

create policy upd_stock_take_items on public.stock_take_items for update to authenticated
  using (
    store_id in (select public.fn_my_store_ids())
    and exists (
      select 1 from public.stock_takes st
      where st.id = take_id and st.status = 'draft'
    )
  )
  with check (
    store_id in (select public.fn_my_store_ids())
    and exists (
      select 1 from public.stock_takes st
      where st.id = take_id and st.status = 'draft'
    )
  );

create policy del_stock_take_items on public.stock_take_items for delete to authenticated
  using (
    store_id in (select public.fn_my_store_ids())
    and exists (
      select 1 from public.stock_takes st
      where st.id = take_id and st.status = 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- 8. Policy — audit_log
--
-- store_id IS NULL là hành động toàn cục (sửa danh mục, sửa sản phẩm). Thiếu
-- nhánh đó thì đúng nhóm log mà owner quan tâm nhất lại bị ẩn.
-- ---------------------------------------------------------------------------
create policy sel_audit_log on public.audit_log for select to authenticated
  using (
    store_id in (select public.fn_my_store_ids())
    or (store_id is null and public.fn_is_any_owner())
  );

-- number_sequences: CỐ Ý không có policy nào. RLS bật + 0 policy = từ chối mọi
-- thứ với role không bypass. Client không bao giờ cần đọc bảng này; chỉ
-- fn_next_doc_no (SECURITY DEFINER) chạm tới nó.

-- ---------------------------------------------------------------------------
-- 9. Quyền cấp bảng — cấp lại đúng những gì cần
--
-- Policy quyết định THẤY ĐƯỢC DÒNG NÀO. Quyền cấp bảng quyết định CÓ ĐƯỢC THỬ
-- HAY KHÔNG. Bảng giao dịch bị chặn ở cả hai lớp.
-- ---------------------------------------------------------------------------
grant select on all tables in schema public to authenticated;

-- Client không bao giờ đọc dãy số chứng từ.
revoke all on public.number_sequences from authenticated;

-- Danh mục dùng chung: policy đã giới hạn về owner (trừ ins_customers).
grant insert, update, delete on
  public.item_groups, public.uoms, public.suppliers, public.customers,
  public.products, public.product_uoms, public.product_variants,
  public.product_barcodes
to authenticated;

-- Cấu hình theo cửa hàng: policy đã giới hạn về owner của đúng cửa hàng.
grant insert, update, delete on
  public.price_lists, public.price_list_items
to authenticated;

-- Kiểm kê: ghi trực tiếp khi còn draft.
grant insert, update, delete on
  public.stock_takes, public.stock_take_items
to authenticated;

grant update on public.stores to authenticated;
grant update on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Sổ kho — append-only với MỌI role, kể cả service_role
--
-- Đây chỉ là lớp thứ hai. Lớp thật là trigger trg_stock_ledger_no_update_delete
-- ở 0005: REVOKE không có tác dụng với chủ sở hữu bảng, mà RPC SECURITY DEFINER
-- chạy chính dưới quyền chủ bảng.
-- ---------------------------------------------------------------------------
revoke update, delete, truncate on public.stock_ledger
  from anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Quyền thực thi hàm
--
-- Postgres cấp EXECUTE cho PUBLIC trên mọi hàm mới, Supabase cấp thêm cho anon.
-- Không thu hồi thì mọi RPC SECURITY DEFINER viết ở các phase sau là một endpoint
-- gọi được khi CHƯA ĐĂNG NHẬP. Tiêu chí "anon không đọc được bảng nào" chỉ nói
-- về bảng, chưa đủ.
--
-- ALTER DEFAULT PRIVILEGES làm điều đó có hiệu lực cho cả hàm tạo ở phase sau,
-- nên các phase sau không phải nhớ lặp lại.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- Cấp lại TƯỜNG MINH cho authenticated, không dựa vào quyền mặc định của Supabase.
-- Lý do: quyền mặc định nằm trong pg_default_acl gắn theo schema, nên `drop schema
-- public cascade` (đúng quy trình seed lại ở supabase/seed.sql) sẽ xoá sạch chúng.
-- Khi đó revoke ở trên biến mọi policy dùng fn_my_store_ids thành
-- "permission denied for function" và TOÀN BỘ ứng dụng chết, dù RLS vẫn "đúng".
--
-- authenticated cần gọi được:
--   fn_my_store_ids / fn_is_owner / fn_is_any_owner — mọi policy đều dùng
--   fn_today_vn        — v_current_prices (security_invoker) và default của cột ngày
--   fn_unaccent_lower  — generated column khi thêm sản phẩm / khách / NCC
--   rpc_rebuild_stock_balances — công cụ cứu hộ, tự kiểm tra fn_is_owner bên trong
--   các hàm trigger    — cấp cho chắc; hàm trigger không gọi trực tiếp được bằng SQL
grant execute on all functions in schema public to authenticated;

-- Hai hàm authenticated KHÔNG được gọi:
--   fn_next_doc_no            — gọi thẳng sẽ đốt số chứng từ mà không sinh chứng từ
--   fn_assert_stock_integrity — đọc xuyên mọi cửa hàng, phá cách ly dữ liệu
-- Chỉ RPC (chạy dưới quyền postgres) và công cụ dòng lệnh được gọi.
revoke execute on function public.fn_next_doc_no(uuid, text) from authenticated;
revoke execute on function public.fn_assert_stock_integrity(uuid) from authenticated;

-- LƯU Ý CHO PHASE SAU: `grant ... on all functions` là ảnh chụp tại thời điểm chạy.
-- Mỗi RPC mới phải tự cấp quyền cho authenticated trong migration của nó, nếu không
-- client gọi sẽ nhận 42501. Đây là kiểu hỏng ồn ào và dễ thấy — cố ý chọn như vậy
-- thay vì mở mặc định cho mọi hàm tương lai.

-- ---------------------------------------------------------------------------
-- 12. View
--
-- View không kế thừa quyền của bảng nền, phải cấp riêng. v_current_prices có
-- security_invoker = true nên vẫn chịu RLS của price_list_items.
-- ---------------------------------------------------------------------------
grant select on public.v_current_prices to authenticated;
