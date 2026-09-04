# 05 — Quy ước giao diện

## Nguyên tắc

Người dùng là chủ cửa hàng và người nhà, đứng bán tại quầy. Ưu tiên **tốc độ thao tác**
hơn vẻ đẹp. Giữ bố cục 3 vùng của màn bán hàng trong v1 (danh sách hàng bên trái,
thanh toán bên phải) — bố cục đó đã hợp lý.

## Design tokens

Dùng `src/styles/tokens.css` (bộ token CRM 3S, hệ màu oklch, kiến trúc `--ink-*`,
`--surface-*`, `--outline-*`). Map vào Tailwind v4 bằng `@theme`.

- **Không hardcode mã màu** trong component
- Màu chủ đạo giữ như v1: teal `#008282`, nền tối `#033a3a`
- Font Inter

## Kích thước & tương tác

- Tối ưu **1366×768** trở lên (màn hình máy tính ở quầy)
- Vùng bấm ≥ **44px** — có thể dùng màn cảm ứng
- Không dùng hover-only để truy cập chức năng
- Màn kiểm kê (Phase 4) phải chạy được trên điện thoại, rộng tối thiểu **390px**

## Phím tắt

| Phím | Chức năng |
|---|---|
| `F1` | Đưa con trỏ về ô tìm hàng |
| `F4` | Đổi đơn vị tính dòng đang chọn |
| `F9` | Mở thanh toán |
| `Enter` | Thêm hàng đang chọn vào giỏ |
| `↑` `↓` | Di chuyển trong danh sách gợi ý / dòng giỏ hàng |
| `Esc` | Đóng modal đang mở |

Toàn bộ luồng bán hàng phải thao tác được **hoàn toàn bằng bàn phím**, không cần chuột.

## Ngôn ngữ & định dạng

- Tiếng Việt cho mọi text hiển thị
- Tiền: `1.234.567` (dấu chấm ngăn nghìn). **Không** hiển thị ký tự `đ` bên trong ô nhập số
- Ngày: `dd/MM/yyyy`. Giờ: `HH:mm`. Múi giờ `Asia/Ho_Chi_Minh`
- Số lượng: bỏ số 0 thừa sau dấu thập phân (`5` chứ không phải `5,000`)
- Tồn kho hiển thị kèm quy đổi: `142 cái (11 thùng + 10)`

## Bốn trạng thái bắt buộc

**Mọi** màn hình có dữ liệu phải xử lý đủ:

1. **Loading** — skeleton, không phải spinner toàn trang
2. **Empty** — nói rõ chưa có gì và bước tiếp theo là gì
   ("Chưa có sản phẩm nào. Thêm sản phẩm đầu tiên" + nút)
3. **Error** — thông báo tiếng Việt dễ hiểu + nút thử lại.
   Không hiện stack trace hay mã lỗi Postgres thô
4. **Có dữ liệu**

**Không bao giờ** hiển thị số minh hoạ khi chưa có dữ liệu.
(v1 ghi "1.847 mã hàng" trong khi chỉ có 10 — không lặp lại.)

## Thông báo lỗi nghiệp vụ

Dịch mã lỗi từ RPC sang tiếng Việt có ngữ cảnh:

| Mã lỗi | Hiển thị |
|---|---|
| `INSUFFICIENT_STOCK` | `Không đủ hàng: Thau nhựa 40cm Xanh chỉ còn 12 cái` |
| `SHIFT_NOT_OPEN` | `Chưa mở ca. Vào Cài đặt → Mở ca để bắt đầu bán hàng` |
| `DEBT_REQUIRES_CUSTOMER` | `Ghi nợ phải chọn khách hàng cụ thể` |
| `ALLOCATION_MISMATCH` | `Tổng phân bổ chưa bằng số tiền thu. Còn lại: 100.000` |
| `RETURN_EXCEEDS_SOLD` | `Trả vượt số đã bán. Đơn này còn trả được tối đa 4 cái` |

## In ấn

Route riêng, layout độc lập, không dùng `@media print` toàn cục như v1.

| Loại | Route | Khổ |
|---|---|---|
| Bill bán hàng | `/print/bill/[orderId]` | `@page { size: 80mm auto; margin: 0 }` |
| Phiếu thu | `/print/phieu-thu/[receiptId]` | 80mm |
| Tem nhỏ | `/print/tem?size=small` | 35×22mm |
| Tem vừa | `/print/tem?size=medium` | 50×30mm |
| Báo cáo | Xuất PDF/Excel, không in trực tiếp | A4 |

## Thanh trạng thái (topbar)

Luôn hiển thị: cửa hàng đang chọn · ca làm việc + người bán · tiền két hiện tại ·
badge đồng bộ.

Badge đồng bộ có **3 trạng thái thật**, đọc từ hàng đợi outbox:
`Đã đồng bộ` / `Chờ N đơn` / `Mất kết nối`.
Không phải nhãn cố định như badge "Offline (Local)" của v1.

## Điều hướng

Sidebar: Bán hàng · Nhập kho · Tồn kho · Công nợ · Trả hàng · Sản phẩm · Bảng giá ·
Khách hàng · Nhà cung cấp · Báo cáo · Cài đặt.

`staff` không thấy mục nào vượt quyền. Ẩn menu **và** chặn ở tầng route,
không chỉ ẩn giao diện.
