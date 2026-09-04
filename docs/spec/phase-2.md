# Phase 2 — Đăng nhập, ca làm việc, khung ứng dụng

**Branch:** `phase-2-auth-shell`
**Phụ thuộc:** Phase 1
**Đọc kèm:** `02-phan-quyen.md`

## Mục tiêu

Người dùng đăng nhập được, chọn cửa hàng, mở ca, và thấy khung ứng dụng hoàn chỉnh.

## Việc cần làm

### 1. Xác thực

- Supabase Auth email + password (`@supabase/ssr`)
- `src/lib/supabase/{client,server,middleware}.ts`
- Middleware bảo vệ toàn bộ `(app)/*`, chưa đăng nhập → `/login`
- Trang `/login`: form email + password, hiển thị lỗi tiếng Việt rõ ràng

### 2. Chọn cửa hàng

- `owner` thuộc 2 cửa hàng → màn chọn cửa hàng sau khi đăng nhập
- `staff` chỉ 1 cửa hàng → vào thẳng
- Cửa hàng đang chọn lưu trong cookie, đổi được từ topbar (chỉ `owner`)
- Mọi query đều lọc theo cửa hàng đang chọn

### 3. Ca làm việc

- Chưa có ca `open` → chặn vào `/ban-hang`, chuyển sang màn mở ca
- Màn mở ca: nhập tiền đầu ca (`opening_float`)
- Màn đóng ca: hiển thị tiền mặt dự kiến (từ server), nhập tiền thực đếm,
  hiện chênh lệch, xác nhận đóng
- Phiếu thu/chi tiền mặt ngoài bán hàng (`cash_transactions`): nút "Thu khác"/"Chi khác"

### 4. Khung ứng dụng

- Sidebar: Bán hàng · Nhập kho · Tồn kho · Công nợ · Trả hàng · Sản phẩm ·
  Bảng giá · Khách hàng · Nhà cung cấp · Báo cáo · Cài đặt
  (menu ẩn theo vai trò: `staff` không thấy Bảng giá, Cài đặt)
- Topbar: tên cửa hàng đang chọn · ca đang mở + người trực · tiền két hiện tại ·
  badge trạng thái đồng bộ (Phase 10 mới có logic, giờ để tĩnh "Đã kết nối")
- Bám design tokens trong `src/styles/tokens.css`. Tông teal `#008282` / `#033a3a`
- Tối ưu 1366×768

## Ràng buộc

- Không tự thêm đăng nhập bằng PIN, OAuth, hay magic link — chưa cần
- Không hardcode số tiền két, doanh thu trên topbar. Chưa có dữ liệu thì hiện `0`
  hoặc empty state

## Acceptance criteria

- [ ] Chưa đăng nhập, mở `/ban-hang` → chuyển về `/login`
- [ ] `staff` cửa hàng A đăng nhập → không có tuỳ chọn đổi sang cửa hàng B
- [ ] `owner` đổi được cửa hàng, và số liệu trên màn hình đổi theo
- [ ] Chưa mở ca → **không** vào được `/ban-hang`
- [ ] Mở ca 5.000.000đ, thêm phiếu chi 200.000đ, đóng ca đếm 4.800.000đ
      → chênh lệch hiển thị **0đ**
- [ ] Đóng ca xong không mở lại được ca cũ
- [ ] `staff` không thấy menu Bảng giá và Cài đặt
- [ ] `pnpm verify` xanh
