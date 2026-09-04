# Phase 8 — Trả hàng

**Branch:** `phase-8-returns`
**Phụ thuộc:** Phase 7
**Đọc kèm:** `01-du-lieu.md` mục 10, `03-rpc.md`

## Mục tiêu

Xử lý khách trả hàng, phân biệt hàng còn bán được và hàng nứt vỡ.

## Bối cảnh

Đồ nhựa, thuỷ tinh, sành sứ hay nứt vỡ khi bốc xếp. Hàng nguyên vẹn thì nhập lại kho,
hàng nứt vỡ thì phải ghi nhận hao hụt chứ không nhập lại — nếu gộp chung, tồn kho
sẽ nói dối.

## Việc cần làm

### 1. Tìm hoá đơn
Theo số HĐ, tên khách, số điện thoại, hoặc chọn từ danh sách đơn gần đây.
Chỉ đơn `status = 'paid'` trong `stores.return_window_days` (mặc định 30).

### 2. Chọn hàng trả
- Hiện toàn bộ dòng của đơn gốc: đã bán bao nhiêu, đã trả trước đó bao nhiêu, còn lại
- Tích chọn dòng, nhập số lượng trả
- Với mỗi dòng chọn tình trạng: **Nguyên vẹn** hoặc **Nứt / hao hụt**
- Một dòng gốc có thể tách: 3 cái nguyên vẹn + 1 cái nứt

### 3. Hoàn tiền
Ba cách: tiền mặt, chuyển khoản, hoặc **trừ vào đơn sau** (ghi công nợ âm cho khách).
Nếu đơn gốc còn nợ, ưu tiên gợi ý trừ vào nợ.

### 4. Ghi sổ
- `intact` → `stock_ledger` `ref_type = 'return_in'`, qty dương → **tồn tăng**
- `damaged` → `stock_ledger` `ref_type = 'return_scrap'`, `qty_base = 0` →
  **tồn không tăng**, nhưng có dòng để truy vết
- Tiền mặt hoàn khi ca đang mở → `cash_transactions` type `out`

### 5. In phiếu trả hàng
Route `/print/bill/[id]` dùng chung, phân biệt loại chứng từ.

## Ràng buộc

- **Không cho trả vượt**: `SUM(đã trả) + qty mới ≤ order_items.qty_base`
- Không trả trên đơn `void`
- Không sửa đơn gốc — trả hàng là chứng từ riêng

## Acceptance criteria

- [ ] Đơn bán 10 cái, trả 3 cái → còn trả được tối đa 7 cái
- [ ] Trả 8 cái trên đơn còn 7 → bị chặn `RETURN_EXCEEDS_SOLD`
- [ ] Trả 4 cái: 3 nguyên vẹn + 1 nứt → tồn tăng đúng **3**, có 2 dòng ledger
      (`return_in` +3 và `return_scrap` 0)
- [ ] Báo cáo hao hụt liệt kê đúng 1 cái nứt
- [ ] Hoàn tiền mặt khi ca đang mở → tiền két dự kiến giảm đúng số tiền hoàn
- [ ] `refund_method = 'credit_next_order'` → công nợ khách giảm đúng
- [ ] Trả trên đơn quá 30 ngày → bị chặn
- [ ] `SUM(stock_ledger)` vẫn khớp `stock_balances`
- [ ] `pnpm verify` xanh
