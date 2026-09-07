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
- **`/bang-gia` chỉ `owner` truy cập được**, chặn ở tầng route bằng `requireOwner()`
  như đã chốt và kiểm chứng ở Phase 2. Đây là màn quản trị: có sửa giá và import.
  Bản trước của file này ghi "`staff` chỉ xem, chỉ cửa hàng mình" — mâu thuẫn với
  phase-2.md và đã bỏ. `staff` tra giá ở màn **chi tiết sản phẩm**, nơi vẫn hiện
  đúng giá theo đơn vị của cửa hàng đang chọn
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

**Định dạng file mẫu — chốt khi lập kế hoạch Phase 3:**

- Sản phẩm: **1 dòng = 1 sản phẩm**. Cột: `mã | tên | mã nhóm | mã ĐV gốc | thương hiệu |
  mã NCC | tồn tối thiểu | màu | ĐV lớn 1 | hệ số 1 | ĐV lớn 2 | hệ số 2`.
  Ô `màu` chứa nhiều màu ngăn bằng `|` (`Xanh dương|Đỏ|Trắng`); mã biến thể tự sinh
  `SKU-<viết tắt màu bỏ dấu>` (`TH40-XD`), trùng viết tắt thì đánh số
- **Mã vạch không nằm trong file import.** Thêm sau bằng đầu quét hoặc nút "Sinh mã nội bộ"
- Bảng giá: 1 dòng = 1 sản phẩm, cột `mã | giá lẻ CH1 | giá sỉ CH1 | giá lẻ CH2 | giá sỉ CH2`.
  Giá bằng giá đang hiệu lực thì không ghi dòng mới
- **Import chỉ THÊM MỚI.** Mã sản phẩm đã tồn tại → preview đánh dấu cảnh báo, bỏ qua,
  không ghi đè. Sửa sản phẩm cũ thì vào form. Một file Excel không được có đường nào
  ghi đè âm thầm cả danh mục

### 6. Mã vạch nội bộ

Quy tắc cố định: `NS` + 8 chữ số tuần tự (`NS00100000`), in bằng Code128. Sinh bằng
`rpc_add_internal_barcode` để hai lần bấm nhanh không ra hai lần cùng số.

## Ràng buộc

- Giá gắn ở `products`, **không** gắn ở `product_variants`
- Không thêm cột giá vốn vào form sản phẩm
- Không thêm các trường đã bị loại trong `04-erpnext-mapping.md`

## Acceptance criteria

- [ ] Tạo sản phẩm 3 màu (Xanh/Đỏ/Lá mạ), đơn vị Cái/Chục(10)/Thùng(12),
      giá lẻ CH1 = 40.000/cái
- [ ] **Trang chi tiết sản phẩm** hiển thị `40.000/cái · 400.000/chục · 480.000/thùng`,
      đúng cho cả 3 biến thể màu
- [ ] `pnpm test:schema` khẳng định bằng số: `TH40`, giá lẻ CH1 = 40.000, hệ số Thùng = 12
      → 480.000, đúng cho cả 3 biến thể. Không phụ thuộc vào việc có ai mở màn hình lên xem
- [ ] Đặt giá lẻ CH2 = 42.000 → CH1 không đổi
- [ ] Gõ `thau duy thanh` (không dấu) tìm ra `Thau nhựa Duy Thành 40cm`
- [ ] Tạo sản phẩm không khai màu → tự có 1 biến thể mặc định
- [ ] Thêm 2 mã vạch cho một biến thể, cả 2 đều tra ra đúng biến thể đó
- [ ] Import file Excel 100 dòng có 5 dòng sai → preview chỉ đúng 5 dòng sai kèm lý do,
      import 95 dòng còn lại thành công
- [ ] `staff` mở được màn chi tiết sản phẩm, thấy đúng giá cửa hàng mình,
      **không** thấy nút sửa; gõ thẳng `/bang-gia` vẫn bị chặn ở tầng route
- [ ] `pnpm verify` xanh
