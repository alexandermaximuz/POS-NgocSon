# 01 — Mô hình dữ liệu

## 1. Ranh giới global vs theo cửa hàng

Đây là quyết định kiến trúc quan trọng nhất. Đặt sai chỗ thì sửa rất đắt.

| **DÙNG CHUNG (không có `store_id`)** | **RIÊNG TỪNG CỬA HÀNG (có `store_id`)** |
|---|---|
| `item_groups`, `uoms` | `price_lists`, `price_list_items` |
| `products`, `product_uoms` | `stock_ledger`, `stock_balances` |
| `product_variants`, `product_barcodes` | `orders`, `order_items`, `payments` |
| `customers`, `suppliers` | `inbound_receipts`, `inbound_items` |
| `profiles` | `returns`, `return_items` |
| | `receipts`, `receipt_allocations` |
| | `supplier_payments`, `supplier_payment_allocations` |
| | `cash_shifts`, `cash_transactions` |
| | `stock_takes`, `stock_take_items` |
| | `number_sequences`, `audit_log` |

> Khách hàng dùng chung nhưng **công nợ tính riêng theo cửa hàng**, vì hoá đơn thuộc
> về một cửa hàng cụ thể. Màn hồ sơ khách hiển thị công nợ tách theo từng cửa hàng
> và tổng cộng.

## 2. Quy ước chung

- Số lượng: `numeric(14,3)` — luôn ở **đơn vị gốc**
- Tiền: `numeric(14,2)` — VND
- Hệ số quy đổi: `numeric(12,4)`
- Mọi bảng có `created_at timestamptz default now()`, `created_by uuid references auth.users`
- Bảng có thể sửa thì thêm `updated_at`
- Bảng chứng từ (`orders`, `inbound_receipts`, `returns`, `receipts`) có
  `client_uuid uuid unique not null` để **idempotency** khi đồng bộ offline
- Thời gian hiển thị theo `Asia/Ho_Chi_Minh`

---

## 3. Tổ chức & người dùng

```sql
stores        (id, code unique, name, address, phone, receipt_footer,
               allow_negative_stock bool default false,
               return_window_days int default 30, is_active bool)

profiles      (id references auth.users primary key, full_name, phone, is_active)

store_members (store_id, user_id, role text check (role in ('owner','staff')),
               primary key (store_id, user_id))
```

## 4. Danh mục hàng hoá

### Mô hình Template + Variant

Thực tế: hơn 2.000 mã tính theo quy cách/kích thước/màu. Nhưng:

- **Kích thước là sản phẩm riêng** — `TH40` và `TH45` độc lập, giá khác nhau
- **Màu là biến thể** — `TH40-XD`, `TH40-D`, `TH40-LM` **cùng giá**

| Thực thể | Ví dụ | Cái gì gắn ở đây |
|---|---|---|
| `products` (mẫu) | `TH40` Thau nhựa Duy Thành 40cm | **Giá**, đơn vị quy đổi |
| `product_variants` | `TH40-XD` Xanh | **Tồn kho**, mã vạch |

Lợi ích: bảng giá ~500 dòng thay vì 2.000; đổi giá một lần áp cho mọi màu;
tồn kho vẫn đếm chính xác từng màu.

```sql
item_groups      (id, code unique, name, parent_id references item_groups, sort_order)

uoms             (id, code unique, name)   -- cái, chục, thùng, hộp, bộ, cặp

products         (id, sku unique, name,
                  name_normalized text generated always as (fn_unaccent_lower(name)) stored,
                  item_group_id, base_uom_id, brand, default_supplier_id,
                  safety_stock numeric(14,3) default 0,
                  status text check (status in ('active','inactive')),
                  image_url, description)

product_uoms     (product_id, uom_id, factor numeric(12,4),
                  primary key (product_id, uom_id))
                  -- base uom bắt buộc có factor = 1

product_variants (id, product_id, variant_code unique, attr_color, attr_note,
                  is_default bool default false,
                  status text check (status in ('active','inactive')))

product_barcodes (id, variant_id, barcode text unique,
                  source text check (source in ('manufacturer','internal')))
```

**Ràng buộc bắt buộc:**

- Mọi `products` phải có **ít nhất 1 biến thể**, và đúng **1 biến thể** `is_default = true`.
  Sản phẩm không có màu thì tạo biến thể mặc định tên trùng sản phẩm.
- `stock_ledger` **luôn** trỏ `variant_id`, không bao giờ trỏ thẳng `product_id`.
  Nếu cho phép cả hai sẽ có hai đường tính tồn song song và sớm muộn lệch nhau.
- `product_uoms` phải có đúng một dòng với `factor = 1` ứng với `products.base_uom_id`.
- Tìm kiếm bỏ dấu: index `pg_trgm` trên `name_normalized`.

## 5. Bảng giá

```sql
price_lists      (id, store_id, name, kind text check (kind in ('retail','wholesale')),
                  is_default bool)

price_list_items (id, price_list_id, product_id,       -- ← product, KHÔNG phải variant
                  price_per_base_unit numeric(14,2),
                  effective_from date default current_date)
```

