# Phase 5 — Bán hàng (POS)

**Branch:** `phase-5-pos`
**Phụ thuộc:** Phase 4
**Đọc kèm:** `01-du-lieu.md` mục 7, `03-rpc.md`

## Mục tiêu

Bán được hàng thật, trừ kho đúng, in bill được. Đây là phase quan trọng nhất về mặt sản phẩm.

## Bối cảnh

Ở v1, đây chính là chức năng **không hoạt động**: gõ vào ô tìm kiếm không ra gợi ý,
giỏ hàng là 3 dòng hardcode, và có dòng hiển thị `1 × 165.000 = 155.000`.
Lần này mọi con số phải đến từ dữ liệu.

## Việc cần làm

### 1. Tìm và thêm hàng
- Ô tìm kiếm luôn giữ focus, phím `F1` đưa con trỏ về đây
- Gõ tên **không dấu**, debounce 150ms, gợi ý tối đa 8 dòng
- Điều hướng `↑` `↓`, `Enter` để thêm vào giỏ
- **Quét mã vạch:** phát hiện kiểu keyboard-wedge — gom phím, nếu có `Enter`
  trong vòng 50ms thì coi là quét, nhảy **thẳng vào biến thể**, không qua bước chọn màu
- Gõ tay: chọn sản phẩm → hiện danh sách màu → chọn màu

### 2. Giỏ hàng
Cột: `Mã | Tên hàng | ĐVT | SL | Đơn giá | Giảm | Thành tiền`
- Sửa số lượng trực tiếp trong bảng
- `F4` đổi đơn vị tính, đơn giá tự nhân theo hệ số
- Giảm giá theo dòng (số tiền)
- Xoá dòng
- Chân bảng: tổng số mặt hàng, tổng số đơn vị, **tồn sau bán** (số từ server)

### 3. Thanh toán
- Chuyển `Đơn LẺ` / `Đơn SỈ` → đổi bảng giá áp dụng cho cả đơn
- Chọn khách hàng (mặc định "Khách lẻ tại quầy"), tìm theo tên/số điện thoại
- Giảm giá toàn đơn: theo `đ` hoặc `%`
- **Thanh toán hỗn hợp:** tiền mặt + chuyển khoản + ghi nợ trong cùng một đơn.
  Tổng các phương thức phải bằng tổng đơn
- Ghi nợ chỉ cho phép khi đã chọn khách hàng cụ thể (không phải khách lẻ)
- Tính tiền thối
- Ghi chú đơn
- `F9` mở thanh toán, `Esc` đóng mọi modal

### 4. Treo đơn
Treo và lấy lại đơn treo, **lưu trên server** (`orders.status = 'held'`).
Badge số đơn đang treo trên thanh công cụ.

### 5. In bill nhiệt 80mm
- Route riêng `/print/bill/[orderId]`, layout độc lập
- `@page { size: 80mm auto; margin: 0 }`
- Nội dung: tên cửa hàng, địa chỉ, số HĐ, ngày giờ, thu ngân, danh sách hàng
  (tên + SL + ĐVT + đơn giá + thành tiền), tổng, giảm, phải trả, tiền khách đưa,
  tiền thối, chân trang từ `stores.receipt_footer`
- Nếu đơn có ghi nợ, in thêm dòng "Còn nợ: X"

## Ràng buộc

- **Giá luôn lấy từ server** trong `rpc_pos_checkout`, không tin giá client gửi lên
- Không hiển thị bất kỳ thông tin nào về giá vốn hay lãi
- Không tự thêm khuyến mãi, combo, tích điểm

## Acceptance criteria

- [ ] Gõ `ghe nhua` ra `Ghế nhựa thấp Duy Tân`, Enter thêm được vào giỏ
- [ ] Quét mã vạch của `TH40-XD` → thêm đúng biến thể Xanh, không hỏi màu
- [ ] Mọi dòng thoả `Thành tiền = SL × Đơn giá − Giảm` (kiểm tra bằng test tự động)
- [ ] Bán 6 cái `TH40-XD` từ tồn 142 → sau đơn còn **136**, số đọc từ database
- [ ] Đổi từ Cái sang Thùng: SL 1 thùng → đơn giá tự thành 480.000 (40.000 × 12)
- [ ] Thanh toán hỗn hợp: tổng 541.000 = tiền mặt 300.000 + CK 200.000 + nợ 41.000,
      đơn có `payment_status = 'partial'`, `debt_amount = 41.000`
- [ ] Ghi nợ khi chưa chọn khách → bị chặn với thông báo rõ ràng
- [ ] Treo đơn, đăng xuất, đăng nhập lại → đơn treo vẫn còn
- [ ] Bán ở cửa hàng A → tồn kho và doanh thu cửa hàng B **không đổi**
- [ ] Bán vượt tồn → báo `INSUFFICIENT_STOCK` kèm tên hàng cụ thể
- [ ] In bill: mở `/print/bill/[id]`, xem trước in ra khổ 80mm đúng
- [ ] `grep -rniE "avg_cost|gross_profit|cogs|lãi gộp|giá vốn" src/` không có kết quả
- [ ] `pnpm verify` xanh
