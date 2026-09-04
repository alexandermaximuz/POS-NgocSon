# Phase 3 — Danh mục (sản phẩm, biến thể, bảng giá, đối tác)

**Branch:** `phase-3-master-data`
**Phụ thuộc:** Phase 2
**Đọc kèm:** `01-du-lieu.md` mục 4–5, `04-erpnext-mapping.md`

## Mục tiêu

Quản lý được toàn bộ dữ liệu gốc, và import được từ Excel hiện có.

## Việc cần làm

### 1. Nhóm hàng
Cây phân cấp, thêm/sửa/xoá (không xoá được nhóm còn sản phẩm). Chỉ `owner`.

### 2. Sản phẩm
- Danh sách: phân trang server-side, lọc theo nhóm, lọc theo trạng thái,
  tìm kiếm bỏ dấu (`gõ "thau duy thanh"` ra `Thau nhựa Duy Thành`)
- Form thêm/sửa: mã, tên, nhóm, đơn vị gốc, thương hiệu, NCC mặc định, tồn tối thiểu
- **Đơn vị quy đổi:** bảng con, thêm dòng `(đơn vị, hệ số)`.
  Đơn vị gốc luôn có hệ số 1 và không xoá được
- **Biến thể:** bảng con, mỗi dòng có mã biến thể + màu.
  Tự tạo 1 biến thể mặc định nếu người dùng không khai màu nào
- **Mã vạch:** mỗi biến thể có thể có nhiều mã, đánh dấu `manufacturer` hoặc `internal`.
  Có nút "Sinh mã nội bộ" tạo mã theo quy tắc cố định

### 3. Bảng giá
- Mỗi cửa hàng 2 bảng: Giá lẻ, Giá sỉ
- Màn hình dạng bảng: cột `Sản phẩm | Giá lẻ CH1 | Giá sỉ CH1 | Giá lẻ CH2 | Giá sỉ CH2`
  cho `owner`; `staff` chỉ xem, chỉ cửa hàng mình
- Sửa giá → tạo dòng `price_list_items` mới với `effective_from`, không update dòng cũ
- Hiển thị kèm giá theo đơn vị lớn: `40.000/cái · 400.000/chục · 480.000/thùng`

### 4. Khách hàng & nhà cung cấp
CRUD theo `04-erpnext-mapping.md`. `staff` được thêm khách mới, không sửa/xoá khách cũ.

### 5. Import Excel — quan trọng

Chủ cửa hàng đang có sẵn **bảng giá** trong Excel. Cần import được.

- Tải file mẫu `.xlsx` để người dùng điền theo đúng cột
- Đọc file bằng SheetJS/ExcelJS ở client
- **Màn preview bắt buộc:** hiển thị từng dòng, đánh dấu
  hợp lệ / cảnh báo / lỗi, kèm lý do cụ thể theo từng dòng
- Chỉ import khi người dùng bấm xác nhận. Dòng lỗi bị bỏ qua, không chặn cả file
- Hai loại import: **sản phẩm + biến thể + đơn vị**, và **bảng giá**

## Ràng buộc

- Giá gắn ở `products`, **không** gắn ở `product_variants`
- Không thêm cột giá vốn vào form sản phẩm
- Không thêm các trường đã bị loại trong `04-erpnext-mapping.md`

## Acceptance criteria

- [ ] Tạo sản phẩm `TH40` với 3 màu (Xanh/Đỏ/Lá mạ), đơn vị Cái/Chục(10)/Thùng(12),
      giá lẻ CH1 = 40.000/cái
- [ ] Màn bán hàng (tạm) hiển thị đúng **480.000/thùng** cho cả 3 màu
- [ ] Đặt giá lẻ CH2 = 42.000 → CH1 không đổi
- [ ] Gõ `thau duy thanh` (không dấu) tìm ra `Thau nhựa Duy Thành 40cm`
- [ ] Tạo sản phẩm không khai màu → tự có 1 biến thể mặc định
- [ ] Thêm 2 mã vạch cho một biến thể, cả 2 đều tra ra đúng biến thể đó
- [ ] Import file Excel 100 dòng có 5 dòng sai → preview chỉ đúng 5 dòng sai kèm lý do,
      import 95 dòng còn lại thành công
- [ ] `staff` không mở được màn Bảng giá của cửa hàng khác
- [ ] `pnpm verify` xanh
