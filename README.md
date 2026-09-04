# POS Ngọc Sơn

Hệ thống bán hàng cho 2 cửa hàng đồ gia dụng. Xem `CLAUDE.md` và `docs/spec/`
để biết triết lý sản phẩm và đặc tả đầy đủ.

## Trạng thái hiện tại — Phase 0

Mới có bộ khung Next.js chạy được. **Chưa có** đăng nhập thật, chưa kết nối
Supabase, chưa có nghiệp vụ bán hàng nào.

- `pnpm dev` chạy, mở `/` sẽ redirect sang `/login` (trang trống, chưa có logic)
- Design tokens của thương hiệu đã map vào Tailwind v4 + shadcn/ui

## Bắt đầu

```bash
pnpm install
pnpm dev
```

Mở [http://localhost:3000](http://localhost:3000).

Copy `.env.example` thành `.env.local` và điền giá trị Supabase khi dự án
kết nối Supabase (chưa cần ở Phase 0).

## Lệnh

```bash
pnpm dev       # chạy local
pnpm verify    # typecheck + lint + build — chạy trước khi commit
```
