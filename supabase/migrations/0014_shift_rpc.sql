-- 0014_shift_rpc.sql
-- Ca làm việc và quỹ tiền mặt: RPC mở ca, đóng ca, phiếu thu/chi, và tra cứu
-- ca đang mở. Phase 2.
--
-- ===========================================================================
-- QUY ƯỚC TIỀN MẶT — đọc trước khi viết bất kỳ RPC nào ở phase sau
-- ===========================================================================
--
-- expected_cash chỉ có BỐN số hạng:
--
--   opening_float
--   + Σ payments.amount     (method='cash', qua orders.shift_id, orders.status='paid')
--   + Σ cash_transactions   (type='in')
--   − Σ cash_transactions   (type='out')
--
-- 03-rpc.md và 01-du-lieu.md từng ghi NĂM số hạng, thêm "thu nợ tiền mặt trong
-- ca". Đó là lỗi: bảng receipts KHÔNG có shift_id (0007), nên không có đường nào
-- nối phiếu thu với ca. Cách repo thực sự chọn là 03-rpc.md:95 — rpc_create_receipt
-- tự ghi cash_transactions khi ca đang mở. Cộng cả hai là đếm đôi mỗi đồng thu nợ.
-- Spec đã được sửa lại trong cùng PR với file này.
--
-- Hệ quả, và đây là phần các phase sau BẮT BUỘC tuân thủ:
--
--   cash_transactions là kênh DUY NHẤT cho mọi dòng tiền mặt không phải payments
--   của đơn bán. Ai thêm luồng tiền mặt mới mà không ghi cash_transactions thì
--   đóng ca sai và KHÔNG CÓ GÌ BÁO.
--
--   rpc_create_receipt  (Phase 7) — method='cash' → 'in'. method='credit' là đối
--                                   trừ công nợ, KHÔNG phải tiền thật, không ghi.
--   rpc_process_return  (Phase 8) — refund_method='cash' → 'out'
--   rpc_pay_supplier    (Phase 6) — method='cash' → 'out'. supplier_payments cũng
--                                   không có shift_id (0008); công thức cũ bỏ sót
--                                   hẳn luồng này.
--   rpc_void_order      (Phase 5) — KHÔNG ghi cash_transactions. fn_shift_expected_cash
--                                   lọc orders.status='paid', nên huỷ đơn đã tự
--                                   giảm expected_cash. Ghi thêm là trừ hai lần.
--   rpc_pos_checkout    (Phase 5) — khi chuyển held → paid PHẢI
--                                   `update orders set shift_id = <ca đang mở>`.
--                                   orders.shift_id là NOT NULL và được gán lúc
--                                   treo đơn (0006:17). Đơn treo qua đêm rồi thanh
--                                   toán tiền mặt sáng hôm sau sẽ quy về ca hôm qua
--                                   — ca đã đóng và đã chốt expected_cash. Tiền có
--                                   thật trong két nhưng không xuất hiện ở bất kỳ
--                                   expected_cash nào.
--
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Guard — hàm SECURITY DEFINER có ghi được vào bảng FORCE RLS không
--
-- 0013 bật `force row level security` cho mọi bảng, và cash_shifts /
-- cash_transactions không có policy INSERT/UPDATE nào. FORCE RLS gỡ miễn trừ của
-- CHỦ BẢNG, nhưng thuộc tính BYPASSRLS của ROLE thì thắng cả FORCE. Hàm bên dưới
-- chạy dưới quyền chủ hàm = role đang chạy migration này.
--
-- 0013:19-29 đã kiểm role tên 'postgres'. Ở đây kiểm current_user — đúng cái role
-- sẽ trở thành proowner của các hàm sắp tạo, không phải một cái tên cố định.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_roles
    where rolname = current_user and (rolsuper or rolbypassrls)
  ) then
    raise exception
      'Role % không có BYPASSRLS. Hàm SECURITY DEFINER tạo ra sẽ bị FORCE RLS chặn khi ghi cash_shifts.',
      current_user;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Khôi phục quyền mặc định trên hàm
