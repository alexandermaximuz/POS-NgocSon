# 04 — Ánh xạ từ ERPNext: giữ gì, bỏ gì, vì sao

Đọc file này khi phân vân có nên thêm một trường hay không.

Nguyên tắc: ERPNext có ~90 trường trên DocType `Item`. Ta giữ khoảng 15.
Mỗi trường bị bỏ đều có lý do, không phải quên.

---

## Item → `products` + `product_variants`

| Trường ERPNext | Quyết định | Lý do |
|---|---|---|
| `item_code`, `item_name`, `item_group` | **Giữ** | Cốt lõi |
| `stock_uom`, `uoms`, `conversion_factor` | **Giữ** | Nghiệp vụ chợ Việt Nam: cái/chục/thùng |
| `has_variants`, `attributes`, `variant_of` | **Giữ** | Nền tảng mô hình màu |
| `barcodes` (child table, nhiều mã/1 item) | **Giữ** | ~50% mã NSX + ~50% tem tự in |
| `brand`, `image`, `description` | **Giữ** | |
| `safety_stock` | **Giữ** | Cảnh báo sắp hết hàng |
| `disabled` → `status` | **Giữ** | |
| `valuation_method`, `valuation_rate` | **Bỏ** | Không theo dõi giá vốn |
| `standard_rate`, `last_purchase_rate` | **Bỏ** | Giá nằm ở bảng giá |
| `is_stock_item`, `is_fixed_asset` | **Bỏ** | Mọi thứ đều là hàng tồn kho |
| `is_sub_contracted`, `is_purchase_item` | **Bỏ** | Không có sản xuất |
| `has_batch_no`, `has_serial_no`, `has_expiry_date` | **Bỏ** | Đồ gia dụng không cần |
| `item_defaults` (theo Company) | **Bỏ** | Thay bằng 1 `default_supplier_id` |
| `taxes`, `supplier_items`, `customer_items` | **Bỏ** | Không thuế, 1 NCC mặc định là đủ |
| `reorder_levels`, `quality_inspection` | **Bỏ** | Quá mức cần thiết |
| `manufacturer`, `country_of_origin`, `weight_per_unit` | **Bỏ** | Không dùng |

---

## Item Price → `price_list_items`

**Giữ:** `price_list`, `item_code`, `price_list_rate`, `valid_from`

**Bỏ:** `uom` (luôn quy về đơn vị gốc), `customer`/`supplier` (không có giá riêng
từng khách), `packing_unit`, `batch_no`, `currency` (chỉ VND), `valid_upto`

**Khác biệt có chủ ý:** ERPNext gắn giá ở **Item Variant**. Ta gắn ở **product (mẫu)**
vì các màu cùng giá — giảm bảng giá từ 2.000 xuống ~500 dòng và biến việc đổi giá
từ cực hình thành một thao tác.

> Nếu sau này có mặt hàng mà màu khác giá, phải xử lý ngoại lệ.
> Báo cho chủ dự án, đừng tự thêm cột giá vào `product_variants`.

---

## Customer → `customers`

**Giữ:** `customer_name`, `customer_group` (lẻ/sỉ), `mobile_no`, `address`,
`default_price_list`, `credit_limit`, `payment_terms`, `notes`

**Bỏ:** `territory`, `sales_team`, `loyalty_program`, `tax_id`,
`accounts` (theo Company), `customer_primary_contact` (dùng 1 số điện thoại),
`market_segment`, `industry`

---

## Supplier → `suppliers`

**Giữ:** `supplier_name`, `supplier_group`, `mobile_no`, `address`, `payment_terms`

**Bỏ:** `tax_withholding_category`, `is_transporter`, `accounts`,
`default_warehouse`, `hold_type`

---

## POS Profile → `stores` + `price_lists`

**Giữ tinh thần:** mỗi cửa hàng có bảng giá riêng, người dùng được gán,
phương thức thanh toán, chân trang hoá đơn.

