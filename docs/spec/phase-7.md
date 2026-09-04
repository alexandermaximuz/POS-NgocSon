# Phase 7 — Công nợ khách & phiếu thu

**Branch:** `phase-7-receivables`
**Phụ thuộc:** Phase 6
**Đọc kèm:** `01-du-lieu.md` mục 8, `03-rpc.md`

## Mục tiêu

Theo dõi công nợ 50 khách sỉ, thu tiền và **đối trừ theo từng hoá đơn**.

## Bối cảnh

Đây là chức năng chính mà file Excel hiện tại đang gánh. Quy mô nhỏ
(1–2 đơn nợ/ngày) nhưng số dư tích luỹ nhiều tháng, nên **số phải luôn đúng
và truy vết được**. Chủ cửa hàng yêu cầu rõ: cần biết tiền trả cho hoá đơn nào.

## Việc cần làm

### 1. Danh sách công nợ khách
- Cột: khách hàng | số đơn chưa trả | tổng còn nợ | quá hạn lâu nhất
- Lọc: chỉ khách còn nợ / tất cả
- `owner` xem được cả 2 cửa hàng, có cột tách theo từng cửa hàng và cột tổng

### 2. Chi tiết công nợ một khách
- Thông tin khách, hạn mức tín dụng, điều khoản thanh toán
- Danh sách đơn: số HĐ | ngày | tổng | đã trả | còn nợ | trạng thái | số ngày quá hạn
- Lịch sử phiếu thu, mỗi phiếu xem được đã phân bổ vào những đơn nào

### 3. Màn thu tiền (quan trọng nhất phase này)
- Chọn khách → hiện danh sách đơn `unpaid` / `partial`, **sắp xếp cũ nhất trước**
- Nhập tổng số tiền thu, chọn phương thức (tiền mặt / chuyển khoản)
- Nút **"Phân bổ tự động theo thứ tự cũ nhất"** — điền sẵn từng dòng
- Cho phép **sửa tay** số tiền phân bổ từng dòng
- Hiển thị realtime: đã phân bổ X / tổng Y / còn lại Z. Còn lại ≠ 0 thì không cho lưu
- Lưu → `rpc_create_receipt`, in phiếu thu

### 4. Báo cáo tuổi nợ
Nhóm: 0–30 / 31–60 / 61–90 / trên 90 ngày. Tính từ `orders.paid_at`.
Có tổng theo từng nhóm và theo từng khách.

### 5. Cảnh báo khi bán
Ở màn bán hàng, khi chọn khách có nợ quá hạn hoặc vượt hạn mức
→ hiện cảnh báo (không chặn, chỉ nhắc).

## Ràng buộc

- Không cho phân bổ vượt `debt_amount` của từng đơn
- Không cho lưu phiếu thu nếu tổng phân bổ ≠ tổng tiền
- Tiền mặt thu nợ khi ca đang mở phải vào `cash_transactions` để đóng ca tính đúng

## Acceptance criteria

- [ ] Khách nợ 3 đơn: 1.000.000 / 2.000.000 / 1.500.000.
      Thu 2.500.000, phân bổ tự động →
      đơn 1 `paid`, đơn 2 `partial` còn **500.000**, đơn 3 `unpaid`.
      Tổng dư nợ = **2.000.000**. Không lệch một đồng
- [ ] Sửa tay phân bổ: 2.500.000 chia 1.000.000 / 0 / 1.500.000 → đơn 1 và 3 `paid`,
      đơn 2 nguyên `unpaid`
- [ ] Phân bổ tổng 2.400.000 khi thu 2.500.000 → **không lưu được**, báo lỗi rõ
- [ ] Phân bổ 1.200.000 vào đơn chỉ nợ 1.000.000 → bị chặn
- [ ] Thu tiền mặt 2.500.000 khi ca đang mở → tiền két dự kiến tăng đúng 2.500.000
- [ ] Báo cáo tuổi nợ: đơn 95 ngày trước nằm đúng nhóm "trên 90 ngày"
- [ ] Tổng công nợ khách = `SUM(orders.debt_amount) WHERE payment_status <> 'paid'`
- [ ] Công nợ ở cửa hàng A không lẫn vào cửa hàng B
- [ ] `pnpm verify` xanh
