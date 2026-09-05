# Phase 1 — Database & RLS

**Branch:** `phase-1-database`
**Phụ thuộc:** Phase 0
**Đọc kèm:** `01-du-lieu.md`, `02-phan-quyen.md`

## Mục tiêu

Dựng toàn bộ schema, RLS và dữ liệu mẫu. Sinh TypeScript types.

> **Đây là phase quan trọng nhất của cả dự án.** Sai schema ở đây thì mọi thứ phía trên
> sai theo và phải làm lại. Đi chậm. Nếu có gì không rõ trong `01-du-lieu.md`, **hỏi
> trước khi viết**.

## Việc cần làm

### 1. Migration, đánh số thứ tự, mỗi file một chủ đề

```
0001_extensions.sql        -- pgcrypto, pg_trgm, unaccent + hàm fn_unaccent_lower
0002_org_users.sql         -- stores, profiles, store_members
0003_catalog.sql           -- item_groups, uoms, products, product_uoms,
                           -- product_variants, product_barcodes
0004_pricing.sql           -- price_lists, price_list_items
0005_stock.sql             -- stock_ledger, stock_balances + trigger
0006_sales.sql             -- orders, order_items, payments
0007_receivables.sql       -- receipts, receipt_allocations
0008_purchasing.sql        -- inbound_receipts, inbound_items,
                           -- supplier_payments, supplier_payment_allocations
0009_returns.sql           -- returns, return_items
0010_stocktake_shift.sql   -- stock_takes, stock_take_items,
                           -- cash_shifts, cash_transactions
0011_system.sql            -- audit_log, number_sequences, fn_next_doc_no,
                           -- fn_assert_stock_integrity
0012_rls_helpers.sql       -- fn_my_store_ids, fn_is_owner, fn_is_any_owner,
                           -- rpc_rebuild_stock_balances
0013_rls_policies.sql      -- toàn bộ policy + revoke + grant
```

**Hàm hạ tầng nằm trong 13 file trên, không tách file riêng:**

| Hàm | File | Vì sao |
|---|---|---|
| `fn_unaccent_lower`, `fn_today_vn`, `fn_touch_updated_at` | 0001 | Không phụ thuộc bảng nào |
| `fn_next_doc_no`, `fn_assert_stock_integrity` | 0011 | Cần `number_sequences` / `stock_ledger` |
| `fn_my_store_ids`, `fn_is_owner`, `fn_is_any_owner` | 0012 | Theo đúng tên file |
| `rpc_rebuild_stock_balances` | 0012 | Gọi `fn_is_owner`, phải đứng sau nó |

**RPC nghiệp vụ KHÔNG viết ở phase này.** `rpc_pos_checkout`, `rpc_receive_inbound`,
`rpc_create_receipt`, `rpc_pay_supplier`, `rpc_process_return`, `rpc_submit_stock_take`,
`rpc_open_shift`/`rpc_close_shift`, `rpc_update_price`, `rpc_void_order` (toàn bộ
`03-rpc.md`) thuộc phạm vi phase dùng tới chúng — viết ở đây thì không có UI để kiểm
chứng, và vi phạm quy tắc "không làm nhiều phase trong một PR".

Mỗi RPC mới phải **tự cấp `grant execute ... to authenticated`** trong migration của
nó. `0013` chỉ cấp cho các hàm tồn tại tại thời điểm đó.

### 2. Trigger cập nhật `stock_balances`

Trigger `after insert on stock_ledger`: upsert `stock_balances`, đồng thời điền
`balance_after` vào chính dòng ledger vừa ghi.

### 3. Ràng buộc phải có ở tầng database, không phải ở client

- `products` phải có đúng 1 `product_variants.is_default = true`
- `product_uoms` phải có đúng 1 dòng `factor = 1` khớp `products.base_uom_id`
- `revoke update, delete on stock_ledger from authenticated, anon, service_role`
- `check (qty_input > 0)` trên `order_items`, `inbound_items`
- Unique: `orders.order_no`, `orders.client_uuid`, `product_barcodes.barcode`

