# Phase 10 — Tem QR & bán hàng offline

**Branch:** `phase-10-labels-offline`
**Phụ thuộc:** Phase 9

## Mục tiêu

In tem cho hàng không có mã nhà sản xuất, và bán được khi rớt mạng.

## Phần A — In tem QR

Khoảng 50% mặt hàng không có mã vạch nhà sản xuất, phải tự in tem dán.

- Hai khổ tem nhiệt: **35×22mm** và **50×30mm**
- Nội dung tem: mã QR (chứa `barcode` của biến thể), tên hàng rút gọn, màu,
  giá bán theo đơn vị gốc
- Chọn số lượng tem cần in cho từng biến thể
- **In hàng loạt từ phiếu nhập** — nút "In tem cho hàng vừa nhập" ở Phase 6
- Xem trước trực quan trước khi in
- Route `/print/tem`, `@page` đặt đúng khổ, xếp nhiều tem trên một trang

## Phần B — Bán hàng offline

Chợ hay rớt mạng. Nhưng mỗi cửa hàng chỉ 1 máy nên **không có xung đột** —
giữ cơ chế ở mức tối thiểu.

### Cache (Dexie / IndexedDB)
- `cache_products`, `cache_variants`, `cache_barcodes`, `cache_prices`, `cache_customers`
- Kèm `synced_at`, làm mới khi online

### Hàng đợi
```
outbox (id, client_uuid, rpc_name, payload, status, attempts, last_error, created_at)
        status ∈ ('pending','sending','failed')
```

### Luồng
1. Bán offline: sinh `client_uuid` bằng `crypto.randomUUID()` → ghi `outbox` →
   in bill ngay với nhãn **"Chờ đồng bộ"**, không hiện số HĐ chính thức
2. Có mạng: gửi tuần tự theo `created_at`, exponential backoff, tối đa 5 lần.
   Server dedupe bằng `client_uuid` → gửi lại nhiều lần vẫn an toàn
3. Nhận response → cập nhật `order_no` thật, đổi nhãn thành "Đã đồng bộ"
4. Lỗi `INSUFFICIENT_STOCK` khi sync → đơn vào trạng thái **"Cần xử lý"**,
   hiện badge trên topbar. **Không tự huỷ, không tự ghi đè** — chủ shop quyết định
5. Badge kết nối trên topbar có 3 trạng thái thật:
   `Đã đồng bộ` / `Chờ N đơn` / `Mất kết nối`

### Giới hạn
Offline **chỉ** cho phép **bán hàng** và **treo đơn**.
Nhập kho, đổi giá, thu tiền nợ, kiểm kê, đóng ca **bắt buộc online** —
hiện thông báo rõ khi mất mạng.

Thêm Service Worker cache app shell để mở được app khi offline.

## Acceptance criteria

- [ ] In tem 35×22mm và 50×30mm, quét lại bằng đầu quét ra đúng biến thể
- [ ] In hàng loạt 20 tem từ một phiếu nhập, xếp đúng trang
- [ ] Tắt mạng (DevTools offline) → bán 3 đơn thành công, bill in ra ghi "Chờ đồng bộ"
- [ ] Bật mạng → đúng **3 đơn** lên server, có số HĐ thật
- [ ] Bấm đồng bộ lại 5 lần → vẫn chỉ **3 đơn**, không nhân bản
- [ ] Offline mở màn Nhập kho → hiện thông báo cần kết nối, không cho nhập
- [ ] Đơn sync lỗi vì thiếu tồn → vào "Cần xử lý", có badge, không tự huỷ
- [ ] `pnpm verify` xanh
