# 03 — RPC (toàn bộ logic ghi nằm ở đây)

## Quy ước chung

Mọi RPC:

- Viết bằng `plpgsql`, `SECURITY DEFINER`, `set search_path = ''`
  (**sửa ở Phase 1**, trước đây ghi `= public`). Trên Supabase, role
  `authenticated` có quyền `CREATE` trên schema `public` theo mặc định, nên với
  `search_path = public` một user thường tạo được hàm trùng tên để chiếm quyền
  của hàm `SECURITY DEFINER`. Quyền `CREATE` đó đã bị thu hồi ở `0013`, nhưng
  `search_path = ''` + định danh đầy đủ (`public.x`, `extensions.y`) là lớp
  phòng thủ thứ hai và không tốn gì
- Nhận `p_payload jsonb`, trả `jsonb`
- **Kiểm tra quyền ở dòng đầu tiên** — user có thuộc `store_id` không, có đúng role không
- Chạy trong **một transaction duy nhất**
- Raise exception có mã rõ ràng để client hiển thị được:
  `INSUFFICIENT_STOCK`, `SHIFT_NOT_OPEN`, `RETURN_EXCEEDS_SOLD`,
  `ALLOCATION_MISMATCH`, `PERMISSION_DENIED`, `PRICE_MISMATCH`

Client **không bao giờ** `INSERT`/`UPDATE` thẳng vào bảng giao dịch.

---

## `rpc_pos_checkout(p_payload jsonb) → jsonb`

**Payload:** `client_uuid`, `store_id`, `shift_id`, `customer_id`, `price_list_id`,
`order_kind`, `items[]` (`variant_id`, `uom_id`, `qty_input`, `unit_price`,
`line_discount`), `discount_order`, `payments[]` (`method`, `amount`, `ref_no`),
`note`, `due_date`

**Thứ tự xử lý bắt buộc:**

1. **Idempotency** — nếu `orders.client_uuid` đã tồn tại, trả về đơn cũ, không tạo mới.
   Đây là điều kiện để đồng bộ offline an toàn.
2. Kiểm tra `cash_shifts` của user đang `open`. Không thì `SHIFT_NOT_OPEN`.
3. Kiểm tra user thuộc `store_id`.
4. Mỗi dòng: `qty_base = qty_input × factor` (lấy `factor` từ `product_uoms`).
5. **Giá lấy từ server**, không tin giá client gửi lên:
   `unit_price` = `price_list_items.price_per_base_unit × factor` của
   `price_list_id` thuộc **đúng cửa hàng đó**.
   Nếu client gửi giá khác và user không phải `owner` → `PRICE_MISMATCH`.
   Nếu là `owner` → chấp nhận giá client và ghi `audit_log`.
6. Kiểm tra tồn: `qty_base > stock_balances.qty_base` → `INSUFFICIENT_STOCK`
   kèm tên hàng, trừ khi `stores.allow_negative_stock = true`.
7. Insert `orders` (`order_no` từ `fn_next_doc_no(store, 'HD')`), `order_items`, `payments`.
8. Insert `stock_ledger` (qty âm, `ref_type = 'sale'`, `unit_cost = null`).
   Trigger cập nhật `stock_balances`.
9. Tính `debt_amount` và `payment_status`. Nếu có `payments.method = 'debt'` thì
   `payment_status` là `unpaid` hoặc `partial`.
10. **Trả về:** `order_id`, `order_no`, `total`, `change_amount`, `debt_amount`,
    `remaining_stock[]` — để client hiển thị "tồn sau bán" chính xác từ server.

> Không cần `SELECT FOR UPDATE`: mỗi cửa hàng chỉ 1 máy, không có bán song song.
> Nhưng vẫn phải nằm trong transaction để đảm bảo atomic.

---

## `rpc_hold_order` / `rpc_resume_order`

Treo đơn **lưu trên server** (`orders.status = 'held'`), không dùng localStorage.
`rpc_resume_order` trả về đầy đủ dòng hàng để nạp lại vào giỏ.