- Giá gắn ở **mẫu**, mọi biến thể cùng giá.
- Giá hiển thị theo đơn vị lớn = `price_per_base_unit × factor`.
- Đổi giá thì thêm dòng mới với `effective_from` mới, không update dòng cũ (giữ lịch sử).
- Mỗi cửa hàng có tối thiểu 2 bảng giá: một `retail`, một `wholesale`.

## 6. Tồn kho

```sql
stock_ledger   (id, store_id, variant_id,
                qty_base numeric(14,3),            -- có dấu: + nhập, − xuất
                ref_type text check (ref_type in
                  ('opening','sale','purchase','return_in','return_scrap','adjust')),
                ref_id uuid,
                unit_cost numeric(14,2),           -- LƯU, không tính gì từ nó
                balance_after numeric(14,3),
                note, created_at, created_by)

stock_balances (store_id, variant_id, qty_base numeric(14,3), updated_at,
                primary key (store_id, variant_id))
```

- `stock_ledger` **append-only**: `REVOKE UPDATE, DELETE` với mọi role, kể cả owner.
- `stock_balances` là cache do trigger cập nhật, có thể dựng lại bất cứ lúc nào bằng
  `rpc_rebuild_stock_balances(store_id)`.
- **Assert bắt buộc trong CI:** với mọi `(store_id, variant_id)`,
  `SUM(stock_ledger.qty_base) = stock_balances.qty_base`.
- `ref_type = 'return_scrap'` ghi `qty_base = 0` (hàng nứt vỡ không nhập lại kho)
  nhưng vẫn tạo dòng để truy vết hao hụt.

## 7. Bán hàng

```sql
orders      (id, client_uuid uuid unique, store_id, order_no unique, shift_id,
             customer_id, price_list_id,
             order_kind text check (order_kind in ('retail','wholesale')),
             status text check (status in ('held','paid','void')),
             subtotal, discount_order, total,
             paid_amount, debt_amount,
             payment_status text check (payment_status in ('paid','partial','unpaid')),
             due_date date, note, created_by, paid_at, voided_at, void_reason)

order_items (id, order_id, variant_id, uom_id, factor,
             qty_input numeric(14,3), qty_base numeric(14,3),
             unit_price, line_discount, line_total, line_no int)

payments    (id, order_id, method text check (method in ('cash','transfer','debt')),
             amount, ref_no)
```

- `debt_amount = total − (tổng payments không phải 'debt')`
- `payment_status` được cập nhật lại mỗi khi có phân bổ thu tiền
- Đơn `held` (treo) **lưu trên server**, không phải localStorage
- Huỷ đơn: đặt `status = 'void'`, sinh ledger đảo chiều, ghi `audit_log`.
  **Không xoá bản ghi gốc.**

## 8. Công nợ khách — đối trừ theo từng hoá đơn

Đây là yêu cầu rõ ràng của chủ cửa hàng: cần biết tiền trả cho hoá đơn nào.

```sql
receipts            (id, store_id, customer_id, receipt_no unique, receipt_date,
                     method text check (method in ('cash','transfer')),
                     total_amount, note, created_by)

receipt_allocations (id, receipt_id, order_id, allocated_amount)
```

**Ràng buộc bắt buộc (kiểm tra trong RPC, không phải ở client):**

- `SUM(receipt_allocations.allocated_amount) = receipts.total_amount`
- Với mỗi đơn: `SUM(allocated) ≤ orders.debt_amount` — không cho trả vượt
- Sau mỗi lần phân bổ, cập nhật lại `orders.payment_status`

**Màn thu tiền:** chọn khách → danh sách đơn `unpaid`/`partial` (cũ nhất trước) →
tích chọn nhiều đơn → nhập số tiền → nút **"Phân bổ tự động theo thứ tự cũ nhất"**,
cho phép sửa tay từng dòng.

**Báo cáo tuổi nợ:** 0–30 / 31–60 / 61–90 / trên 90 ngày, tính từ `orders.paid_at`.

Quy mô: 50 khách, 1–2 đơn nợ/ngày. **Không cần tối ưu hiệu năng.
Cần số dư luôn đúng và truy vết được.**

## 9. Nhập kho & công nợ nhà cung cấp

```sql
inbound_receipts (id, client_uuid uuid unique, store_id, receipt_no unique,
                  supplier_id, receipt_date, subtotal, total,
                  paid_amount, debt_amount, payment_status, status, note)

inbound_items    (id, receipt_id, variant_id, uom_id, factor,
                  qty_input, qty_base,
                  unit_cost_input numeric(14,2),      -- giá theo đơn vị nhập
                  unit_cost_base numeric(14,2),       -- = unit_cost_input / factor
                  line_total, line_no int)

supplier_payments            (id, store_id, supplier_id, payment_no unique,
                              payment_date, method, total_amount, note)
supplier_payment_allocations (id, payment_no_id, inbound_receipt_id, allocated_amount)
```

- **Không** phân bổ chi phí vận chuyển. **Không** tính giá vốn bình quân.
- `unit_cost_base` được ghi vào `stock_ledger.unit_cost` và dừng ở đó.
- Công nợ NCC đối trừ theo phiếu nhập, đối xứng với công nợ khách.

