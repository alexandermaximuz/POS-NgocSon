-- 0003_catalog.sql
-- Danh mục hàng hoá và đối tác. TOÀN BỘ bảng trong file này là bảng DÙNG CHUNG
-- giữa 2 cửa hàng — không bảng nào có store_id (01-du-lieu.md §1).
--
-- Mô hình Template + Variant:
--   * Kích thước là SẢN PHẨM RIÊNG  — TH40 và TH45 độc lập, giá khác nhau
--   * Màu là BIẾN THỂ               — TH40-XD và TH40-D cùng giá
--   * Giá gắn ở products (mẫu). Tồn kho và mã vạch gắn ở product_variants.

-- ---------------------------------------------------------------------------
-- item_groups, uoms
-- ---------------------------------------------------------------------------
create table public.item_groups (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  parent_id uuid references public.item_groups (id),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  constraint ck_item_groups_not_self_parent check (parent_id is null or parent_id <> id)
);

create index ix_item_groups_parent on public.item_groups (parent_id);

create trigger trg_item_groups_touch
  before update on public.item_groups
  for each row execute function public.fn_touch_updated_at();

create table public.uoms (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

-- ---------------------------------------------------------------------------
-- suppliers, customers
--
-- 04-erpnext-mapping.md đề nghị giữ credit_limit / payment_terms /
-- default_price_list cho customers. Đã BỎ cả ba theo quyết định của chủ dự án:
--   * credit_limit và payment_terms: không RPC hay màn hình nào trong spec đọc tới.
--     Một hạn mức không ai kiểm tra còn tệ hơn không có hạn mức.
--   * default_price_list: customers là bảng dùng chung, price_lists CÓ store_id.
--     Trỏ từ đây sang đó là rò rỉ ranh giới cửa hàng. Thay bằng customer_group,
--     bảng giá suy ra theo (store_id, kind).
-- Công nợ KHÔNG lưu thành cột: tính động từ orders + receipt_allocations lọc theo
-- store_id, vì công nợ là số riêng của từng cửa hàng còn khách thì dùng chung.
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_normalized text generated always as (public.fn_unaccent_lower(name)) stored,
  phone text,
  address text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create index ix_suppliers_name_trgm
  on public.suppliers using gin (name_normalized extensions.gin_trgm_ops);

create trigger trg_suppliers_touch
  before update on public.suppliers
  for each row execute function public.fn_touch_updated_at();

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  name_normalized text generated always as (public.fn_unaccent_lower(name)) stored,
  phone text,
  address text,
  customer_group public.customer_group not null default 'retail',
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

create index ix_customers_name_trgm
  on public.customers using gin (name_normalized extensions.gin_trgm_ops);

-- Tìm khách theo số điện thoại ở màn bán hàng và màn thu nợ.
-- KHÔNG unique: hai vợ chồng cùng mua sỉ hay dùng chung một số, ràng buộc cứng
-- sẽ chặn nghiệp vụ thật. Trùng số thì cảnh báo ở giao diện.
create index ix_customers_phone on public.customers (phone) where phone is not null;

create trigger trg_customers_touch
  before update on public.customers
  for each row execute function public.fn_touch_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  sku text not null unique,
  name text not null,
  name_normalized text generated always as (public.fn_unaccent_lower(name)) stored,
  item_group_id uuid not null references public.item_groups (id),
  base_uom_id uuid not null references public.uoms (id),
  brand text,
  default_supplier_id uuid references public.suppliers (id),
  safety_stock numeric(14, 3) not null default 0 check (safety_stock >= 0),
  status public.entity_status not null default 'active',
  image_url text,
  description text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- Tìm kiếm bỏ dấu: gõ "ghe nhua" ra "Ghế nhựa thấp Duy Tân"
create index ix_products_name_trgm
  on public.products using gin (name_normalized extensions.gin_trgm_ops);
create index ix_products_item_group on public.products (item_group_id);
create index ix_products_status on public.products (status) where status = 'active';

create trigger trg_products_touch
  before update on public.products
  for each row execute function public.fn_touch_updated_at();

comment on column public.products.safety_stock is
  'Ngưỡng cảnh báo sắp hết hàng. Ở đơn vị gốc.';

-- ---------------------------------------------------------------------------
-- product_uoms — quy đổi cái / chục / thùng / hộp
-- ---------------------------------------------------------------------------
create table public.product_uoms (
  product_id uuid not null references public.products (id) on delete cascade,
  uom_id uuid not null references public.uoms (id),
  factor numeric(12, 4) not null check (factor > 0),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  primary key (product_id, uom_id)
);

-- Nhiều nhất MỘT dòng factor = 1 cho mỗi sản phẩm.
-- Điều kiện "dòng đó phải khớp products.base_uom_id" và "dòng đó phải tồn tại"
-- do constraint trigger ở cuối file lo, vì khoá ngoại không ràng buộc được
-- cột không phải khoá và vì lúc INSERT products thì chưa có dòng nào.
create unique index ux_product_uoms_base
  on public.product_uoms (product_id) where factor = 1;

create index ix_product_uoms_uom on public.product_uoms (uom_id);

-- ---------------------------------------------------------------------------
-- product_variants — nơi gắn TỒN KHO và MÃ VẠCH
-- ---------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default extensions.gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_code text not null unique,
  attr_color text,
  attr_note text,
  is_default boolean not null default false,
  status public.entity_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now()
);