---

## `rpc_receive_inbound(p_payload jsonb) → jsonb`

1. Idempotency theo `client_uuid`
2. `unit_cost_base = unit_cost_input / factor`
3. Insert `inbound_receipts` (`PN-...`), `inbound_items`
4. Insert `stock_ledger` (qty dương, `ref_type = 'purchase'`, có `unit_cost`)
5. Tính `debt_amount`, `payment_status`

**Không** tính giá vốn bình quân. **Không** phân bổ chi phí vận chuyển.
`unit_cost` chỉ được lưu, không dùng để tính bất cứ thứ gì.

---

## `rpc_create_receipt(p_payload jsonb) → jsonb`

Thu tiền nợ khách, đối trừ theo từng hoá đơn.

**Payload:** `store_id`, `customer_id`, `method`, `receipt_date`,
`allocations[]` (`order_id`, `allocated_amount`), `note`

**Kiểm tra bắt buộc:**

- `SUM(allocations.allocated_amount) = total_amount` → không thì `ALLOCATION_MISMATCH`
- Với mỗi đơn: `allocated_amount ≤ orders.debt_amount − đã phân bổ trước đó`
- Mọi `order_id` phải thuộc `customer_id` và `store_id` truyền vào

**Sau khi ghi:** cập nhật lại `orders.debt_amount` và `orders.payment_status`
cho từng đơn liên quan.

Nếu ca đang mở và `method = 'cash'` → ghi thêm `cash_transactions` để đóng ca tính đúng.

---

## `rpc_pay_supplier(p_payload jsonb) → jsonb`

Đối xứng hoàn toàn với `rpc_create_receipt`, phân bổ vào `inbound_receipts`.

---

## `rpc_process_return(p_payload jsonb) → jsonb`

1. Đơn gốc phải `status = 'paid'` và trong `stores.return_window_days`
2. Với mỗi dòng: `qty_base ≤ order_items.qty_base − SUM(đã trả trước đó)`
   → vượt thì `RETURN_EXCEEDS_SOLD`
3. `condition = 'intact'` → `stock_ledger` `ref_type = 'return_in'`, qty dương
4. `condition = 'damaged'` → `stock_ledger` `ref_type = 'return_scrap'`, `qty_base = 0`
   (không nhập lại kho, nhưng có dòng để truy vết hao hụt)
5. `refund_method = 'credit_next_order'` → ghi công nợ âm cho khách
6. `refund_method = 'cash'` và ca đang mở → ghi `cash_transactions` type `out`

---

## `rpc_submit_stock_take(p_payload jsonb) → jsonb`

**Payload:** `take_id`

1. Phiếu phải ở `status = 'draft'`
2. Với mỗi dòng có `diff ≠ 0`, sinh `stock_ledger`:
   - `kind = 'opening'` → `ref_type = 'opening'`, `qty_base = counted_qty`
     (không phải diff — đây là nhập tồn ban đầu từ 0)
   - `kind = 'periodic'` → `ref_type = 'adjust'`, `qty_base = diff`
3. Đặt `status = 'submitted'`, khoá phiếu
4. Ghi `audit_log`

---

## `rpc_open_shift` / `rpc_close_shift` / `rpc_cash_txn` / `rpc_current_shift`

Viết ở Phase 2, migration `0014_shift_rpc.sql`.

**Ca thuộc về CỬA HÀNG, không thuộc về người dùng.** `ux_cash_shifts_one_open_store`
cho phép đúng một ca `open` mỗi cửa hàng. Bản trước định nghĩa theo user; đổi vì từ
Phase 6 `rpc_create_receipt` và `rpc_pay_supplier` phải biết ghi `cash_transactions`
vào ca nào — "ca open của cửa hàng" là câu trả lời xác định, "ca open của
`auth.uid()`" thì không: owner thu nợ trong lúc staff đang trực sẽ ghi vào một ca
thứ hai không ai đóng, hoặc không ghi vào đâu cả và tiền biến mất khỏi báo cáo két.

