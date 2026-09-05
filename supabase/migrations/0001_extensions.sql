-- 0001_extensions.sql
-- Extension, kiểu enum dùng chung, và các hàm hạ tầng không phụ thuộc bảng nào.
--
-- Quy ước cho TOÀN BỘ migration của dự án:
--   * Mọi hàm đặt `set search_path = ''` và định danh đầy đủ (public.x, extensions.y).
--     Trên Supabase, role `authenticated` có quyền CREATE trên schema public, nên một
--     hàm SECURITY DEFINER dùng search_path = public có thể bị người dùng thường
--     chiếm quyền bằng cách tạo hàm trùng tên. Quyền CREATE đó bị thu hồi ở 0013,
--     nhưng search_path = '' là lớp phòng thủ thứ hai, không tốn gì.
--   * Trạng thái dùng enum thay cho text + check, để `supabase gen types` sinh ra
--     union type cho TypeScript thay vì `string`.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------

-- Phân quyền: chỉ 2 vai trò (02-phan-quyen.md §1)
create type public.store_role as enum ('owner', 'staff');

-- Trạng thái bật/tắt dùng chung cho danh mục
create type public.entity_status as enum ('active', 'inactive');

-- ~50% mã vạch của nhà sản xuất, ~50% tem tự in
create type public.barcode_source as enum ('manufacturer', 'internal');

create type public.price_list_kind as enum ('retail', 'wholesale');
create type public.customer_group as enum ('retail', 'wholesale');
create type public.order_kind as enum ('retail', 'wholesale');

-- 'void' KHÔNG có trong 01-du-lieu.md §6. Thêm vì 03-rpc.md bắt rpc_void_order ghi
-- ledger đảo chiều bằng ref_type = 'adjust', làm huỷ đơn lẫn với điều chỉnh kiểm kê
-- trong báo cáo hao hụt. Tách riêng ngay từ đầu rẻ hơn sửa dữ liệu lịch sử sau này.
create type public.stock_ref_type as enum (
  'opening',      -- tồn đầu kỳ, từ stock_takes kind = 'opening'
  'sale',         -- bán hàng, qty âm
  'purchase',     -- nhập kho, qty dương
  'return_in',    -- khách trả hàng nguyên vẹn, qty dương
  'return_scrap', -- khách trả hàng nứt vỡ, qty = 0, chỉ để truy vết hao hụt
  'adjust',       -- điều chỉnh từ kiểm kê định kỳ
  'void'          -- đảo chiều khi huỷ đơn
);

create type public.order_status as enum ('held', 'paid', 'void');
create type public.payment_status as enum ('paid', 'partial', 'unpaid');

-- Phương thức thanh toán trên đơn bán. 'debt' = ghi nợ, không phải tiền vào két.
create type public.payment_method as enum ('cash', 'transfer', 'debt');

-- Phương thức của phiếu thu nợ khách. 'credit' là hệ quả của quyết định về
-- refund_method = 'credit_next_order': trả hàng sinh một phiếu thu ảo để đối trừ
-- công nợ, KHÔNG phải tiền thật — phải loại khỏi mọi báo cáo tiền mặt và khỏi
-- expected_cash khi đóng ca.
create type public.receipt_method as enum ('cash', 'transfer', 'credit');

-- Phương thức chi trả cho nhà cung cấp: luôn là tiền thật.
create type public.supplier_payment_method as enum ('cash', 'transfer');

create type public.refund_method as enum ('cash', 'transfer', 'credit_next_order');
create type public.return_condition as enum ('intact', 'damaged');

create type public.stock_take_kind as enum ('opening', 'periodic');
create type public.stock_take_status as enum ('draft', 'submitted');

create type public.shift_status as enum ('open', 'closed');
create type public.cash_txn_type as enum ('in', 'out');

-- Phiếu nhập không có bước nháp (phase-6.md: nhập trực tiếp, không có Purchase Order).
-- Sai thì huỷ phiếu và nhập lại, không sửa.
create type public.inbound_status as enum ('submitted', 'void');

-- ---------------------------------------------------------------------------
-- Hàm hạ tầng
-- ---------------------------------------------------------------------------

-- Bỏ dấu + hạ chữ thường, phục vụ tìm kiếm "ghe nhua" ra "Ghế nhựa".
--
-- Phải là IMMUTABLE để dùng được trong generated column, nhưng extensions.unaccent()
-- chỉ là STABLE — cả bản 1 tham số lẫn bản regdictionary. Truyền thẳng regdictionary
-- loại bỏ đúng lý do khiến nó STABLE (phải tra từ điển mặc định qua search_path),
-- nên khai IMMUTABLE ở đây là an toàn CÓ ĐIỀU KIỆN: điều kiện là file từ điển
-- unaccent không bao giờ đổi. Nếu ai đó đổi từ điển, name_normalized đã lưu sẽ
-- không được tính lại và tìm kiếm sẽ sai âm thầm.
--
-- KHÔNG dùng `ALTER FUNCTION extensions.unaccent(...) IMMUTABLE` — thay đổi trên
-- đối tượng thuộc extension không được pg_dump ghi lại, nên nó sẽ biến mất khi
-- restore hoặc tạo branch.
create or replace function public.fn_unaccent_lower(p_text text)
returns text
language sql
immutable
strict
parallel safe
set search_path = ''
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, p_text))
$$;

comment on function public.fn_unaccent_lower(text) is
  'Bỏ dấu tiếng Việt và hạ chữ thường. IMMUTABLE có chủ đích để dùng trong generated column.';

-- Supabase chạy TimeZone = UTC. current_date sẽ trả về HÔM QUA với mọi thao tác
-- sau 17:00 giờ Việt Nam — cửa hàng mở tới tối mỗi ngày. Mọi default kiểu ngày
-- trong dự án dùng hàm này, không dùng current_date.
create or replace function public.fn_today_vn()
returns date
language sql
stable
parallel safe
set search_path = ''
as $$
  select (now() at time zone 'Asia/Ho_Chi_Minh')::date
$$;

comment on function public.fn_today_vn() is
  'Ngày hiện tại theo giờ Việt Nam. Dùng thay cho current_date (server chạy UTC).';

-- Trigger dùng chung cho các bảng có cột updated_at.
create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;
