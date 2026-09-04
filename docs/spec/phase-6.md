# Phase 6 — Nhập kho & công nợ nhà cung cấp

**Branch:** `phase-6-inbound`
**Phụ thuộc:** Phase 5
**Đọc kèm:** `01-du-lieu.md` mục 9, `03-rpc.md`

## Mục tiêu

Nhập hàng vào kho và theo dõi tiền còn nợ nhà cung cấp.

## Việc cần làm

### 1. Phiếu nhập
- Chọn nhà cung cấp, ngày nhập
- Thêm dòng: tìm sản phẩm → chọn biến thể → chọn đơn vị → SL → **đơn giá nhập**
- Quét mã vạch để thêm dòng nhanh
- `unit_cost_base = unit_cost_input / factor`, tính và hiển thị để người dùng đối chiếu
- Tổng tiền, số đã trả, số còn nợ
- Lưu phiếu → `rpc_receive_inbound` → tồn kho tăng ngay

### 2. Công nợ nhà cung cấp
- Danh sách NCC kèm **tổng còn phải trả**
- Chi tiết một NCC: danh sách phiếu nhập, trạng thái thanh toán từng phiếu
- **Phiếu chi:** chọn NCC → danh sách phiếu nhập chưa trả hết (cũ nhất trước) →
  tích chọn → nhập số tiền → phân bổ tự động hoặc sửa tay
- Báo cáo tuổi nợ NCC

### 3. Liên kết sang in tem
Sau khi lưu phiếu nhập, nút "In tem cho hàng vừa nhập" — nạp thẳng danh sách
sang màn in tem (Phase 10 mới có màn đó; giai đoạn này chỉ để nút disabled kèm ghi chú).

## Ràng buộc

- **Không** tính giá vốn bình quân. **Không** phân bổ chi phí vận chuyển.
  `unit_cost` chỉ được ghi vào `stock_ledger` và dừng ở đó
- Không có quy trình đặt hàng (Purchase Order) — nhập trực tiếp
- Phiếu nhập đã lưu không sửa được; sai thì huỷ phiếu (sinh ledger đảo chiều) và nhập lại

## Acceptance criteria

- [ ] Nhập 5 thùng `TH40-XD` (1 thùng = 12 cái) giá 360.000/thùng
      → tồn tăng đúng **60 cái**, `stock_ledger.unit_cost` = **30.000**
- [ ] Tổng phiếu 1.800.000, trả trước 1.000.000 → nợ NCC tăng đúng **800.000**
- [ ] Phiếu chi 500.000 phân bổ vào phiếu đó → còn nợ **300.000**,
      `payment_status = 'partial'`
- [ ] Phân bổ vượt số còn nợ → bị chặn với thông báo rõ
- [ ] Tổng nợ NCC trên màn danh sách = `SUM(inbound_receipts.debt_amount)`
- [ ] Nhập ở cửa hàng A không làm đổi tồn cửa hàng B
- [ ] Không có chỗ nào trong giao diện hiển thị "giá vốn bình quân"
- [ ] `pnpm verify` xanh
