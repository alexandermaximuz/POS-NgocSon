# Phase 4 — Tồn đầu kỳ & kiểm kê

**Branch:** `phase-4-stocktake`
**Phụ thuộc:** Phase 3
**Đọc kèm:** `01-du-lieu.md` mục 6 & 11, `03-rpc.md`

## Mục tiêu

Đưa được tồn kho thực tế của hơn 2.000 biến thể vào hệ thống.

> ⚠️ **Đây là rủi ro lớn nhất của cả dự án, và phần lớn không phải việc lập trình.**
>
> Excel hiện tại chỉ theo dõi công nợ và bảng giá, **không theo dõi tồn kho**.
> Ngày đầu chạy hệ thống, tồn của mọi biến thể đều bằng 0 và không có nguồn nào
> để nhập vào. Phải đi đếm thật trên kệ.
>
> Vì vậy phase này làm **sớm**, ngay sau danh mục, chứ không để cuối.

## Việc cần làm

### 1. Phiếu kiểm kê
- Tạo phiếu, chọn `kind` = Tồn đầu kỳ / Kiểm kê định kỳ
- Chọn **nhóm hàng** để kiểm kê cuốn chiếu — không bắt làm cả kho một lần
- Phiếu `draft` lưu dở dang, đóng máy mở lại vẫn còn
- Chỉ sinh bút toán khi bấm "Chốt phiếu" (`rpc_submit_stock_take`)

### 2. Giao diện đếm bằng đầu quét
- **Phải chạy tốt trên điện thoại và máy tính bảng** — người đếm đi giữa các kệ
- Ô quét luôn giữ focus: quét mã → hiện tên hàng + màu → gõ số lượng → Enter → tự lưu dòng
- Quét lại mã đã có → cộng dồn, không tạo dòng trùng
- Hiển thị 5 dòng vừa đếm gần nhất để người dùng đối chiếu
- Nút nhập tay cho hàng không có mã vạch (tìm theo tên bỏ dấu)

### 3. Import Excel tồn đầu kỳ
- Cột: `mã biến thể | số lượng`
- Màn preview + validate từng dòng như Phase 3
- Mã không tồn tại → báo lỗi dòng đó, không chặn cả file

### 4. Chốt phiếu
- `kind = 'opening'` → `stock_ledger.ref_type = 'opening'`, `qty_base = counted_qty`
- `kind = 'periodic'` → `ref_type = 'adjust'`, `qty_base = diff`
- Hiển thị bảng đối chiếu trước khi chốt: hệ thống / thực đếm / chênh lệch

### 5. Báo cáo tiến độ
Theo nhóm hàng: đã đếm bao nhiêu biến thể / tổng bao nhiêu / còn lại bao nhiêu.
Cần thiết vì việc đếm kéo dài nhiều ngày.

## Ràng buộc

- Không dùng số lượng âm khi kiểm kê
- Phiếu đã `submitted` thì khoá, không sửa được
- Không tự động chốt phiếu — luôn cần người bấm xác nhận

## Acceptance criteria

- [ ] Tạo phiếu tồn đầu kỳ cho nhóm "Nhựa gia dụng", đếm 20 biến thể, thoát,
      mở lại vẫn còn nguyên 20 dòng
- [ ] Quét cùng một mã 3 lần với SL 5/3/2 → một dòng duy nhất, SL = 10
- [ ] Import file 500 dòng, trong đó 12 mã không tồn tại → preview báo đúng 12 dòng,
      import 488 dòng còn lại, tồn kho khớp file
- [ ] Chốt phiếu → `stock_balances` khớp `counted_qty` từng biến thể
- [ ] `SUM(stock_ledger.qty_base)` = `stock_balances.qty_base` cho mọi biến thể
- [ ] Phiếu đã chốt không sửa được
- [ ] Giao diện đếm dùng được trên màn hình rộng 390px (điện thoại)
- [ ] Kiểm kê định kỳ: hệ thống 100, đếm 97 → sinh ledger `adjust` = −3, tồn còn 97

## Ghi chú vận hành cho chủ dự án

- Làm **từng cửa hàng một**, không đồng thời
- Đếm cuốn chiếu theo nhóm hàng, vẫn bán bình thường trong lúc đếm
- Nhóm nào chốt xong thì từ đó trở đi hệ thống quản tồn nhóm ấy
- Ước lượng: khối lượng công việc này nhiều khả năng lớn hơn toàn bộ phần lập trình
