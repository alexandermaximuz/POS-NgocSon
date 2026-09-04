# 02 — Phân quyền & RLS

## 1. Chỉ 2 vai trò

Người dùng là chủ và người nhà, mỗi cửa hàng 1 máy. Không cần 5 vai trò như ERPNext.

| Vai trò | Phạm vi | Quyền |
|---|---|---|
| `owner` | Cả 2 cửa hàng | Sửa danh mục, bảng giá, xem mọi báo cáo, huỷ đơn, điều chỉnh kho, quản lý người dùng |
| `staff` | 1 cửa hàng được gán | Bán hàng, nhập kho, thu tiền nợ, kiểm kê, xem tồn kho, trả hàng |

```sql
store_members (store_id, user_id, role check (role in ('owner','staff')))
```

Một user có thể là `owner` của cả 2 cửa hàng (2 dòng), hoặc `staff` của 1 cửa hàng.

## 2. Mục đích của RLS ở dự án này

> RLS phục vụ **tách dữ liệu giữa 2 cửa hàng**, không phải chống người dùng nội bộ.

Người bán là người nhà, và giá vốn đã bị loại khỏi scope. **Không** dựng lớp bảo vệ
kiểu "thu ngân không được thấy giá vốn kể cả qua DevTools" — đó là chống lại mối
đe doạ không tồn tại và chỉ làm hệ thống phức tạp thêm.

## 3. Hàm hỗ trợ

```sql
create or replace function fn_my_store_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select store_id from store_members where user_id = auth.uid()
$$;

create or replace function fn_is_owner(p_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from store_members
    where user_id = auth.uid() and store_id = p_store and role = 'owner')
$$;

create or replace function fn_is_any_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from store_members where user_id = auth.uid() and role = 'owner')
$$;
```

## 4. Quy tắc policy

**Mọi bảng:** `enable row level security` **và** `force row level security`.

**Tuyệt đối không có policy nào dùng `USING (true)`.**
Nếu bạn định viết `true`, dừng lại và đọc lại mục này.

### 4.1. Bảng theo cửa hàng

```sql
-- SELECT
create policy sel_<table> on <table> for select
  using (store_id in (select fn_my_store_ids()));
```

INSERT / UPDATE / DELETE trực tiếp: **REVOKE hoàn toàn** với các bảng giao dịch
(xem 4.3). Với bảng cấu hình theo cửa hàng (`price_lists`, `price_list_items`):
chỉ `owner` của đúng cửa hàng đó.

### 4.2. Bảng dùng chung

```sql
-- SELECT cho mọi user đã đăng nhập
create policy sel_products on products for select
  using (auth.uid() is not null);

-- INSERT/UPDATE chỉ owner
create policy ins_products on products for insert
  with check (fn_is_any_owner());
create policy upd_products on products for update
  using (fn_is_any_owner());
```

Áp dụng cho: `item_groups`, `uoms`, `products`, `product_uoms`, `product_variants`,
`product_barcodes`, `customers`, `suppliers`.

> Ngoại lệ: `staff` được phép **thêm khách hàng mới** (khách mới tới mua sỉ),
> nhưng không được sửa/xoá khách đã có.

### 4.3. Bảng chỉ ghi qua RPC

```sql
revoke insert, update, delete on
  orders, order_items, payments,
  stock_ledger, stock_balances,
  inbound_receipts, inbound_items,
  returns, return_items,
  receipts, receipt_allocations,
  supplier_payments, supplier_payment_allocations,
  cash_shifts, cash_transactions,
  number_sequences, audit_log
from authenticated;
```

Riêng `stock_ledger`: `revoke update, delete` với **mọi** role, kể cả qua RPC.
Sổ kho chỉ được ghi thêm.

### 4.4. Bảng kiểm kê

`stock_takes` / `stock_take_items`: `staff` và `owner` của cửa hàng đó được
INSERT/UPDATE khi phiếu ở trạng thái `draft`. Khi `submitted` thì khoá lại
(policy `using (status = 'draft')`).

### 4.5. Ca làm việc

`cash_shifts`: `staff` chỉ thao tác trên ca của chính mình
(`user_id = auth.uid()`); `owner` xem được tất cả ca của cửa hàng mình quản lý.

## 5. Kiểm thử bắt buộc

Script `pnpm test:rls` phải chứng minh được:

- [ ] `staff` cửa hàng A **không** đọc được `orders` của cửa hàng B
- [ ] `staff` cửa hàng A **không** đọc được `stock_balances` của cửa hàng B
- [ ] `staff` **không** sửa được `price_list_items`
- [ ] Mọi role `INSERT` trực tiếp vào `orders` đều **bị từ chối**
- [ ] Mọi role `UPDATE` hoặc `DELETE` trên `stock_ledger` đều **bị từ chối**
- [ ] `owner` đọc được dữ liệu cả 2 cửa hàng
- [ ] User chưa đăng nhập (anon) **không** đọc được bất kỳ bảng nào

Chạy script này trong CI ở mọi PR có động tới migration.
