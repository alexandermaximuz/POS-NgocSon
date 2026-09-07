-- 0016_catalog_rpc.sql
-- RPC danh mục hàng hoá: lưu sản phẩm (kèm đơn vị, biến thể, mã vạch), xoá sản
-- phẩm, xoá nhóm hàng, sinh mã vạch nội bộ. Phase 3.
--
-- ===========================================================================
-- VÌ SAO DANH MỤC CẦN RPC, TRONG KHI 0013 ĐÃ GRANT INSERT/UPDATE/DELETE
-- ===========================================================================
--
-- 0013:285-289 grant thẳng insert/update/delete trên bảng danh mục cho
-- authenticated, có policy giới hạn về owner. Nhưng:
--
--   1. Hai constraint trigger ở 0003 (trg_product_has_default_variant,
--      trg_product_has_base_uom) là DEFERRABLE INITIALLY DEFERRED. Một
--      `.insert()` trần từ PostgREST luôn nổ ở COMMIT với 23514 và message
--      tiếng Việt có nhúng uuid — client không dịch được thành thông báo cho
--      người dùng. Chỉ `SET CONSTRAINTS ALL IMMEDIATE` bên trong
--      BEGIN ... EXCEPTION mới bắt được (phase-1.md:106-110).
--   2. Lưu một sản phẩm đụng 4 bảng. PostgREST không có transaction bắc qua
--      nhiều request; nửa chừng lỗi là để lại sản phẩm không có biến thể.
--
-- Khách hàng, nhà cung cấp, và thêm/sửa nhóm hàng KHÔNG có RPC: một bảng, không
-- ràng buộc hoãn, và policy ở 0013 đã diễn đạt đúng luật nghiệp vụ (staff thêm
-- được khách, không sửa/xoá được). Bọc thêm một lớp RPC ở đó chỉ là chi phí.
-- Riêng XOÁ thì có RPC, vì cần dịch 23503 (khoá ngoại RESTRICT) thành câu nói
-- được là vướng cái gì.
--
-- Mọi mã lỗi raise ở đây là chuỗi SCREAMING_SNAKE tiếng Anh; tiếng Việt nằm ở
-- src/lib/errors.ts, đúng khuôn 0014.

-- ---------------------------------------------------------------------------
-- 1. Guard — hàm SECURITY DEFINER có ghi được vào bảng FORCE RLS không
--
-- Cùng lý do như 0014:52-70. 0013 bật force row level security cho mọi bảng;
-- FORCE gỡ miễn trừ của chủ bảng, chỉ thuộc tính BYPASSRLS của ROLE mới thắng.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception
      'Role % không có BYPASSRLS. Hàm SECURITY DEFINER tạo ra sẽ bị FORCE RLS chặn khi ghi bảng danh mục.',
      current_user;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Khôi phục quyền mặc định trên hàm
--
-- pg_default_acl không sống sót qua `drop schema public cascade` — quy trình
-- seed lại chính thức của repo (0014:72-85). Đặt trước các create function bên
-- dưới để chúng được bảo vệ ngay từ lúc sinh ra.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------------
-- 3. Dãy số cho mã vạch nội bộ
--
-- Quy tắc cố định (phase-3.md §2): 'NS' + 8 chữ số tuần tự, in bằng Code128.
-- Bắt đầu từ 100000 để không đè dải NS00000001…NS00000046 mà seed.sql:230 đã
-- phát cho 22 biến thể không có mã nhà sản xuất.
--
-- Không cấp quyền cho authenticated: chỉ rpc_add_internal_barcode được nextval,
-- nếu không client tự đốt số và tạo lỗ hổng trong dãy.
-- ---------------------------------------------------------------------------
create sequence public.seq_internal_barcode start with 100000;

revoke all on sequence public.seq_internal_barcode from public, anon, authenticated;

comment on sequence public.seq_internal_barcode is
  'Nguồn số duy nhất cho mã vạch nội bộ NS########. Chỉ rpc_add_internal_barcode dùng.';

