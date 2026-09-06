-- 0015_cash_txn_amount.sql
-- rpc_cash_txn trả về số tiền ĐÃ LƯU và cờ trùng phiếu.
--
-- Vì sao cần: 05-giao-dien.md §"Xác nhận thao tác" bắt thông báo xác nhận phải nêu
-- con số lấy từ kết quả RPC, không phải từ ô nhập của client. Bản 0014 trả về
-- cash_txn_id và expected_cash nhưng KHÔNG trả amount, nên client buộc phải hiển thị
-- lại số người dùng vừa gõ.
--
-- Chuyện đó sai đúng ở ca mà idempotency phát huy tác dụng: gửi lại cùng client_uuid
-- với số tiền khác thì RPC trả về phiếu CŨ (đúng), còn giao diện lại báo "Đã ghi
-- phiếu chi <số mới>" — một dòng chữ khẳng định hệ thống vừa làm việc nó không làm.
-- Đã tái hiện được khi kiểm thử Phase 2.
--
-- Cờ `duplicate` để giao diện nói thật: "phiếu này đã ghi trước đó rồi".
create or replace function public.rpc_cash_txn(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shift_id  uuid := nullif(p_payload ->> 'shift_id', '')::uuid;
  v_client    uuid := nullif(p_payload ->> 'client_uuid', '')::uuid;
  v_type      text := nullif(p_payload ->> 'type', '');
  v_amount    numeric(14, 2);
  v_reason    text := nullif(btrim(coalesce(p_payload ->> 'reason', '')), '');
  v_store     uuid;
  v_status    public.shift_status;
  v_id        uuid;
  v_saved     numeric(14, 2);
  v_saved_type public.cash_txn_type;
  v_duplicate boolean := false;
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
  select t.id, t.amount, t.type into v_id, v_saved, v_saved_type
  from public.cash_transactions t
  where t.client_uuid = v_client and t.shift_id = v_shift_id;

  if v_id is null then
    insert into public.cash_transactions
      (store_id, shift_id, client_uuid, type, amount, reason, source_type)
    values
      (v_store, v_shift_id, v_client, v_type::public.cash_txn_type, v_amount, v_reason, 'manual')
    returning id, amount, type into v_id, v_saved, v_saved_type;
  else
    v_duplicate := true;
  end if;

  -- amount và type lấy từ DÒNG ĐÃ LƯU, không phải từ payload: khi duplicate = true,
  -- hai thứ đó khác nhau, và cái người dùng cần biết là cái đã nằm trong sổ.
  return jsonb_build_object(
    'cash_txn_id', v_id,
    'amount', v_saved,
    'type', v_saved_type,
    'duplicate', v_duplicate,
    'expected_cash', public.fn_shift_expected_cash(v_shift_id)
  );
end
$$;

-- `create or replace` giữ nguyên quyền cũ, nhưng ghi lại cho rõ ràng — quy ước của
-- repo là mỗi migration tự cấp quyền cho hàm của nó (0013:349-352).
revoke execute on function public.rpc_cash_txn(jsonb) from public, anon;
grant execute on function public.rpc_cash_txn(jsonb) to authenticated;
