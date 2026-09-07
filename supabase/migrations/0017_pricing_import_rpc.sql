-- 0017_pricing_import_rpc.sql
-- RPC bảng giá và import Excel. Phase 3.
--
-- ===========================================================================
-- HAI QUY TẮC KHÔNG ĐƯỢC PHÁ
-- ===========================================================================
--
-- 1. price_list_items là APPEND-ONLY. Đổi giá là THÊM DÒNG MỚI với effective_from
--    mới, không bao giờ update dòng cũ (01-du-lieu.md §5, 0004:33-39). Lịch sử giá
--    là thứ duy nhất trả lời được câu "hôm đó bán giá bao nhiêu".
--
-- 2. Import chỉ THÊM MỚI. Dòng có SKU đã tồn tại bị bỏ qua và báo cảnh báo, không
--    ghi đè gì. Quyết định của chủ dự án khi lập kế hoạch Phase 3: một file Excel
--    cũ import nhầm mà ghi đè được cả danh mục là hỏng không có đường lùi, trong
--    khi sửa sản phẩm lẻ bằng form thì luôn làm được.
--
-- Dòng lỗi không chặn cả file (phase-3.md §5): mỗi dòng chạy trong khối
-- BEGIN ... EXCEPTION riêng, nên savepoint ngầm của plpgsql chỉ rollback đúng dòng
-- đó. Kèm theo đó là `set constraints all deferred` ở đầu mỗi dòng, vì
-- rpc_save_product kết thúc bằng `set constraints all immediate` và trạng thái đó
-- kéo dài tới hết transaction — để nguyên thì dòng thứ hai nổ ngay lúc insert
-- products, trước khi kịp có biến thể mặc định.

alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------------
-- 1. fn_variant_code_suffix — viết tắt màu thành đuôi mã biến thể
--
-- "Xanh dương" → XD, "Đỏ" → D, "Lá mạ" → LM. Đúng quy ước seed.sql:216-224 đang
-- dùng cho 8 sản phẩm có màu. Bỏ dấu trước khi lấy chữ cái đầu, nếu không "Đỏ"
-- ra "Đ" và mã biến thể có ký tự ngoài ASCII.
--
-- Nội bộ, không cấp cho authenticated: giao diện tự gợi ý mã ở phía client và
-- người dùng sửa được, đây chỉ là đường dùng cho import.
-- ---------------------------------------------------------------------------
create or replace function public.fn_variant_code_suffix(p_color text)
returns text
language sql
immutable
set search_path = ''
as $$
  select string_agg(upper(left(w, 1)), '')
  from regexp_split_to_table(
         btrim(public.fn_unaccent_lower(coalesce(p_color, ''))), '\s+'
       ) as w
  where w <> ''
$$;

