# Phase 11 — Hoàn thiện & bàn giao

**Branch:** `phase-11-hardening`
**Phụ thuộc:** Phase 10

## Mục tiêu

Đưa hệ thống từ "chạy được" sang "dùng được lâu dài".

## Việc cần làm

### 1. Nhật ký thay đổi
Trigger ghi `audit_log` cho:
- Đổi giá bán
- Huỷ đơn (kèm lý do)
- Điều chỉnh kho ngoài bán/nhập/trả
- Sửa/xoá khách hàng, nhà cung cấp
- Thêm/xoá người dùng, đổi vai trò

Màn xem nhật ký cho `owner`: lọc theo người, theo loại, theo khoảng ngày.

### 2. Trạng thái giao diện
Rà **mọi** màn hình, đảm bảo đủ 4 trạng thái: loading, empty, error, có dữ liệu.
Error boundary ở cấp route. Thông báo lỗi bằng tiếng Việt, nói rõ người dùng nên làm gì.

### 3. Giám sát
Sentry cho cả client và server. Cảnh báo khi RPC lỗi.

### 4. Kiểm thử tự động
- **Playwright e2e** luồng chính: đăng nhập → mở ca → bán hàng → in bill →
  thu tiền nợ → trả hàng → đóng ca
- Test số học: phân bổ công nợ, quy đổi đơn vị, tính tiền thối
- **Assert tính toàn vẹn** chạy trong CI:
  - `SUM(stock_ledger.qty_base) = stock_balances.qty_base` mọi biến thể
  - `SUM(receipt_allocations) ≤ orders.debt_amount` mọi đơn
  - Không có `orders.order_no` trùng

### 5. Sao lưu
- PITR trên Supabase production (đã bật ở Phase 9, kiểm tra lại)
- Cron xuất CSV hàng ngày các bảng: `orders`, `order_items`, `stock_ledger`,
  `receipts`, `receipt_allocations` → lưu ngoài Supabase

### 6. Tài liệu bàn giao
- `docs/huong-dan-su-dung.md`: hướng dẫn cho chủ và người nhà, có ảnh chụp màn hình
- `docs/van-hanh.md`: cách khôi phục dữ liệu, cách dựng lại `stock_balances`,
  cách thêm người dùng mới, xử lý đơn "Cần xử lý"
- README cập nhật đúng hiện trạng

### 7. Rà soát cuối
- [ ] Không file `.ts`/`.tsx` nào vượt 400 dòng
- [ ] Không còn `any` trong `src/`
- [ ] Không còn `console.log` trong code production
- [ ] Không còn TODO/FIXME chưa xử lý hoặc chưa ghi vào issue

## Acceptance criteria

- [ ] Playwright e2e xanh trên CI
- [ ] Đổi giá một sản phẩm → có dòng trong `audit_log` với giá trước và sau
- [ ] Huỷ một đơn → tồn kho hoàn lại đúng, đơn giữ nguyên trong database
      với `status = 'void'`
- [ ] Tắt Supabase (đổi URL sai) → app hiện màn lỗi tử tế, không trắng trang
- [ ] Assert toàn vẹn dữ liệu chạy trong CI và xanh
- [ ] File CSV backup sinh ra đúng lịch, mở được
- [ ] `grep -rn "console.log" src/` không có kết quả
- [ ] `grep -rn ": any" src/` không có kết quả
- [ ] `find src -name "*.tsx" -o -name "*.ts" | xargs wc -l | awk '$1>400'` rỗng
- [ ] `pnpm verify` xanh

## Định nghĩa hoàn thành toàn dự án

- [ ] Bán một đơn ở cửa hàng A → refresh máy cửa hàng B, tồn và doanh thu B không đổi
- [ ] Xoá sạch localStorage + IndexedDB → không mất dữ liệu nào
- [ ] `SUM(stock_ledger)` = `stock_balances` với mọi biến thể
- [ ] Tổng dư nợ khách = `SUM(orders.debt_amount)` với `payment_status <> 'paid'`
- [ ] Đổi giá mẫu `TH40` → cả 3 màu đổi theo, cửa hàng còn lại không đổi
- [ ] Quét mã nhà sản xuất và mã tem tự in đều ra đúng biến thể
- [ ] Offline bán 3 đơn → online → đúng 3 đơn, sync lại không nhân bản
- [ ] Doanh thu dashboard = tổng đơn `paid` trong kỳ
- [ ] Không còn con số hardcode nào trong `src/`
- [ ] Không tồn tại `valuation`, `avg_cost`, `cogs`, `gross_profit` trong codebase