**Mở ca:** kiểm tra cửa hàng chưa có ca nào `open`. Nếu có, raise
`SHIFT_ALREADY_OPEN` kèm `detail` là tên người đang giữ ca — giao diện cần tên đó.
Ghi `opening_float`.

**Đóng ca:** `staff` chỉ đóng ca của chính mình; `owner` đóng được ca của bất kỳ ai
ở cửa hàng mình quản lý (thiếu đường này thì staff quên đóng ca hôm qua = hôm nay
cửa hàng không bán được).

```
expected_cash = opening_float
              + Σ payments.amount     (method='cash', qua orders.shift_id, orders.status='paid')
              + Σ cash_transactions   (type='in')
              − Σ cash_transactions   (type='out')
```

**BỐN số hạng, không phải năm.** Xem 01-du-lieu.md §12: `receipts` không có
`shift_id`, thu nợ tiền mặt đã nằm trong `cash_transactions`, cộng lại là đếm đôi.

Ghi `counted_cash` do người dùng đếm, `variance = counted_cash − expected_cash`.
**Không chặn** nếu lệch — chỉ ghi nhận, hiển thị, và ghi `audit_log` khi `variance <> 0`.

Lọc `orders.status = 'paid'` theo lối khẳng định, **không** dùng `<> 'void'`:
`order_status` có ba giá trị, `<> 'void'` sẽ lọt đơn `held`.

**Ràng buộc bắt buộc với các RPC khác** (không tuân thủ thì đóng ca sai âm thầm):

| RPC | Phải làm gì |
|---|---|
| `rpc_pos_checkout` | Khi chuyển `held` → `paid`, **bắt buộc** `update orders set shift_id = <ca đang mở>`. `orders.shift_id` gán lúc treo đơn; đơn treo qua đêm rồi thanh toán tiền mặt sáng hôm sau sẽ quy về ca đã đóng và đã chốt `expected_cash` — tiền có thật trong két nhưng không xuất hiện ở bất kỳ ca nào |
| `rpc_void_order` | **KHÔNG** ghi `cash_transactions`. Bộ lọc `status='paid'` đã tự giảm `expected_cash` khi huỷ đơn; ghi thêm là trừ hai lần |
| `rpc_create_receipt` | `method='cash'` → `cash_transactions` type `in`. `method='credit'` là đối trừ công nợ, không phải tiền thật — không ghi |
| `rpc_process_return` | `refund_method='cash'` → type `out` |
| `rpc_pay_supplier` | `method='cash'` → type `out`. `supplier_payments` cũng không có `shift_id` |

`rpc_cash_txn` chỉ sinh phiếu `source_type = 'manual'` và nhận `client_uuid` từ
client để chống ghi trùng. Các RPC trên ghi thẳng vào bảng với `source_type` tương ứng.

---

## `rpc_update_price(p_payload jsonb) → jsonb`

Chỉ `owner`. Thêm dòng `price_list_items` mới với `effective_from`, không update
dòng cũ. Ghi `audit_log` với giá trước và sau.

---

## `rpc_void_order(p_payload jsonb) → jsonb`

Chỉ `owner`. Đặt `orders.status = 'void'`, sinh `stock_ledger` đảo chiều
(`ref_type = 'adjust'`), gỡ các `receipt_allocations` liên quan nếu có,
ghi `audit_log` kèm lý do. **Không xoá bản ghi gốc.**

---

## `rpc_rebuild_stock_balances(p_store uuid) → jsonb`

Công cụ cứu hộ. Xoá và dựng lại toàn bộ `stock_balances` của một cửa hàng
từ `stock_ledger`. Chỉ `owner`. Trả về số biến thể đã dựng lại và số dòng lệch
so với trước khi dựng (nếu > 0 là có vấn đề cần điều tra).