-- ---------------------------------------------------------------------------
-- 2. rpc_update_price — {price_list_id, product_id, price_per_base_unit,
--    effective_from?}
--
-- Chỉ owner CỦA ĐÚNG CỬA HÀNG đó (03-rpc.md §rpc_update_price). fn_is_owner nhận
-- store_id lấy từ chính bảng giá, không nhận từ payload — client gửi store_id lên
-- thì nó chỉ là lời khai.
--
-- Trả previous_price để giao diện dựng được thông báo "40.000 → 42.000" từ số của
-- server, không phải từ giá trị còn nằm trong form (05-giao-dien.md §Xác nhận thao tác).
-- ---------------------------------------------------------------------------
create or replace function public.rpc_update_price(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_list     uuid := nullif(p_payload ->> 'price_list_id', '')::uuid;
  v_product  uuid := nullif(p_payload ->> 'product_id', '')::uuid;
  v_from     date;
  v_price    numeric(14, 2);
  v_store    uuid;
  v_previous numeric(14, 2);
  v_id       uuid;
  v_sku      text;
begin
  if auth.uid() is null or v_list is null or v_product is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  begin
    v_price := (p_payload ->> 'price_per_base_unit')::numeric(14, 2);
    v_from := coalesce(nullif(p_payload ->> 'effective_from', '')::date, public.fn_today_vn());
  exception when others then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end;

  if v_price is null or v_price < 0 then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  select pl.store_id into v_store from public.price_lists pl where pl.id = v_list;

  -- Bảng giá không tồn tại và bảng giá của cửa hàng khác trả cùng một lỗi: phân
  -- biệt hai cái đó là để người ta dò được id (0014 dùng đúng lối này).
  if v_store is null or not public.fn_is_owner(v_store) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select p.sku into v_sku from public.products p where p.id = v_product;

  if v_sku is null then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  select cp.price_per_base_unit into v_previous
  from public.v_current_prices cp
  where cp.price_list_id = v_list and cp.product_id = v_product;

  insert into public.price_list_items
    (store_id, price_list_id, product_id, price_per_base_unit, effective_from, created_by)
  values (v_store, v_list, v_product, v_price, v_from, auth.uid())
  returning id into v_id;

  insert into public.audit_log
    (actor_id, store_id, action, entity, entity_id, before, after)
  values (
    auth.uid(), v_store, 'update_price', 'price_list_items', v_id,
    jsonb_build_object('price_per_base_unit', v_previous),
    jsonb_build_object(
      'price_list_id', v_list, 'product_id', v_product, 'sku', v_sku,
      'price_per_base_unit', v_price, 'effective_from', v_from
    )
  );

  return jsonb_build_object(
    'price_list_item_id', v_id,
    'price_list_id', v_list,
    'product_id', v_product,
    'sku', v_sku,
    'previous_price', v_previous,
    'price_per_base_unit', v_price,
    'effective_from', v_from
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 3. rpc_import_products — {rows: [...]}
--
-- Mỗi phần tử rows là một dòng Excel đã chuẩn hoá ở client:
--   {row, sku, name, group_code, base_uom_code, brand?, supplier_code?,
--    safety_stock?, colors: [..], uoms: [{code, factor}]}
--
-- `row` là số dòng trong file, đi thẳng vào kết quả trả về để màn preview chỉ
-- đúng dòng nào hỏng.
--
-- Trả về mảng {row, sku, status, code}. status ∈ created | skipped | error.
-- skipped = SKU đã tồn tại. code là mã lỗi để client dịch sang tiếng Việt.
-- ---------------------------------------------------------------------------
create or replace function public.rpc_import_products(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows     jsonb := coalesce(p_payload -> 'rows', '[]'::jsonb);
  v_row      jsonb;
  v_results  jsonb := '[]'::jsonb;
  v_created  integer := 0;
  v_skipped  integer := 0;
  v_failed   integer := 0;
  v_no       integer;
  v_sku      text;
  v_group    uuid;
  v_uom      uuid;
  v_supplier uuid;
  v_variants jsonb;
  v_uoms     jsonb;
  v_code     text;
  v_suffix   text;
  v_seen     text[];
  v_n        integer;
  v_color    text;
begin
  if auth.uid() is null or not public.fn_is_any_owner() then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  -- Chặn payload quá lớn: client chia lô 100 dòng. Một file 2.000 dòng gửi một
  -- lần sẽ chạm statement_timeout và người dùng không biết đã ghi được tới đâu.
  if jsonb_array_length(v_rows) > 200 then
    raise exception 'IMPORT_BATCH_TOO_LARGE' using errcode = 'P0001';
  end if;

  for v_row in select e from jsonb_array_elements(v_rows) as e loop
    v_no := coalesce((v_row ->> 'row')::integer, 0);
    v_sku := upper(nullif(btrim(coalesce(v_row ->> 'sku', '')), ''));

    begin
      -- rpc_save_product kết thúc bằng `set constraints all immediate`, và trạng
      -- thái đó sống tới hết transaction. Không đặt lại thì dòng thứ hai nổ ngay
      -- ở insert products, lúc chưa kịp có biến thể mặc định.
      set constraints all deferred;

      if v_sku is null or nullif(btrim(coalesce(v_row ->> 'name', '')), '') is null then
        raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
      end if;

      if exists (select 1 from public.products p where p.sku = v_sku) then
        v_skipped := v_skipped + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_no, 'sku', v_sku, 'status', 'skipped', 'code', 'DUPLICATE_SKU'
        );
        -- CONTINUE ra khỏi khối có EXCEPTION là hợp lệ: plpgsql release
        -- subtransaction rồi mới trả điều khiển về vòng lặp, nên dòng đã ghi ở
        -- trên không bị mất.
        continue;
      end if;

      select g.id into v_group
      from public.item_groups g
      where g.code = upper(btrim(coalesce(v_row ->> 'group_code', '')));

      if v_group is null then
        raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001';
      end if;

      select u.id into v_uom
      from public.uoms u
      where u.code = upper(btrim(coalesce(v_row ->> 'base_uom_code', '')));

      if v_uom is null then
        raise exception 'UOM_NOT_FOUND' using errcode = 'P0001';
      end if;

      v_supplier := null;
      if nullif(btrim(coalesce(v_row ->> 'supplier_code', '')), '') is not null then
        select s.id into v_supplier
        from public.suppliers s
        where s.code = upper(btrim(v_row ->> 'supplier_code'));

        if v_supplier is null then
          raise exception 'SUPPLIER_NOT_FOUND' using errcode = 'P0001';
        end if;
      end if;

      -- Đơn vị lớn: mã đơn vị lạ là lỗi dòng, không phải bỏ qua âm thầm.
      select coalesce(jsonb_agg(jsonb_build_object('uom_id', u.id, 'factor', (e ->> 'factor')::numeric)), '[]'::jsonb)
        into v_uoms
      from jsonb_array_elements(coalesce(v_row -> 'uoms', '[]'::jsonb)) as e
      join public.uoms u on u.code = upper(btrim(e ->> 'code'));

      if jsonb_array_length(v_uoms)
         <> jsonb_array_length(coalesce(v_row -> 'uoms', '[]'::jsonb)) then
        raise exception 'UOM_NOT_FOUND' using errcode = 'P0001';
      end if;

      -- Biến thể: mã sinh theo SKU-<viết tắt màu>. Hai màu cùng viết tắt (Xanh
      -- dương / Xanh da trời) thì đánh số, chứ không để unique index nổ.
      v_variants := '[]'::jsonb;
      v_seen := array[]::text[];

      for v_color in
        select btrim(c) from jsonb_array_elements_text(coalesce(v_row -> 'colors', '[]'::jsonb)) as c
        where btrim(c) <> ''
      loop
        v_suffix := coalesce(public.fn_variant_code_suffix(v_color), 'X');
        v_code := v_sku || '-' || v_suffix;
        v_n := 1;

        while v_code = any (v_seen) loop
          v_n := v_n + 1;
          v_code := v_sku || '-' || v_suffix || v_n::text;
        end loop;

        v_seen := v_seen || v_code;
        v_variants := v_variants || jsonb_build_object(
          'variant_code', v_code,
          'attr_color', v_color,
          'is_default', jsonb_array_length(v_variants) = 0
        );
      end loop;

      -- Mảng rỗng: rpc_save_product tự tạo 1 biến thể mặc định mã trùng SKU.
      perform public.rpc_save_product(jsonb_build_object(
        'sku', v_sku,
        'name', btrim(v_row ->> 'name'),
        'item_group_id', v_group,
        'base_uom_id', v_uom,
        'brand', nullif(btrim(coalesce(v_row ->> 'brand', '')), ''),
        'default_supplier_id', v_supplier,
        'safety_stock', coalesce(nullif(v_row ->> 'safety_stock', ''), '0'),
        'status', 'active',
        'uoms', v_uoms,
        'variants', v_variants,
        'barcodes', '[]'::jsonb
      ));

      v_created := v_created + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_no, 'sku', v_sku, 'status', 'created', 'code', null
      );

    exception when others then
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_no, 'sku', v_sku, 'status', 'error', 'code', sqlerrm
      );
    end;
  end loop;

  insert into public.audit_log (actor_id, store_id, action, entity, entity_id, after)
  values (auth.uid(), null, 'import_products', 'products', null,
          jsonb_build_object('created', v_created, 'skipped', v_skipped, 'failed', v_failed));

  return jsonb_build_object(
    'created', v_created,
    'skipped', v_skipped,
    'failed', v_failed,
    'results', v_results
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 4. rpc_import_prices — {rows: [{row, sku, price_list_id, price}], effective_from?}
--
-- Giá không đổi so với giá đang hiệu lực thì KHÔNG ghi dòng mới. Import lại cùng
-- một file hai lần là chuyện thường; không lọc thì bảng giá đầy dòng trùng và
-- lịch sử giá mất ý nghĩa.
-- ---------------------------------------------------------------------------
create or replace function public.rpc_import_prices(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rows      jsonb := coalesce(p_payload -> 'rows', '[]'::jsonb);
  v_row       jsonb;
  v_results   jsonb := '[]'::jsonb;
  v_from      date;
  v_created   integer := 0;
  v_unchanged integer := 0;
  v_failed    integer := 0;
  v_no        integer;
  v_sku       text;
  v_list      uuid;
  v_price     numeric(14, 2);
  v_store     uuid;
  v_product   uuid;
  v_previous  numeric(14, 2);
begin
  if auth.uid() is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if jsonb_typeof(v_rows) <> 'array' then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  if jsonb_array_length(v_rows) > 400 then
    raise exception 'IMPORT_BATCH_TOO_LARGE' using errcode = 'P0001';
  end if;

  begin
    v_from := coalesce(nullif(p_payload ->> 'effective_from', '')::date, public.fn_today_vn());
  exception when others then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end;

  for v_row in select e from jsonb_array_elements(v_rows) as e loop
    v_no := coalesce((v_row ->> 'row')::integer, 0);
    v_sku := upper(nullif(btrim(coalesce(v_row ->> 'sku', '')), ''));
    v_list := nullif(v_row ->> 'price_list_id', '')::uuid;

    begin
      v_price := (v_row ->> 'price')::numeric(14, 2);

      if v_sku is null or v_list is null or v_price is null or v_price < 0 then
        raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
      end if;

      select pl.store_id into v_store from public.price_lists pl where pl.id = v_list;

      if v_store is null or not public.fn_is_owner(v_store) then
        raise exception 'PERMISSION_DENIED' using errcode = '42501';
      end if;

      select p.id into v_product from public.products p where p.sku = v_sku;

      if v_product is null then
        raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0001';
      end if;

      select cp.price_per_base_unit into v_previous
      from public.v_current_prices cp
      where cp.price_list_id = v_list and cp.product_id = v_product;

      if v_previous is not distinct from v_price then
        v_unchanged := v_unchanged + 1;
        v_results := v_results || jsonb_build_object(
          'row', v_no, 'sku', v_sku, 'status', 'unchanged', 'code', null
        );
        continue;
      end if;

      insert into public.price_list_items
        (store_id, price_list_id, product_id, price_per_base_unit, effective_from, created_by)
      values (v_store, v_list, v_product, v_price, v_from, auth.uid());

      v_created := v_created + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_no, 'sku', v_sku, 'status', 'created', 'code', null
      );

    exception when others then
      v_failed := v_failed + 1;
      v_results := v_results || jsonb_build_object(
        'row', v_no, 'sku', v_sku, 'status', 'error', 'code', sqlerrm
      );
    end;
  end loop;

  insert into public.audit_log (actor_id, store_id, action, entity, entity_id, after)
  values (auth.uid(), null, 'import_prices', 'price_list_items', null,
          jsonb_build_object('created', v_created, 'unchanged', v_unchanged, 'failed', v_failed,
                             'effective_from', v_from));

  return jsonb_build_object(
    'created', v_created,
    'unchanged', v_unchanged,
    'failed', v_failed,
    'results', v_results
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 5. Quyền thực thi
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_variant_code_suffix(text)
  from public, anon, authenticated;

revoke execute on function
  public.rpc_update_price(jsonb), public.rpc_import_products(jsonb),
  public.rpc_import_prices(jsonb)
  from public, anon;

grant execute on function
  public.rpc_update_price(jsonb), public.rpc_import_products(jsonb),
  public.rpc_import_prices(jsonb)
  to authenticated;