--
-- 0013:326 đã chạy đúng câu lệnh này, nhưng pg_default_acl của schema public
-- hiện RỖNG — quy trình seed lại (`drop schema public cascade`) xoá sạch nó, đúng
-- như 0013:329-331 dự đoán. Kiểm chứng bằng cách tạo thử một hàm trong transaction
-- rollback: proacl = NULL, và anon gọi được.
--
-- Nghĩa là mọi RPC thêm từ đây trở đi mặc định là endpoint gọi được KHI CHƯA
-- ĐĂNG NHẬP. Đặt lệnh này TRƯỚC các create function bên dưới để chúng được bảo vệ
-- ngay từ lúc sinh ra, rồi vẫn revoke/grant tường minh ở mục 8 — hai lớp, vì lớp
-- này đã chứng minh là không bền qua seed lại.
-- ---------------------------------------------------------------------------
alter default privileges in schema public revoke execute on functions from public, anon;

-- ---------------------------------------------------------------------------
-- 3. cash_transactions — bổ sung idempotency và truy vết nguồn
--
-- Đây là chứng từ DUY NHẤT thiếu client_uuid: orders (0006:12), receipts (0007:12)
-- và returns (0009:13) đều có. Bấm đúp "Chi khác" hoặc HTTP retry tạo hai dòng và
-- expected_cash sai âm thầm — Phase 10 (Dexie outbox) biến chuyện này thành chắc
-- chắn xảy ra. Giữ đúng khuôn `not null unique` toàn cục của ba bảng kia.
--
-- source_type/source_id trả lời câu "đồng này từ đâu ra". Không có nó, Σin − Σout
-- là một cục không lần ngược về chứng từ gốc được, và người đóng ca lệch không có
-- gì để đối chiếu. Không đặt được khoá ngoại vì source_id đa hình (receipts /
-- returns / supplier_payments).
-- ---------------------------------------------------------------------------
create type public.cash_txn_source as enum
  ('manual', 'receipt', 'return', 'supplier_payment');

alter table public.cash_transactions add column client_uuid uuid;

-- Bảng đang rỗng trên dev, nhưng migration phải chạy được cả trên database đã có
-- dữ liệu tay.
update public.cash_transactions
   set client_uuid = extensions.gen_random_uuid()
 where client_uuid is null;

alter table public.cash_transactions alter column client_uuid set not null;
alter table public.cash_transactions
  add constraint uq_cash_transactions_client_uuid unique (client_uuid);

alter table public.cash_transactions
  add column source_type public.cash_txn_source not null default 'manual',
  add column source_id uuid;

-- 'manual' là phiếu thu/chi người dùng tự lập, không có chứng từ gốc. Mọi loại còn
-- lại bắt buộc phải truy được về chứng từ sinh ra nó.
alter table public.cash_transactions
  add constraint ck_cash_transactions_source
    check ((source_type = 'manual') = (source_id is null));

create index ix_cash_transactions_source
  on public.cash_transactions (source_type, source_id)
  where source_id is not null;

comment on column public.cash_transactions.source_type is
  'manual = người dùng tự lập phiếu. Các giá trị còn lại do RPC nghiệp vụ sinh ra, xem quy ước tiền mặt ở đầu 0014.';

-- ---------------------------------------------------------------------------
-- 4. Mỗi cửa hàng chỉ một ca đang mở
--
-- ux_cash_shifts_one_open (0010:37) chỉ chặn MỘT USER mở hai ca cùng cửa hàng;
-- hai user khác nhau vẫn mở được hai ca song song ở một cửa hàng.
--
-- Lý do siết không phải "mỗi cửa hàng một máy", mà là: từ Phase 6, rpc_create_receipt
-- và rpc_pay_supplier phải quyết định ghi cash_transactions vào ca NÀO. "Ca open của
-- cửa hàng" là câu trả lời xác định. "Ca open của auth.uid()" thì không — owner thu
-- nợ trong lúc staff đang trực sẽ ghi vào một ca thứ hai không ai đóng, hoặc không
-- ghi vào đâu cả và tiền biến mất khỏi mọi báo cáo két.
--
-- Index cũ bị bao trùm nhưng giữ lại: nó ghi lại ý định gốc nếu sau này nới ràng buộc.
-- ---------------------------------------------------------------------------
create unique index ux_cash_shifts_one_open_store
  on public.cash_shifts (store_id) where status = 'open';