## 10. Trả hàng

```sql
returns      (id, client_uuid uuid unique, store_id, order_id, return_no unique,
              return_date,
              refund_method text check (refund_method in
                ('cash','transfer','credit_next_order')),
              total_refund, note, created_by)

return_items (id, return_id, order_item_id, variant_id, qty_base,
              condition text check (condition in ('intact','damaged')),
              refund_amount)
```

- Chỉ trả trên đơn `status = 'paid'`, trong `stores.return_window_days`.
- **Không cho trả vượt**: `SUM(return_items.qty_base) ≤ order_items.qty_base − đã trả trước đó`.
- `intact` → ledger `return_in` (+qty). `damaged` → ledger `return_scrap` (qty 0, ghi hao hụt).
- `credit_next_order` → ghi công nợ âm cho khách (khách được trừ vào đơn sau).

## 11. Kiểm kê & tồn đầu kỳ

```sql
stock_takes      (id, store_id, take_no unique, take_date,
                  kind text check (kind in ('opening','periodic')),
                  item_group_id,                     -- kiểm kê cuốn chiếu theo nhóm
                  status text check (status in ('draft','submitted')),
                  note, created_by, submitted_at)

stock_take_items (id, take_id, variant_id,
                  system_qty numeric(14,3),          -- tồn hệ thống lúc chốt
                  counted_qty numeric(14,3),
                  diff numeric(14,3) generated always as (counted_qty - system_qty) stored)
```

- `kind = 'opening'` cho tồn đầu kỳ → sinh ledger `ref_type = 'opening'`
- `kind = 'periodic'` cho kiểm kê định kỳ → sinh ledger `ref_type = 'adjust'`
- Phiếu `draft` lưu dở dang được, đếm nhiều ngày
- Chỉ sinh bút toán khi `submitted`

## 12. Ca làm việc & quỹ

```sql
cash_shifts       (id, store_id, user_id, opened_at, closed_at,
                   opening_float, expected_cash, counted_cash,
                   variance numeric(14,2),
                   status text check (status in ('open','closed')))

cash_transactions (id, store_id, shift_id, client_uuid uuid not null unique,
                   type text check (type in ('in','out')),
                   amount, reason,
                   source_type cash_txn_source not null default 'manual',
                   source_id uuid,
                   created_at, created_by)
```

`client_uuid`, `source_type` và `source_id` thêm ở `0014` (Phase 2).
`client_uuid` chống ghi trùng khi bấm đúp hoặc outbox retry — cùng khuôn với
`orders`, `receipts`, `returns`. `source_type` là enum
`('manual','receipt','return','supplier_payment')`; `source_id` trỏ về chứng từ gốc
và bắt buộc NULL khi `source_type = 'manual'`.

**Công thức tiền két — BỐN số hạng:**

```
expected_cash = opening_float
              + Σ payments.amount     (method='cash', qua orders.shift_id, orders.status='paid')
              + Σ cash_transactions   (type='in')
              − Σ cash_transactions   (type='out')
```

Bản trước ghi năm số hạng, thêm "thu nợ tiền mặt". Đó là **lỗi**: `receipts` không có
`shift_id`, nên không có đường nào nối phiếu thu với ca. `rpc_create_receipt` ghi
`cash_transactions` khi thu tiền mặt (03-rpc.md), tức là thu nợ **đã nằm trong**
`cash_transactions`. Cộng cả hai là đếm đôi mỗi đồng thu nợ.

> `cash_transactions` là kênh **duy nhất** cho mọi dòng tiền mặt không phải
> `payments` của đơn bán. Ai thêm luồng tiền mặt mới mà không ghi
> `cash_transactions` thì đóng ca sai và không có gì báo.

- Đóng ca ghi `variance = counted_cash − expected_cash`, không chặn nếu lệch
- Mỗi cửa hàng chỉ có **một** ca `open` tại một thời điểm
  (`ux_cash_shifts_one_open_store`, thêm ở `0014`)

## 13. Hệ thống

```sql
audit_log        (id, actor_id, store_id, action, entity, entity_id,
                  before jsonb, after jsonb, at timestamptz default now())

number_sequences (store_id, doc_type, period, current_no int,
                  primary key (store_id, doc_type, period))
```

### Sinh số chứng từ

```sql
create or replace function fn_next_doc_no(p_store uuid, p_type text)
returns text language plpgsql as $$
declare
  v_period text := to_char(now() at time zone 'Asia/Ho_Chi_Minh','YYYY');
  v_no int;
begin
  insert into number_sequences(store_id, doc_type, period, current_no)
  values (p_store, p_type, v_period, 1)
  on conflict (store_id, doc_type, period)
  do update set current_no = number_sequences.current_no + 1
  returning current_no into v_no;
  return p_type || '-' || v_period || '-' || lpad(v_no::text, 5, '0');
end $$;
```

Mã chứng từ: `HD` đơn bán · `PN` phiếu nhập · `TH` trả hàng · `PT` phiếu thu ·
`PC` phiếu chi NCC · `KK` kiểm kê.
