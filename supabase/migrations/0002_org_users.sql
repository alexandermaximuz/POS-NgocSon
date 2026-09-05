-- 0002_org_users.sql
-- Cửa hàng, hồ sơ người dùng, và bảng gán vai trò.

-- ---------------------------------------------------------------------------
-- stores
-- ---------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  phone text,
  receipt_footer text,
  allow_negative_stock boolean not null default false,
  return_window_days integer not null default 30 check (return_window_days > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  updated_at timestamptz not null default now(),
  -- Mã cửa hàng nằm trong số chứng từ (HD-CH1-2026-00001) nên phải ngắn và
  -- không chứa dấu gạch ngang, nếu không tách số chứng từ sẽ nhập nhằng.
  constraint ck_stores_code_shape check (code ~ '^[A-Z0-9]{2,6}$')
);

create trigger trg_stores_touch
  before update on public.stores
  for each row execute function public.fn_touch_updated_at();

comment on column public.stores.allow_negative_stock is
  'Cho phép bán vượt tồn. Mặc định false — rpc_pos_checkout raise INSUFFICIENT_STOCK.';

-- ---------------------------------------------------------------------------
-- profiles — bảng DÙNG CHUNG, không có store_id
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_touch
  before update on public.profiles
  for each row execute function public.fn_touch_updated_at();

-- Tạo profile tự động khi có user mới. Giữ TỐI THIỂU: mọi lỗi trong trigger này
-- làm hỏng toàn bộ luồng đăng ký user của GoTrue, không chỉ hỏng dòng profile.
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger trg_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- ---------------------------------------------------------------------------
-- store_members — gán vai trò. Có store_id nhưng là bảng phân quyền, không phải
-- bảng nghiệp vụ: policy của nó không được dùng fn_my_store_ids() (đệ quy vô hạn).
-- ---------------------------------------------------------------------------
create table public.store_members (
  store_id uuid not null references public.stores (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.store_role not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id),
  primary key (store_id, user_id)
);

create index ix_store_members_user on public.store_members (user_id);

comment on table public.store_members is
  'Một user có thể là owner của cả 2 cửa hàng (2 dòng), hoặc staff của đúng 1 cửa hàng.';
