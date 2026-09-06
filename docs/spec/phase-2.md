# Phase 2 — Đăng nhập, ca làm việc, khung ứng dụng

**Branch:** `phase-2-auth-shell`
**Phụ thuộc:** Phase 1
**Đọc kèm:** `02-phan-quyen.md`

## Mục tiêu

Người dùng đăng nhập được, chọn cửa hàng, mở ca, và thấy khung ứng dụng hoàn chỉnh.

## Việc cần làm

### 1. Xác thực

- Supabase Auth email + password (`@supabase/ssr`)
- **Cả `owner` và `staff` đều dùng email + password.** Không có cơ chế đăng nhập
  thứ hai — không PIN, không OAuth, không magic link. Người bán là người nhà và RLS
  phục vụ tách dữ liệu giữa 2 cửa hàng, không phải chống người dùng nội bộ
  (02-phan-quyen.md §2)
- `src/lib/supabase/{client,server,middleware}.ts`
- `src/proxy.ts` bảo vệ toàn bộ `(app)/*`, chưa đăng nhập → `/login?next=<đường dẫn>`.
  Next 16 đổi tên quy ước `middleware.ts` → `proxy.ts`; tên cũ vẫn chạy nhưng in
  cảnh báo deprecated
- Proxy **chỉ** làm hai việc: làm mới token và chặn người chưa đăng nhập. Không đọc
  `store_members`, không kiểm tra ca — nó chạy trên Edge cho mọi request
- Trang `/login`: form email + password, hiển thị lỗi tiếng Việt rõ ràng

### 2. Chọn cửa hàng

- `owner` thuộc 2 cửa hàng → màn chọn cửa hàng sau khi đăng nhập
- `staff` chỉ 1 cửa hàng → vào thẳng, cookie bị bỏ qua hoàn toàn
- Cookie `ns_store`: **httpOnly**, `sameSite=lax`, đổi được từ topbar (chỉ `owner`)
- Cookie **không bao giờ được tin**. Mỗi request đọc lại `store_members` và đối
  chiếu; cookie trỏ tới cửa hàng không thuộc quyền thì bị bỏ qua như thể không có
- `src/lib/auth/session.ts` là nơi **duy nhất** đọc/ghi cookie này. Không component
  hay route nào khác được đọc `document.cookie` hay tự truy vấn `store_members`
- Đổi cửa hàng kết thúc bằng `redirect()`, không phải `router.refresh()` — refresh
  là bất đồng bộ, sẽ có khoảnh khắc hiện số liệu cửa hàng cũ dưới tên cửa hàng mới
- Mọi query đều lọc theo cửa hàng đang chọn

### 3. Ca làm việc

- Migration mới `0014_shift_rpc.sql`: `rpc_open_shift`, `rpc_close_shift`,
  `rpc_cash_txn`, `rpc_current_shift`, và `fn_shift_expected_cash` (nội bộ, revoke
  execute với `authenticated`). Xem 03-rpc.md
- **Mỗi cửa hàng chỉ một ca `open`** (`ux_cash_shifts_one_open_store`), không phải
  mỗi người một ca
- Chặn chưa mở ca ở **layout của `/ban-hang`**, không ở proxy. Đặt ở layout của
  segment nên mọi route con thêm sau này tự động nằm sau cửa chặn. Redirect mang
  theo `?next=` để mở ca xong quay lại đúng chỗ
- Màn mở ca: nhập tiền đầu ca (`opening_float`)
- Màn đóng ca: hiển thị tiền mặt dự kiến (từ server), nhập tiền thực đếm,
  hiện chênh lệch **ngay khi gõ**, xác nhận đóng
- Phiếu thu/chi tiền mặt ngoài bán hàng (`cash_transactions`): nút "Thu khác"/"Chi khác".
  Client sinh `client_uuid` một lần mỗi lần mở hộp thoại — bấm đúp không được tạo hai phiếu

### 4. Khung ứng dụng

- Sidebar: Bán hàng · Nhập kho · Tồn kho · Công nợ · Trả hàng · Sản phẩm ·
  Bảng giá · Khách hàng · Nhà cung cấp · Báo cáo · Cài đặt
  (menu ẩn theo vai trò: `staff` không thấy Bảng giá, Cài đặt)