-- ---------------------------------------------------------------------------
-- 4. rpc_save_product — {id?, sku, name, item_group_id, base_uom_id, brand?,
--    default_supplier_id?, safety_stock?, status?, description?,
--    uoms:[{uom_id, factor}], variants:[{id?, variant_code, attr_color?,
--    attr_note?, is_default?, status?}], barcodes:[{variant_code, barcode, source}]}
--
-- id = null là tạo mới.
--
-- Ba quyết định đáng ghi lại:
--
--   * product_uoms và product_barcodes được XOÁ SẠCH RỒI GHI LẠI. Không bảng
--     nào trỏ vào chúng (order_items.uom_id trỏ thẳng uoms, không trỏ
--     product_uoms), nên đây là cách ngắn nhất và không mất dữ liệu. Nó cũng
--     tránh được thế kẹt khi đổi đơn vị gốc: dòng factor = 1 cũ và mới không bao
--     giờ cùng tồn tại, nên ux_product_uoms_base (IMMEDIATE) không nổ giữa chừng.
--   * product_variants thì KHÔNG được xoá sạch: stock_ledger trỏ variant_id.
--     Đồng bộ theo id, và biến thể bị bỏ mà đã có phát sinh kho thì báo
--     VARIANT_IN_USE thay vì để 23503 nổ.
--   * is_default hạ hết xuống false trước rồi mới nâng đúng một dòng, vì
--     ux_product_variants_one_default là index IMMEDIATE, nổ ngay trong câu lệnh.
--     Trạng thái "không dòng nào default" ở giữa là hợp lệ vì trigger kiểm đếm
--     lại là DEFERRED.
-- ---------------------------------------------------------------------------
create or replace function public.rpc_save_product(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id        uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_sku       text := nullif(btrim(coalesce(p_payload ->> 'sku', '')), '');
  v_name      text := nullif(btrim(coalesce(p_payload ->> 'name', '')), '');
  v_group     uuid := nullif(p_payload ->> 'item_group_id', '')::uuid;
  v_base_uom  uuid := nullif(p_payload ->> 'base_uom_id', '')::uuid;
  v_brand     text := nullif(btrim(coalesce(p_payload ->> 'brand', '')), '');
  v_supplier  uuid := nullif(p_payload ->> 'default_supplier_id', '')::uuid;
  v_status    text := coalesce(nullif(p_payload ->> 'status', ''), 'active');
  v_desc      text := nullif(btrim(coalesce(p_payload ->> 'description', '')), '');
  v_safety    numeric(14, 3);
  v_uoms      jsonb := coalesce(p_payload -> 'uoms', '[]'::jsonb);
  v_variants  jsonb := coalesce(p_payload -> 'variants', '[]'::jsonb);
  v_barcodes  jsonb := coalesce(p_payload -> 'barcodes', '[]'::jsonb);
  v_is_new    boolean := v_id is null;
  v_conflict  text;
  v_default   uuid;
  v_row       jsonb;
  v_vid       uuid;
  v_counts    record;
begin
  if auth.uid() is null or not public.fn_is_any_owner() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_sku is null or v_name is null or v_group is null or v_base_uom is null then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  -- Validate TRƯỚC khi cast sang enum: giá trị lạ cho 22P02, message tiếng Anh
  -- của Postgres mà client không dịch được (0014:411-415).
  if v_status not in ('active', 'inactive') then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  if jsonb_typeof(v_uoms) <> 'array'
     or jsonb_typeof(v_variants) <> 'array'
     or jsonb_typeof(v_barcodes) <> 'array' then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  begin
    v_safety := coalesce(nullif(p_payload ->> 'safety_stock', '')::numeric(14, 3), 0);
  exception when others then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end;

  if v_safety < 0 then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  -- Kiểm trùng TRƯỚC khi để unique index nổ: giao diện cần biết mã nào trùng,
  -- 23505 thô không nói được điều đó (0014:244-246).
  select p.sku into v_conflict
  from public.products p
  where p.sku = v_sku and (v_id is null or p.id <> v_id);

  if v_conflict is not null then
    raise exception 'DUPLICATE_SKU' using errcode = '23505', detail = v_conflict;
  end if;

  -- -------------------------------------------------------------------------
  -- products
  -- -------------------------------------------------------------------------
  if v_is_new then
    insert into public.products
      (sku, name, item_group_id, base_uom_id, brand, default_supplier_id,
       safety_stock, status, description, created_by)
    values
      (v_sku, v_name, v_group, v_base_uom, v_brand, v_supplier,
       v_safety, v_status::public.entity_status, v_desc, auth.uid())
    returning id into v_id;
  else
    update public.products p
       set sku = v_sku,
           name = v_name,
           item_group_id = v_group,
           base_uom_id = v_base_uom,
           brand = v_brand,
           default_supplier_id = v_supplier,
           safety_stock = v_safety,
           status = v_status::public.entity_status,
           description = v_desc
     where p.id = v_id;

    if not found then
      raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
    end if;
  end if;

  -- -------------------------------------------------------------------------
  -- product_uoms — xoá sạch rồi ghi lại, đơn vị gốc luôn factor = 1
  -- -------------------------------------------------------------------------
  delete from public.product_uoms pu where pu.product_id = v_id;

  insert into public.product_uoms (product_id, uom_id, factor, created_by)
  values (v_id, v_base_uom, 1, auth.uid());

  -- distinct on: người dùng thêm "Thùng" hai lần thì lấy dòng đầu. Không lọc thì
  -- ON CONFLICT nổ 21000 "cannot affect row a second time" — lỗi tiếng Anh thô.
  -- Bọc exception vì factor rác cho 22P02, cũng không dịch được.
  begin
    insert into public.product_uoms (product_id, uom_id, factor, created_by)
    select distinct on (u.uom_id) v_id, u.uom_id, u.factor, auth.uid()
    from (
      select nullif(e ->> 'uom_id', '')::uuid as uom_id,
             (e ->> 'factor')::numeric(12, 4) as factor,
             ord
      from jsonb_array_elements(v_uoms) with ordinality as t(e, ord)
    ) u
    where u.uom_id is not null and u.uom_id <> v_base_uom
    order by u.uom_id, u.ord;
  exception when others then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end;

  -- -------------------------------------------------------------------------
  -- product_variants — đồng bộ theo id, không xoá sạch
  -- -------------------------------------------------------------------------
  if jsonb_array_length(v_variants) = 0 then
    -- "Tự tạo 1 biến thể mặc định nếu người dùng không khai màu nào"
    -- (phase-3.md §2). Mã biến thể trùng mã sản phẩm, đúng như seed.sql:218.
    v_variants := jsonb_build_array(
      jsonb_build_object('variant_code', v_sku, 'is_default', true)
    );
  end if;

  -- Mọi id gửi lên phải là biến thể của chính sản phẩm này.
  if exists (
    select 1
    from jsonb_array_elements(v_variants) as e
    where nullif(e ->> 'id', '') is not null
      and not exists (
        select 1 from public.product_variants pv
        where pv.id = (e ->> 'id')::uuid and pv.product_id = v_id
      )
  ) then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  select string_agg(pv.variant_code, ', ') into v_conflict
  from public.product_variants pv
  where pv.variant_code = any (
          select e ->> 'variant_code' from jsonb_array_elements(v_variants) as e
        )
    and pv.product_id <> v_id;

  if v_conflict is not null then
    raise exception 'DUPLICATE_VARIANT_CODE' using errcode = '23505', detail = v_conflict;
  end if;

  -- Biến thể bị bỏ mà đã có phát sinh kho thì không xoá được. Nói tên ra, đừng
  -- để 23503 nổ với message của Postgres.
  select string_agg(pv.variant_code, ', ') into v_conflict
  from public.product_variants pv
  where pv.product_id = v_id
    and not exists (
      select 1 from jsonb_array_elements(v_variants) as e
      where nullif(e ->> 'id', '')::uuid = pv.id
    )
    and exists (select 1 from public.stock_ledger sl where sl.variant_id = pv.id);

  if v_conflict is not null then
    raise exception 'VARIANT_IN_USE' using errcode = 'P0001', detail = v_conflict;
  end if;

  begin
    delete from public.product_variants pv
    where pv.product_id = v_id
      and not exists (
        select 1 from jsonb_array_elements(v_variants) as e
        where nullif(e ->> 'id', '')::uuid = pv.id
      );
  exception when foreign_key_violation then
    -- Lưới cuối: stock_ledger đã chặn ở trên, nhưng order_items / stock_take_items
    -- / return_items cũng trỏ variant_id và có thể tồn tại độc lập.
    raise exception 'VARIANT_IN_USE' using errcode = 'P0001';
  end;

  -- Hạ hết default xuống trước: ux_product_variants_one_default là IMMEDIATE.
  update public.product_variants pv
     set is_default = false
   where pv.product_id = v_id and pv.is_default;

  for v_row in select e from jsonb_array_elements(v_variants) as e loop
    v_vid := nullif(v_row ->> 'id', '')::uuid;

    if nullif(btrim(coalesce(v_row ->> 'variant_code', '')), '') is null then
      raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
    end if;

    if coalesce(v_row ->> 'status', 'active') not in ('active', 'inactive') then
      raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
    end if;

    if v_vid is null then
      insert into public.product_variants
        (product_id, variant_code, attr_color, attr_note, is_default, status, created_by)
      values
        (v_id,
         btrim(v_row ->> 'variant_code'),
         nullif(btrim(coalesce(v_row ->> 'attr_color', '')), ''),
         nullif(btrim(coalesce(v_row ->> 'attr_note', '')), ''),
         false,
         coalesce(v_row ->> 'status', 'active')::public.entity_status,
         auth.uid())
      returning id into v_vid;
    else
      update public.product_variants pv
         set variant_code = btrim(v_row ->> 'variant_code'),
             attr_color = nullif(btrim(coalesce(v_row ->> 'attr_color', '')), ''),
             attr_note = nullif(btrim(coalesce(v_row ->> 'attr_note', '')), ''),
             status = coalesce(v_row ->> 'status', 'active')::public.entity_status
       where pv.id = v_vid;
    end if;

    if v_default is null and coalesce((v_row ->> 'is_default')::boolean, false) then
      v_default := v_vid;
    end if;
  end loop;

  -- Không ai đánh dấu thì lấy biến thể đầu tiên. Đúng 1 default là ràng buộc
  -- cứng ở 0003:172, không phải tuỳ chọn.
  if v_default is null then
    select pv.id into v_default
    from public.product_variants pv
    where pv.product_id = v_id
    order by pv.created_at, pv.variant_code
    limit 1;
  end if;

  update public.product_variants pv set is_default = true where pv.id = v_default;

  -- -------------------------------------------------------------------------
  -- product_barcodes — xoá sạch rồi ghi lại, khớp theo variant_code
  -- -------------------------------------------------------------------------
  select string_agg(pb.barcode, ', ') into v_conflict
  from public.product_barcodes pb
  join public.product_variants pv on pv.id = pb.variant_id
  where pb.barcode = any (
          select e ->> 'barcode' from jsonb_array_elements(v_barcodes) as e
        )
    and pv.product_id <> v_id;

  if v_conflict is not null then
    raise exception 'DUPLICATE_BARCODE' using errcode = '23505', detail = v_conflict;
  end if;

  delete from public.product_barcodes pb
  using public.product_variants pv
  where pv.id = pb.variant_id and pv.product_id = v_id;

  begin
    insert into public.product_barcodes (variant_id, barcode, source, created_by)
    select pv.id, btrim(e ->> 'barcode'),
           (e ->> 'source')::public.barcode_source, auth.uid()
    from jsonb_array_elements(v_barcodes) as e
    join public.product_variants pv
      on pv.product_id = v_id and pv.variant_code = e ->> 'variant_code'
    where nullif(btrim(coalesce(e ->> 'barcode', '')), '') is not null;
  exception
    when unique_violation then
      raise exception 'DUPLICATE_BARCODE' using errcode = '23505';
    when invalid_text_representation then
      raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end;

  -- -------------------------------------------------------------------------
  -- Ép hai constraint trigger DEFERRED nổ ngay, ở nơi bắt được
  --
  -- Khối này chỉ chứa SET CONSTRAINTS, nên savepoint ngầm của nó nằm SAU mọi
  -- insert ở trên — rollback về đó vẫn giữ nguyên dữ liệu vừa ghi, và các câu
  -- select trong handler đọc đúng trạng thái vừa dựng.
  -- -------------------------------------------------------------------------
  begin
    set constraints all immediate;
  exception when others then
    if (select count(*) from public.product_variants pv
        where pv.product_id = v_id and pv.is_default) <> 1 then
      raise exception 'MISSING_DEFAULT_VARIANT' using errcode = 'P0001';
    elsif not exists (
      select 1 from public.product_uoms pu
      where pu.product_id = v_id and pu.factor = 1 and pu.uom_id = v_base_uom
    ) then
      raise exception 'MISSING_BASE_UOM' using errcode = 'P0001';
    else
      raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
    end if;
  end;

  select
    (select count(*) from public.product_uoms pu where pu.product_id = v_id) as uoms,
    (select count(*) from public.product_variants pv where pv.product_id = v_id) as variants,
    (select count(*) from public.product_barcodes pb
       join public.product_variants pv on pv.id = pb.variant_id
      where pv.product_id = v_id) as barcodes
  into v_counts;

  -- audit_log.store_id để NULL: sửa danh mục dùng chung là hành động toàn cục,
  -- không thuộc cửa hàng nào (0011:5-9, và policy sel_audit_log ở 0013:263 có
  -- nhánh riêng cho nó).
  insert into public.audit_log (actor_id, store_id, action, entity, entity_id, after)
  values (
    auth.uid(), null,
    case when v_is_new then 'create_product' else 'update_product' end,
    'products', v_id,
    jsonb_build_object(
      'sku', v_sku, 'name', v_name, 'status', v_status,
      'uoms', v_counts.uoms, 'variants', v_counts.variants, 'barcodes', v_counts.barcodes
    )
  );

  return jsonb_build_object(
    'product_id', v_id,
    'sku', v_sku,
    'name', v_name,
    'created', v_is_new,
    'uom_count', v_counts.uoms,
    'variant_count', v_counts.variants,
    'barcode_count', v_counts.barcodes
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 5. rpc_delete_product — {id}
--
-- Xoá thật, không phải đánh dấu. Sản phẩm đã có phát sinh thì KHÔNG xoá được —
-- chứng từ đã chốt là bất biến, và một đơn hàng trỏ vào sản phẩm biến mất là
-- lịch sử không dựng lại được. Giao diện gợi ý chuyển status = 'inactive'.
-- ---------------------------------------------------------------------------
create or replace function public.rpc_delete_product(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_sku  text;
  v_name text;
begin
  if auth.uid() is null or not public.fn_is_any_owner() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select p.sku, p.name into v_sku, v_name
  from public.products p where p.id = v_id;

  if v_sku is null then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.stock_ledger sl
    join public.product_variants pv on pv.id = sl.variant_id
    where pv.product_id = v_id
  ) or exists (
    select 1 from public.price_list_items pli where pli.product_id = v_id
  ) then
    raise exception 'PRODUCT_IN_USE' using errcode = 'P0001', detail = v_sku;
  end if;

  begin
    delete from public.products p where p.id = v_id;
  exception when foreign_key_violation then
    raise exception 'PRODUCT_IN_USE' using errcode = 'P0001', detail = v_sku;
  end;

  insert into public.audit_log (actor_id, store_id, action, entity, entity_id, before)
  values (auth.uid(), null, 'delete_product', 'products', v_id,
          jsonb_build_object('sku', v_sku, 'name', v_name));

  return jsonb_build_object('product_id', v_id, 'sku', v_sku, 'name', v_name);
end
$$;

-- ---------------------------------------------------------------------------
-- 6. rpc_delete_item_group — {id}
--
-- "Không xoá được nhóm còn sản phẩm" (phase-3.md §1). Nhóm còn nhóm con cũng
-- không xoá: item_groups.parent_id là RESTRICT, và xoá cha để lại cây mồ côi.
-- ---------------------------------------------------------------------------
create or replace function public.rpc_delete_item_group(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid := nullif(p_payload ->> 'id', '')::uuid;
  v_name  text;
  v_count integer;
begin
  if auth.uid() is null or not public.fn_is_any_owner() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select g.name into v_name from public.item_groups g where g.id = v_id;

  if v_name is null then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  select count(*) into v_count from public.products p where p.item_group_id = v_id;

  if v_count > 0 then
    raise exception 'GROUP_IN_USE'
      using errcode = 'P0001', detail = v_count::text || ' sản phẩm';
  end if;

  select count(*) into v_count from public.item_groups g where g.parent_id = v_id;

  if v_count > 0 then
    raise exception 'GROUP_IN_USE'
      using errcode = 'P0001', detail = v_count::text || ' nhóm con';
  end if;

  begin
    delete from public.item_groups g where g.id = v_id;
  exception when foreign_key_violation then
    raise exception 'GROUP_IN_USE' using errcode = 'P0001';
  end;

  insert into public.audit_log (actor_id, store_id, action, entity, entity_id, before)
  values (auth.uid(), null, 'delete_item_group', 'item_groups', v_id,
          jsonb_build_object('name', v_name));

  return jsonb_build_object('item_group_id', v_id, 'name', v_name);
end
$$;

-- ---------------------------------------------------------------------------
-- 7. rpc_add_internal_barcode — {variant_id}
--
-- Sinh số và insert phải nằm trong một hàm: làm ở client thì hai lần bấm nhanh
-- ra hai lần cùng số. Vòng lặp retry phòng trường hợp dãy số đã bị dùng bằng tay.
-- ---------------------------------------------------------------------------
create or replace function public.rpc_add_internal_barcode(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_variant uuid := nullif(p_payload ->> 'variant_id', '')::uuid;
  v_code    text;
  v_try     integer := 0;
begin
  if auth.uid() is null or not public.fn_is_any_owner() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_variant is null
     or not exists (select 1 from public.product_variants pv where pv.id = v_variant) then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  loop
    v_try := v_try + 1;
    v_code := 'NS' || lpad(nextval('public.seq_internal_barcode')::text, 8, '0');

    begin
      insert into public.product_barcodes (variant_id, barcode, source, created_by)
      values (v_variant, v_code, 'internal', auth.uid());

      return jsonb_build_object('variant_id', v_variant, 'barcode', v_code);
    exception when unique_violation then
      if v_try >= 5 then
        raise exception 'DUPLICATE_BARCODE' using errcode = '23505';
      end if;
    end;
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 8. Quyền thực thi
--
-- Mục 2 đã đặt lại quyền mặc định, nhưng vẫn viết tường minh: quy ước của repo
-- là mỗi migration tự cấp quyền cho hàm của nó (0013:349-352).
-- ---------------------------------------------------------------------------
revoke execute on function
  public.rpc_save_product(jsonb), public.rpc_delete_product(jsonb),
  public.rpc_delete_item_group(jsonb), public.rpc_add_internal_barcode(jsonb)
  from public, anon;

grant execute on function
  public.rpc_save_product(jsonb), public.rpc_delete_product(jsonb),
  public.rpc_delete_item_group(jsonb), public.rpc_add_internal_barcode(jsonb)
  to authenticated;