**Bỏ:** `income_account`, `expense_account`, `cost_center`,
`taxes_and_charges`, `write_off_account`, `apply_discount_on` — toàn bộ phần kế toán.

---

## Sales Invoice → `orders`

**Giữ:**
- Chứng từ bất biến, số chứng từ theo dãy
- `outstanding_amount` → `debt_amount` + `payment_status`
- **Đối trừ theo hoá đơn** — đây chính là cơ chế `Payment Reference` của ERPNext
- `due_date`
- `is_return` → tách thành bảng `returns` riêng cho đơn giản

**Bỏ:** `debit_to`, `gl_entries`, `taxes`, `cost_center`, `naming_series` phức tạp,
`update_stock` (ta luôn cập nhật kho), `pos_profile`, `advances`, `payment_schedule`

---

## Payment Entry → `receipts` + `receipt_allocations`

**Giữ nguyên xi triết lý Payment Reference:** một phiếu thu phân bổ vào nhiều hoá đơn,
mỗi dòng phân bổ có số tiền riêng. Đây là phần ERPNext làm rất đúng và chủ cửa hàng
đã yêu cầu rõ ràng.

**Bỏ:** `paid_from`/`paid_to` account, `deductions`, `exchange_rate`,
`party_balance` (tính động thay vì lưu)

---

## Stock Ledger Entry → `stock_ledger`

**Giữ nguyên xi triết lý:**
- Append-only
- `qty_after_transaction` → `balance_after`
- `voucher_type` / `voucher_no` → `ref_type` / `ref_id`
- Truy ngược được về chứng từ gốc

Đây là thứ giá trị nhất ta mượn từ ERPNext. Không được cắt xén.

**Bỏ:** `valuation_rate`, `stock_value`, `stock_value_difference`,
`incoming_rate`, `outgoing_rate` — toàn bộ phái sinh giá vốn.

**Giữ có điều kiện:** `unit_cost` — lưu nhưng không tính gì từ nó.

---

## Stock Reconciliation → `stock_takes`

**Giữ:** kiểm kê sinh bút toán điều chỉnh, có `purpose = 'Opening Stock'`
→ `kind = 'opening'`

**Bỏ:** đặt lại `valuation_rate`, `expense_account`, `cost_center`

---

## Bỏ hoàn toàn khỏi hệ thống

| DocType ERPNext | Vì sao bỏ |
|---|---|
| `Company` | Chỉ 1 pháp nhân, dùng `store_id` |
| `Cost Center`, `Account`, `GL Entry`, `Journal Entry` | Không làm kế toán |
| `Fiscal Year`, `Period Closing Voucher` | Không làm kế toán |
| `Stock Entry` (Material Transfer) | Không chuyển kho giữa 2 cửa hàng |
| `Warehouse` | Thay bằng `store_id` — mỗi cửa hàng 1 kho |
| `Material Request`, `Purchase Order` | Nhập hàng trực tiếp, không có quy trình đặt hàng |
| `Delivery Note` | Giao hàng ngay tại quầy |
| `Batch`, `Serial No` | Đồ gia dụng không cần |
| `Sales Taxes and Charges Template` | Không xuất hoá đơn VAT |
| `Workflow`, `Workflow Action` | Không có phê duyệt nhiều cấp |
| `Loyalty Program`, `Pricing Rule`, `Promotional Scheme` | Không có khuyến mãi phức tạp |
| `Item Attribute` (bảng riêng) | Gộp thẳng vào `product_variants.attr_color` cho đơn giản |

---

## Nguyên tắc khi phân vân

Nếu bạn đang cân nhắc thêm một trường vì "ERPNext có nó", hãy hỏi:

1. Người nhà đứng bán hàng có nhìn thấy hoặc nhập trường này không?
2. Có báo cáo nào trong scope cần nó không?
3. Nếu thiếu nó, có mất dữ liệu không thể dựng lại không?

Trả lời "không" cho cả ba → **bỏ**.
Riêng câu 3 trả lời "có" → **giữ, kể cả khi hiện tại chưa dùng tới**
(đây là lý do `unit_cost` được giữ).