### 4. Seed (`supabase/seed.sql`) — chỉ chạy ở dev

- 2 cửa hàng: `CH1` Ngọc Sơn 1, `CH2` Ngọc Sơn 2
- 3 user: 1 `owner` (cả 2 cửa hàng), 2 `staff` (mỗi người 1 cửa hàng)
- 4 nhóm hàng: Nhựa gia dụng, Nhôm – inox, Thuỷ tinh – sứ, Gia dụng khác
- 6 đơn vị: Cái, Chục, Thùng, Hộp, Bộ, Cặp
- ~30 sản phẩm thật của ngành hàng, trong đó:
  - ít nhất 5 sản phẩm có 3 biến thể màu
  - ít nhất 10 sản phẩm có 3 đơn vị (cái/chục/thùng)
  - ít nhất 15 biến thể có mã vạch `manufacturer`, số còn lại `internal`
- 4 bảng giá (mỗi cửa hàng 1 lẻ + 1 sỉ), giá **khác nhau giữa 2 cửa hàng**
- 8 khách hàng (5 sỉ có công nợ), 3 nhà cung cấp

### 5. Sinh types

```bash
supabase gen types typescript --linked > src/lib/db/types.ts
```
Thêm script `pnpm db:types`. File này **không sửa tay**.

### 6. Script kiểm thử RLS

`pnpm test:rls` — dùng `service_role` tạo JWT giả lập từng user, chạy hết checklist
trong `02-phan-quyen.md` mục 5.

### 7. Script kiểm thử ràng buộc schema

`pnpm test:schema` — chứng minh các ràng buộc ở mục 3 thật sự chặn ở tầng database,
không phải chỉ có trong đầu người viết migration. Chạy trong một transaction và
rollback ở cuối, không để lại dữ liệu rác.

**Không** nằm trong `pnpm verify` và không nằm trong pre-commit hook — cùng lý do với
`pnpm test:rls`: cần database thật và cần mạng, không nên chặn từng commit lẻ. Chạy
thủ công ở bước Kiểm chứng cuối phase.

Lưu ý kỹ thuật quan trọng: `RELEASE SAVEPOINT` **không** kích hoạt constraint trigger
đang `DEFERRABLE INITIALLY DEFERRED` — chỉ `COMMIT` hoặc `SET CONSTRAINTS ALL IMMEDIATE`
mới làm được. Script này dùng `SET CONSTRAINTS ALL IMMEDIATE`, và mọi RPC danh mục
(Phase 3) cũng phải làm đúng như vậy nếu muốn bắt lỗi để dịch sang thông báo cho
người dùng thay vì để lỗi nổ lúc commit.

## Ràng buộc

- **Không** cột `avg_cost`, `valuation_rate` ở bất kỳ đâu
- **Không** policy nào dùng `USING (true)`
- **Không** đặt `store_id` lên bảng dùng chung (xem bảng ở `01-du-lieu.md` mục 1)
- Migration đã commit thì **không sửa** — sai thì viết migration mới

## Acceptance criteria

- [ ] `supabase db push` chạy sạch trên database trống
- [ ] `pnpm db:types` sinh được file, `pnpm verify` xanh
- [ ] `pnpm test:schema` xanh, phủ hết ràng buộc ở mục 3
- [ ] `pnpm test:rls` xanh, đủ 7 mục trong `02-phan-quyen.md`
- [ ] `staff` cửa hàng A `select * from orders` **không** thấy đơn cửa hàng B
- [ ] `insert into orders` trực tiếp bằng role `authenticated` **bị từ chối**
- [ ] `update stock_ledger` **bị từ chối** với mọi role
- [ ] `grep -rniE "avg_cost|valuation" supabase/` không có kết quả
- [ ] `grep -rn "USING (true)" supabase/` không có kết quả
- [ ] Seed chạy xong: `select count(*) from products` = 30,
      `select count(*) from product_variants` ≥ 45
