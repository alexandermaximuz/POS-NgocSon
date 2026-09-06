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

## Xác nhận thao tác

Hai quy tắc dưới đây áp dụng cho **toàn hệ thống**, mọi phase, không riêng màn nào.

### 1. Ghi chứng từ thành công phải có thông báo

> Mọi thao tác **post chứng từ** thành công phải hiện thông báo xác nhận.

Không được chỉ đóng modal rồi cập nhật số liệu âm thầm. Người đứng bán không nhìn
chằm chằm vào topbar; họ bấm nút rồi nhìn sang khách. Thiếu thông báo thì không phân
biệt được "đã ghi xong" với "bấm hụt", và cách xử lý tự nhiên là **bấm lại** — đúng
thứ sinh ra chứng từ trùng.

Thông báo phải nêu **con số vừa ghi**, không phải câu chung chung:

| Không đủ | Đủ |
|---|---|
| "Thành công" | "Đã ghi phiếu chi 200.000. Tiền két: 4.800.000" |
| "Đã lưu" | "Đã mở ca. Tiền đầu ca 5.000.000" |
| "Hoàn tất" | "Đã tạo đơn HD-CH1-2026-00042. Tổng 1.250.000" |

Con số trong thông báo lấy từ **kết quả RPC trả về**, không phải từ giá trị người
dùng vừa gõ vào form — đó là cách duy nhất để thông báo chứng minh được server đã
thực sự ghi, chứ không chỉ nhắc lại điều client vừa nghĩ.

Dùng `sonner` qua `src/components/ui/sonner.tsx`, đặt ở `bottom-center`.

Áp dụng cho: mở ca, đóng ca, phiếu thu/chi, tạo đơn, nhập kho, thu tiền nợ, trả hàng,
chốt kiểm kê, sửa bảng giá, huỷ đơn.

### 2. Hành động không hoàn tác phải có bước xác nhận

> Mọi hành động **không hoàn tác được** hoặc **có hậu quả tài chính** phải có bước
> xác nhận trước khi thực hiện.

Hộp thoại xác nhận phải hiện **đúng những con số sẽ được ghi**, để người dùng đối
chiếu lần cuối — không phải một câu "Bạn có chắc không?" trống rỗng. Câu hỏi trống
rỗng bị bấm qua theo phản xạ sau ngày thứ hai, và lúc đó nó không còn bảo vệ ai.

Nút xác nhận cuối phải nói rõ việc gì sẽ xảy ra ("Đóng ca", "Huỷ đơn"), không phải
"OK". Nút huỷ đứng trước nút xác nhận.

Áp dụng cho:

| Hành động | Hộp thoại phải hiện |
|---|---|
| Đóng ca | Tiền dự kiến, tiền thực đếm, chênh lệch, và câu "đóng rồi không mở lại được" |
| Huỷ đơn | Số đơn, tổng tiền, và hàng sẽ được nhập trả lại kho |
| Xoá sản phẩm / khách / NCC | Tên bản ghi, và những gì sẽ mất theo |
| Chốt phiếu kiểm kê | Số dòng lệch và tổng chênh lệch |
| Sửa giá bảng giá | Giá cũ → giá mới |

**Không** áp dụng cho thao tác sửa lại được dễ dàng: thêm hàng vào giỏ, treo đơn,
đổi cửa hàng, phiếu thu/chi (sai thì lập phiếu ngược lại). Hỏi xác nhận ở những chỗ
đó chỉ làm chậm và làm nhờn phản xạ.

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
