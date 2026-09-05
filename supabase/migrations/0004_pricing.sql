-- 0004_pricing.sql
-- Bảng giá. CÓ store_id: mỗi cửa hàng có bảng giá lẻ và sỉ riêng, giá khác nhau.
--
-- Giá gắn ở products (mẫu), KHÔNG gắn ở product_variants — mọi màu cùng giá.
-- Nhờ đó bảng giá còn ~500 dòng thay vì 2.000. Nếu sau này có mặt hàng mà màu
-- khác giá thì báo chủ dự án, đừng thêm cột giá vào product_variants.

create table public.price_lists (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  name text not null,
  kind public.price_list_kind not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  -- Cho phép khoá ngoại tổ hợp từ price_list_items và orders, nhờ đó store_id
  -- của con không bao giờ lệch được với cha.
  constraint uq_price_lists_id_store unique (id, store_id)
);

-- Mỗi cửa hàng đúng 1 bảng giá lẻ mặc định và 1 bảng giá sỉ mặc định.
create unique index ux_price_lists_default
  on public.price_lists (store_id, kind) where is_default;

create index ix_price_lists_store on public.price_lists (store_id);

create trigger trg_price_lists_touch
  before update on public.price_lists
  for each row execute function public.fn_touch_updated_at();

-- ---------------------------------------------------------------------------
-- price_list_items — append-only theo thời gian
--
-- Đổi giá thì THÊM DÒNG MỚI với effective_from mới, không update dòng cũ.
-- Cố tình KHÔNG unique theo (price_list_id, product_id, effective_from): chủ
-- cửa hàng gõ nhầm giá rồi sửa lại sau 30 giây sẽ bị ràng buộc đó chặn, và cách
-- duy nhất để đi tiếp là update dòng cũ — đúng thứ ta muốn cấm. Dòng mới nhất
-- thắng, phân giải bằng created_at rồi id.
-- ---------------------------------------------------------------------------
create table public.price_list_items (
  id uuid primary key default extensions.gen_random_uuid(),
  store_id uuid not null references public.stores (id),
  price_list_id uuid not null,
  product_id uuid not null references public.products (id),
  price_per_base_unit numeric(14, 2) not null check (price_per_base_unit >= 0),
  effective_from date not null default public.fn_today_vn(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  constraint fk_pli_price_list
    foreign key (price_list_id, store_id) references public.price_lists (id, store_id)
);

comment on column public.price_list_items.price_per_base_unit is
  'Giá theo ĐƠN VỊ GỐC. Giá theo đơn vị lớn = price_per_base_unit × product_uoms.factor.';

-- Phục vụ đúng truy vấn "dòng giá hiệu lực mới nhất" của v_current_prices.
create index ix_price_list_items_current on public.price_list_items (
  price_list_id, product_id, effective_from desc, created_at desc
);
create index ix_price_list_items_store on public.price_list_items (store_id);

-- ---------------------------------------------------------------------------
-- v_current_prices — giá đang hiệu lực của từng (bảng giá, sản phẩm)
--
-- security_invoker = true là BẮT BUỘC, không phải tuỳ chọn: view do postgres tạo
-- mặc định chạy bằng quyền chủ view, mà postgres có BYPASSRLS. Thiếu nó là staff
-- cửa hàng A đọc được giá cửa hàng B xuyên thẳng qua RLS.
--
-- rpc_pos_checkout (Phase 5) KHÔNG dùng view này — join thẳng price_list_items
-- để chốt giá tại thời điểm bán, cho rõ ý đồ.
-- ---------------------------------------------------------------------------
create view public.v_current_prices
with (security_invoker = true) as
select distinct on (pli.price_list_id, pli.product_id)
  pli.price_list_id,
  pli.store_id,
  pli.product_id,
  pli.price_per_base_unit,
  pli.effective_from
from public.price_list_items pli
where pli.effective_from <= public.fn_today_vn()
order by
  pli.price_list_id,
  pli.product_id,
  pli.effective_from desc,
  pli.created_at desc,
  pli.id desc;
