# 00 — Tổng quan & ranh giới scope

## Bối cảnh

Hệ thống bán hàng cho **2 cửa hàng** đồ gia dụng (nhựa, nhôm, inox, thuỷ tinh) tại Việt Nam.

- Người dùng: chủ cửa hàng và người nhà. Đều quen máy tính.
- **Mỗi cửa hàng 1 máy** — không có bán song song trong cùng một cửa hàng.
- Hiện đang dùng Excel thủ công, chỉ theo dõi công nợ khách sỉ và bảng giá.
  **Không theo dõi được tồn kho.**
- Hơn 2.000 mã tính theo quy cách/kích thước/màu.
- ~50 khách sỉ có công nợ, số dư tích luỹ nhiều tháng, phát sinh 1–2 đơn nợ/ngày.
- ~50% mặt hàng có mã vạch nhà sản xuất, 50% còn lại phải tự in tem dán.

## Lịch sử

Phiên bản v1 (`git tag v1-prototype`) là prototype UI không chạy được:
`index.html` là file wireframe đổi tên, dữ liệu nằm trong localStorage,
luồng bán hàng không hoạt động, RLS mở toàn bộ bằng `USING (true)`.
**Không migrate bất cứ thứ gì từ v1 ngoài design tokens.**

## Triết lý sản phẩm

Chủ cửa hàng đã dựng ERPNext + POS Awesome trên Docker và **từ bỏ vì quá phức tạp**.
Mục tiêu của hệ thống này:

> Lấy **kỷ luật dữ liệu** của ERPNext. Không lấy giao diện, quy trình hay độ phủ tính năng.

Mỗi khi định thêm một trường, một bước xác nhận hay một màn hình, hỏi:
*người nhà đứng bán hàng có thật sự cần cái này không?* Không chắc thì **bỏ**.

## Năm kỷ luật dữ liệu — không được vi phạm

1. **Mọi số lượng lưu ở đơn vị gốc.** Chục/thùng/hộp chỉ là hệ số quy đổi khi nhập và hiển thị.
2. **`stock_ledger` chỉ ghi thêm.** Tồn kho = tổng cộng dồn từ ledger.
   Sai thì lập phiếu điều chỉnh, không bao giờ ghi đè.
3. **Chứng từ đã chốt là bất biến.** Sửa đơn = huỷ đơn cũ + tạo đơn mới, có dấu vết.
4. **Giá nằm ở bảng giá**, không nằm ở sản phẩm.
5. **Postgres là nguồn sự thật duy nhất.** IndexedDB chỉ là cache + hàng đợi.

## CÓ trong scope

- 2 cửa hàng: danh mục dùng chung, bảng giá / đơn hàng / tồn kho / doanh thu riêng
- Sản phẩm có biến thể màu, quy đổi đơn vị (cái/chục/thùng/hộp/bộ)
- Bán lẻ & bán sỉ, treo đơn, in bill nhiệt 80mm
- Mở ca / đóng ca, tổng kết cuối ngày
- Nhập kho, công nợ nhà cung cấp
- Công nợ khách sỉ **có đối trừ theo từng hoá đơn** + phiếu thu
- Trả hàng (nguyên vẹn / nứt vỡ)
- Kiểm kê & nhập tồn đầu kỳ bằng đầu quét + import Excel
- Báo cáo tổng kết, xuất PDF & Excel
- In tem QR cho mặt hàng không có mã nhà sản xuất
- Bán hàng offline (mỗi cửa hàng 1 máy nên không có xung đột)

## KHÔNG trong scope — không tự ý thêm

| Không làm | Lý do |
|---|---|
| Giá vốn, MAC, COGS, lãi gộp, báo cáo lợi nhuận | Chủ cửa hàng **cố ý** loại bỏ |
| Phân bổ chi phí vận chuyển | Hệ quả của trên |
| Kế toán: bút toán kép, tài khoản, P&L, cân đối | Ngoài nhu cầu |
| Chuyển kho, kho tổng, nhiều kho trong một cửa hàng | Hai cửa hàng không chuyển hàng cho nhau |
| Thuế VAT, hoá đơn điện tử | Ngoài nhu cầu |
| Lô hàng, hạn sử dụng, serial | Hàng gia dụng không cần |
| Workflow phê duyệt nhiều cấp | Chỉ 2 người dùng |
| Cơ chế chống tranh chấp bán song song | Mỗi cửa hàng 1 máy |
| Loyalty, khuyến mãi phức tạp, combo | Ngoài nhu cầu |
| Phân quyền chi tiết nhiều vai trò | Chỉ cần `owner` và `staff` |

## Quy tắc giá vốn — dễ hiểu nhầm nhất, đọc kỹ

**LƯU** `unit_cost` trên `inbound_items` và `stock_ledger`.
Bắt buộc — nếu không lưu, sau này không dựng lại được lịch sử.

**KHÔNG TÍNH và KHÔNG HIỂN THỊ** bất cứ thứ gì phái sinh:
- không cột `avg_cost` trên sản phẩm
- không cột "vốn BQ" ở màn tồn kho
- không dòng "lãi gộp" ở màn bán hàng
- không báo cáo lợi nhuận

Đơn giá nhập chỉ xuất hiện ở đúng 2 nơi: **phiếu nhập** và **sổ kho**.

Kiểm tra: không được có từ khoá `valuation`, `avg_cost`, `cogs`, `gross_profit` trong `src/`.