- Topbar: tên cửa hàng đang chọn · ca đang mở + người trực · tiền két hiện tại ·
  badge trạng thái đồng bộ (Phase 10 mới có logic, giờ để tĩnh "Đã kết nối")
- Bám design tokens trong `src/styles/tokens.css`. Tông teal `#008282` / `#033a3a`
- Tối ưu 1366×768

## Ràng buộc

- **Không có đăng nhập bằng PIN, OAuth hay magic link.** Đã chốt dứt điểm khi lập
  kế hoạch Phase 2: một đường đăng nhập duy nhất cho cả hai vai trò. PIN sẽ kéo theo
  cột `pin_hash`, RPC xác thực, và một cơ chế cấp session Supabase bằng
  `service_role` — một bề mặt bảo mật mới cho một vấn đề không tồn tại
- Không hardcode số tiền két, doanh thu trên topbar. Chưa có dữ liệu thì hiện `0`
  hoặc empty state
- Badge đồng bộ để tĩnh "Đã kết nối". Ba trạng thái thật đọc từ outbox là Phase 10 —
  trước khi có outbox thì mọi nhãn động đều là nhãn bịa

## Acceptance criteria

- [x] Chưa đăng nhập, mở `/ban-hang` → chuyển về `/login?next=%2Fban-hang`
- [x] `staff` cửa hàng A đăng nhập → không có tuỳ chọn đổi sang cửa hàng B
      (topbar render `<span>` chứ không phải nút khi chỉ có 1 membership)
- [x] `owner` đổi được cửa hàng, và số liệu trên màn hình đổi theo
      (CH2 két 1.111.111 ↔ CH1 "Chưa mở ca")
- [x] Chưa mở ca → **không** vào được `/ban-hang`, bị đưa sang `/ca/mo?next=%2Fban-hang`
- [x] Mở ca 5.000.000đ, thêm phiếu chi 200.000đ, đóng ca đếm 4.800.000đ
      → chênh lệch hiển thị **0đ**
- [x] Đóng ca xong không mở lại được ca cũ (`SHIFT_NOT_OPEN`, chặn bằng
      `where status='open'` trong chính câu UPDATE)
- [x] `staff` không thấy menu Bảng giá và Cài đặt, **và** gõ thẳng `/bang-gia`
      hay `/cai-dat` cũng bị chặn ở tầng route
- [x] `pnpm verify` xanh
- [x] `pnpm test:schema` 10 pass · `pnpm test:rls` 28 pass (thêm mục 8 cho ca làm việc)

## Lệch so với kế hoạch ban đầu

Ba lỗi trong spec được phát hiện khi rà soát schema và đã sửa vào tài liệu gốc:

1. **Công thức `expected_cash` đếm tiền hai lần** — 03-rpc.md và 01-du-lieu.md ghi
   năm số hạng, trong đó có "thu nợ tiền mặt trong ca". `receipts` không có
   `shift_id`, và `rpc_create_receipt` đã ghi `cash_transactions`. Còn bốn số hạng
2. **`orders.shift_id` đóng băng lúc treo đơn** — `rpc_pos_checkout` (Phase 5) phải
   re-stamp khi `held` → `paid`, nếu không tiền của đơn treo qua đêm không vào ca nào
3. **`cash_transactions` thiếu `client_uuid`** — chứng từ duy nhất không có, trong khi
   `orders`/`receipts`/`returns` đều có. Vá ở `0014` cùng `source_type`/`source_id`

Ngoài ra: `pg_default_acl` của schema `public` **rỗng** trên database dev, nên
`alter default privileges` ở `0013:326` không còn hiệu lực — hàm mới tạo trong
`public` mặc định `anon` gọi được. `0014` đặt lại quyền mặc định **và** revoke/grant
tường minh cho từng hàm. Đã kiểm chứng bằng transaction rollback.

`supabase/seed.sql` cũng được vá: nó không backfill `public.profiles` cho user tạo
trước lần `drop schema public cascade` gần nhất, nên `profiles` rỗng và mọi chỗ hiển
thị tên người dùng rơi về NULL.