-- ---------------------------------------------------------------------------
-- 5. fn_shift_expected_cash — nguồn số duy nhất cho tiền két
--
-- Dùng ở cả topbar (tiền két hiện tại) lẫn màn đóng ca (tiền mặt dự kiến). Hai chỗ
-- đó không được tự tính lại, nếu không sẽ có ngày lệch nhau.
--
-- `stable`, không phải mặc định `volatile`: rpc_current_shift gọi nó trong SELECT
-- list, volatile sẽ buộc planner gọi lại mỗi dòng.
--
-- Mọi số hạng coalesce về 0. Trả NULL sẽ làm ck_cash_shifts_state (0010:24) nổ 23514
-- lúc đóng ca, với message tiếng Anh mà client không dịch được.
--
-- KHÔNG cấp EXECUTE cho authenticated (mục 8): hàm nhận shift_id và trả số tiền,
-- gọi thẳng được nghĩa là đọc được tiền két của cửa hàng khác.
-- ---------------------------------------------------------------------------
create or replace function public.fn_shift_expected_cash(p_shift uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_opening    numeric(14, 2);
  v_cash_sales numeric(14, 2);
  v_in         numeric(14, 2);
  v_out        numeric(14, 2);
begin
  select s.opening_float into v_opening
  from public.cash_shifts s
  where s.id = p_shift;

  if not found then
    raise exception 'SHIFT_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- payments không có cột nào nối tới ca; đường duy nhất là orders.shift_id.
  --
  -- Lọc status = 'paid' theo lối KHẲNG ĐỊNH. `<> 'void'` sẽ lọt đơn 'held' —
  -- order_status có ba giá trị (0001:47), không phải hai.
  --
  -- payments.amount là số tiền ÁP VÀO ĐƠN, không phải tiền khách đưa: ck_orders_debt
  -- (0006:26) khoá paid_amount ≤ total. change_amount không bao giờ được ghi vào đây.
  select coalesce(sum(p.amount), 0) into v_cash_sales
  from public.payments p
  join public.orders o on o.id = p.order_id and o.store_id = p.store_id
  where o.shift_id = p_shift
    and o.status = 'paid'
    and p.method = 'cash';

  select coalesce(sum(t.amount) filter (where t.type = 'in'), 0),
         coalesce(sum(t.amount) filter (where t.type = 'out'), 0)
    into v_in, v_out
  from public.cash_transactions t
  where t.shift_id = p_shift;

  return v_opening + v_cash_sales + v_in - v_out;
end
$$;

-- ---------------------------------------------------------------------------
-- 6. Hàm nội bộ: giải payload thành ca đã kiểm tra quyền
--
-- Ba RPC dưới đây lặp lại cùng một đoạn kiểm tra. Tách ra để chỗ dễ sai nhất chỉ
-- tồn tại một bản.
--
-- Viết theo lối KHẲNG ĐỊNH (`is null or not exists`). Dạng `v_store not in (select
-- fn_my_store_ids())` với v_store NULL cho kết quả NULL, nhánh raise KHÔNG chạy, và
-- hàm đi tiếp rồi chết bằng 23502 với message Postgres. Payload thiếu store_id là ca
-- thường gặp nhất.
-- ---------------------------------------------------------------------------
create or replace function public.fn_assert_store_member(p_store uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null
     or p_store is null
     or not exists (
       select 1 from public.fn_my_store_ids() f(store_id) where f.store_id = p_store
     ) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 7. RPC
-- ---------------------------------------------------------------------------

-- rpc_open_shift — {store_id, opening_float}
--
-- Kiểm tra ca đang mở TRƯỚC khi insert, dù ux_cash_shifts_one_open_store đã chặn ở
-- tầng index. Lý do: index nổ ra 23505 với message của Postgres, còn giao diện cần
-- TÊN người đang giữ ca để hiện "Ca của Lan đang mở, đóng ca giúp không?".
create or replace function public.rpc_open_shift(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_store    uuid := nullif(p_payload ->> 'store_id', '')::uuid;
  v_float    numeric(14, 2);
  v_holder   text;
  v_shift_id uuid;
begin
  perform public.fn_assert_store_member(v_store);

  begin
    v_float := (p_payload ->> 'opening_float')::numeric(14, 2);
  exception when others then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end;

  if v_float is null or v_float < 0 then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  select coalesce(pr.full_name, u.email, 'người dùng khác') into v_holder
  from public.cash_shifts s
  join auth.users u on u.id = s.user_id
  left join public.profiles pr on pr.id = s.user_id
  where s.store_id = v_store and s.status = 'open';

  if v_holder is not null then
    raise exception 'SHIFT_ALREADY_OPEN'
      using errcode = '23505', detail = v_holder;
  end if;

  insert into public.cash_shifts (store_id, user_id, opening_float)
  values (v_store, auth.uid(), v_float)
  returning id into v_shift_id;

  return jsonb_build_object('shift_id', v_shift_id, 'opening_float', v_float);
end
$$;

-- rpc_close_shift — {shift_id, counted_cash, note}
--
-- owner đóng được ca của bất kỳ ai ở cửa hàng mình quản lý; staff chỉ đóng ca của
-- chính mình. Thiếu đường đầu thì staff quên đóng ca hôm qua = hôm nay cửa hàng
-- không bán được, vì index ở mục 4 chặn mở ca thứ hai.
create or replace function public.rpc_close_shift(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift_id uuid := nullif(p_payload ->> 'shift_id', '')::uuid;
  v_counted  numeric(14, 2);
  v_store    uuid;
  v_owner_id uuid;
  v_expected numeric(14, 2);
  v_variance numeric(14, 2);
  v_held     integer;
begin
  if auth.uid() is null or v_shift_id is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  begin
    v_counted := (p_payload ->> 'counted_cash')::numeric(14, 2);
  exception when others then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end;

  if v_counted is null or v_counted < 0 then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  select s.store_id, s.user_id into v_store, v_owner_id
  from public.cash_shifts s
  where s.id = v_shift_id;

  -- Không phân biệt "không tìm thấy ca" với "ca của người khác": gộp cả hai thành
  -- PERMISSION_DENIED để không ai dò được id ca của cửa hàng bên kia.
  if v_store is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  perform public.fn_assert_store_member(v_store);

  if v_owner_id <> auth.uid() and not public.fn_is_owner(v_store) then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_expected := public.fn_shift_expected_cash(v_shift_id);

  -- MỘT câu UPDATE duy nhất. variance là generated column (0010:17) nên không gán
  -- được, và ck_cash_shifts_state (0010:24) đòi closed_at + expected_cash +
  -- counted_cash cùng khác NULL — update hai bước sẽ vi phạm ở giữa.
  --
  -- `and s.status = 'open'` + `if not found` là thứ hiện thực hoá AC "đóng ca xong
  -- không mở lại được ca cũ". Đọc-rồi-ghi hai bước sẽ trượt AC này khi bấm từ hai tab.
  update public.cash_shifts s
     set status        = 'closed',
         closed_at     = now(),
         expected_cash = v_expected,
         counted_cash  = v_counted,
         note          = coalesce(nullif(p_payload ->> 'note', ''), s.note)
   where s.id = v_shift_id
     and s.status = 'open'
  returning s.variance into v_variance;

  if not found then
    raise exception 'SHIFT_NOT_OPEN' using errcode = 'P0001';
  end if;

  -- Đơn treo trỏ vào ca vừa đóng. Không chặn đóng ca — chỉ báo để người dùng biết,
  -- vì kết hợp với việc re-stamp shift_id ở rpc_pos_checkout thì chúng sẽ chuyển
  -- sang ca sau, không mất đi đâu.
  select count(*) into v_held
  from public.orders o
  where o.shift_id = v_shift_id and o.status = 'held';

  if v_variance <> 0 then
    insert into public.audit_log (actor_id, store_id, action, entity, entity_id, after)
    values (
      auth.uid(), v_store, 'close_shift_variance', 'cash_shifts', v_shift_id,
      jsonb_build_object('expected', v_expected, 'counted', v_counted, 'variance', v_variance)
    );
  end if;

  return jsonb_build_object(
    'shift_id', v_shift_id,
    'expected_cash', v_expected,
    'counted_cash', v_counted,
    'variance', v_variance,
    'held_orders', v_held
  );
end
$$;

-- rpc_cash_txn — {shift_id, client_uuid, type, amount, reason}
--
-- Chỉ sinh phiếu 'manual'. RPC nghiệp vụ ở phase sau ghi thẳng vào bảng với
-- source_type tương ứng, không đi qua đây.
create or replace function public.rpc_cash_txn(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift_id uuid := nullif(p_payload ->> 'shift_id', '')::uuid;
  v_client   uuid := nullif(p_payload ->> 'client_uuid', '')::uuid;
  v_type     text := nullif(p_payload ->> 'type', '');
  v_amount   numeric(14, 2);
  v_reason   text := nullif(btrim(coalesce(p_payload ->> 'reason', '')), '');
  v_store    uuid;
  v_status   public.shift_status;
  v_id       uuid;
begin
  if auth.uid() is null or v_shift_id is null or v_client is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  -- Validate TRƯỚC khi cast. `::public.cash_txn_type` với giá trị lạ cho 22P02, và
  -- amount <= 0 cho 23514 từ check (amount > 0) ở 0010:53 — cả hai là message tiếng
  -- Anh của Postgres, client không dịch được sang thông báo có ngữ cảnh.
  if v_type is null or v_type not in ('in', 'out') then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  begin
    v_amount := (p_payload ->> 'amount')::numeric(14, 2);
  exception when others then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end;

  -- reason là NOT NULL (0010:54) nhưng chuỗi rỗng lọt qua NOT NULL.
  if v_amount is null or v_amount <= 0 or v_reason is null then
    raise exception 'INVALID_PAYLOAD' using errcode = 'P0001';
  end if;

  select s.store_id, s.status into v_store, v_status
  from public.cash_shifts s
  where s.id = v_shift_id;

  if v_store is null then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  perform public.fn_assert_store_member(v_store);

  if v_status <> 'open' then
    raise exception 'SHIFT_NOT_OPEN' using errcode = 'P0001';
  end if;

  -- Idempotency: bấm đúp hoặc outbox retry trả lại đúng phiếu cũ, không tạo phiếu mới.
  -- Lọc thêm shift_id: nếu cùng client_uuid lại trỏ sang ca khác thì đó là dùng sai,
  -- và insert bên dưới phải nổ 23505 chứ không được im lặng trả về phiếu của ca kia.
  select t.id into v_id
  from public.cash_transactions t
  where t.client_uuid = v_client and t.shift_id = v_shift_id;

  if v_id is null then
    insert into public.cash_transactions
      (store_id, shift_id, client_uuid, type, amount, reason, source_type)
    values
      (v_store, v_shift_id, v_client, v_type::public.cash_txn_type, v_amount, v_reason, 'manual')
    returning id into v_id;
  end if;

  return jsonb_build_object(
    'cash_txn_id', v_id,
    'expected_cash', public.fn_shift_expected_cash(v_shift_id)
  );
end
$$;

-- rpc_current_shift — {store_id}
--
-- Trả ca đang mở CỦA CỬA HÀNG, không phải của auth.uid(). Topbar phải hiện "ca đang
-- mở + người trực" kể cả khi owner đứng xem trong lúc staff trực; cờ is_mine để giao
-- diện biết có cho bán hàng hay không.
--
-- Không bao giờ trả SQL NULL: PostgREST sẽ gửi body `null` và client không phân biệt
-- được với lỗi.
create or replace function public.rpc_current_shift(p_payload jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_store uuid := nullif(p_payload ->> 'store_id', '')::uuid;
  v_shift record;
begin
  perform public.fn_assert_store_member(v_store);

  select s.id, s.user_id, s.opened_at, s.opening_float,
         coalesce(pr.full_name, u.email) as holder_name
    into v_shift
  from public.cash_shifts s
  join auth.users u on u.id = s.user_id
  left join public.profiles pr on pr.id = s.user_id
  where s.store_id = v_store and s.status = 'open';

  if not found then
    return jsonb_build_object('has_open_shift', false);
  end if;

  return jsonb_build_object(
    'has_open_shift', true,
    'shift_id', v_shift.id,
    'opened_at', v_shift.opened_at,
    'opening_float', v_shift.opening_float,
    'holder_name', v_shift.holder_name,
    'is_mine', v_shift.user_id = auth.uid(),
    'expected_cash', public.fn_shift_expected_cash(v_shift.id)
  );
end
$$;

-- ---------------------------------------------------------------------------
-- 8. Quyền thực thi
--
-- Mục 2 đã đặt lại quyền mặc định, nhưng vẫn viết tường minh: pg_default_acl không
-- sống sót qua `drop schema public cascade`, và đó là quy trình seed lại chính thức
-- của repo này (seed.sql:7).
-- ---------------------------------------------------------------------------
revoke execute on function public.fn_shift_expected_cash(uuid)
  from public, anon, authenticated;
revoke execute on function public.fn_assert_store_member(uuid)
  from public, anon, authenticated;

revoke execute on function
  public.rpc_open_shift(jsonb), public.rpc_close_shift(jsonb),
  public.rpc_cash_txn(jsonb), public.rpc_current_shift(jsonb)
  from public, anon;

grant execute on function
  public.rpc_open_shift(jsonb), public.rpc_close_shift(jsonb),
  public.rpc_cash_txn(jsonb), public.rpc_current_shift(jsonb)
  to authenticated;