-- Nhiều nhất MỘT biến thể mặc định cho mỗi sản phẩm.
create unique index ux_product_variants_one_default
  on public.product_variants (product_id) where is_default;

create index ix_product_variants_product on public.product_variants (product_id);

create trigger trg_product_variants_touch
  before update on public.product_variants
  for each row execute function public.fn_touch_updated_at();

comment on table public.product_variants is
  'stock_ledger LUÔN trỏ variant_id, không bao giờ trỏ product_id. Sản phẩm không có màu vẫn phải có 1 biến thể mặc định.';

-- ---------------------------------------------------------------------------
-- product_barcodes — một biến thể có thể có nhiều mã vạch
-- ---------------------------------------------------------------------------
create table public.product_barcodes (
  id uuid primary key default extensions.gen_random_uuid(),
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  barcode text not null unique,
  source public.barcode_source not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index ix_product_barcodes_variant on public.product_barcodes (variant_id);

-- ---------------------------------------------------------------------------
-- Constraint trigger: những ràng buộc không khai báo được
--
-- Cả hai hàm dưới đây BẮT BUỘC là SECURITY DEFINER. Trigger chạy dưới quyền
-- người gọi; dưới FORCE ROW LEVEL SECURITY, câu SELECT kiểm tra của một session
-- staff có thể bị policy lọc sạch và raise lỗi giả.
--
-- Cả hai đều DEFERRABLE INITIALLY DEFERRED, nên lỗi nổ lúc COMMIT và khối
-- EXCEPTION trong RPC KHÔNG bắt được. RPC danh mục (Phase 3) phải chạy
-- `SET CONSTRAINTS ALL IMMEDIATE;` ở cuối, bên trong BEGIN ... EXCEPTION,
-- để dịch được sang mã lỗi thân thiện cho người dùng.
-- ---------------------------------------------------------------------------

create or replace function public.fn_assert_product_default_variant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
  v_count integer;
begin
  if tg_table_name = 'products' then
    v_ids := array[new.id];
  elsif tg_op = 'DELETE' then
    v_ids := array[old.product_id];
  else
    v_ids := array[old.product_id, new.product_id];
  end if;

  foreach v_id in array v_ids loop
    -- Sản phẩm đã bị xoá trong cùng transaction thì không còn gì để kiểm tra.
    if not exists (select 1 from public.products p where p.id = v_id) then
      continue;
    end if;

    select count(*) into v_count
    from public.product_variants pv
    where pv.product_id = v_id and pv.is_default;

    if v_count <> 1 then
      raise exception
        'Sản phẩm % phải có đúng 1 biến thể mặc định, đang có %', v_id, v_count
        using errcode = '23514';
    end if;
  end loop;

  return null;
end
$$;

create constraint trigger trg_product_has_default_variant
  after insert on public.products
  deferrable initially deferred
  for each row execute function public.fn_assert_product_default_variant();

create constraint trigger trg_variant_keeps_default
  after delete or update of product_id, is_default on public.product_variants
  deferrable initially deferred
  for each row execute function public.fn_assert_product_default_variant();

create or replace function public.fn_assert_product_base_uom()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
  v_id uuid;
begin
  if tg_table_name = 'products' then
    v_ids := array[new.id];
  elsif tg_op = 'DELETE' then
    v_ids := array[old.product_id];
  else
    v_ids := array[old.product_id, new.product_id];
  end if;

  foreach v_id in array v_ids loop
    if not exists (select 1 from public.products p where p.id = v_id) then
      continue;
    end if;

    -- Kết hợp với ux_product_uoms_base (nhiều nhất 1 dòng factor = 1), điều kiện
    -- này buộc dòng factor = 1 DUY NHẤT phải chính là base_uom của sản phẩm.
    if not exists (
      select 1
      from public.product_uoms pu
      join public.products p on p.id = pu.product_id
      where pu.product_id = v_id
        and pu.factor = 1
        and pu.uom_id = p.base_uom_id
    ) then
      raise exception
        'Sản phẩm % phải có đúng 1 dòng product_uoms với factor = 1 ứng với base_uom_id', v_id
        using errcode = '23514';
    end if;
  end loop;

  return null;
end
$$;

create constraint trigger trg_product_has_base_uom
  after insert or update of base_uom_id on public.products
  deferrable initially deferred
  for each row execute function public.fn_assert_product_base_uom();

create constraint trigger trg_product_uoms_keeps_base
  after delete or update of product_id, uom_id, factor on public.product_uoms
  deferrable initially deferred
  for each row execute function public.fn_assert_product_base_uom();
