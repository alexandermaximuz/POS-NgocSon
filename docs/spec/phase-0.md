# Phase 0 — Dọn repo & khởi tạo dự án

**Branch:** `phase-0-scaffold`
**Phụ thuộc:** không

## Mục tiêu

Xoá sạch prototype v1, dựng bộ khung Next.js chạy được và deploy lên Vercel.

## Bối cảnh

Repo hiện chứa một prototype UI không chạy được: `index.html` (197 KB) chính là
file wireframe `POS Gia Dung - Wireframe.dc.html` đổi tên (md5 trùng khớp), chạy trên
runtime `x-dc` của `support.js`. Không có `package.json`, không build system.
Dữ liệu nằm trong localStorage. Luồng bán hàng không hoạt động.

**Không migrate bất cứ dòng code nào từ v1.**

## Việc cần làm

1. Xoá: `index.html`, `support.js`, `supabase-client.js`, `auth-manager.js`,
   `supabase-schema.sql`, `tailwind.config.js`, `.thumbnail`, mọi file `*.dc.html`
2. Giữ và di chuyển:
   - `crm3s-design-tokens.css` → `src/styles/tokens.css`
   - `crm3s-design-system.md` → `docs/design-system.md`
3. `create-next-app`: App Router, TypeScript, Tailwind v4, ESLint, pnpm, `src/` directory
4. Cài: `@supabase/supabase-js`, `@supabase/ssr`, `@tanstack/react-query`, `zustand`,
   `react-hook-form`, `zod`, `date-fns`
5. shadcn/ui init, map design tokens vào Tailwind v4 qua `@theme` trong `globals.css`
6. Prettier + Husky pre-commit chạy lint
7. Script trong `package.json`:
   ```json
   "verify": "tsc --noEmit && next lint && next build"
   ```
8. `vercel.json`, `.env.example`, `.gitignore` (phải có `.env*.local`)
9. Viết lại `README.md` — **chỉ mô tả những gì đã chạy được**.
   README cũ liệt kê 9 phân hệ chưa tồn tại; không lặp lại sai lầm đó.
10. Trang tạm `/login` trống (chưa cần logic), redirect `/` → `/login`

## Cấu trúc thư mục cần tạo

```
supabase/migrations/
src/app/(auth)/login/
src/app/(app)/
src/app/print/
src/components/{ui,pos}/
src/lib/{supabase,db,offline}/
src/hooks/
src/styles/tokens.css
e2e/
docs/spec/
```

## Ràng buộc

- Không cài thư viện nào ngoài danh sách trên trừ khi hỏi trước
- Không tạo file component rỗng "để dành" cho phase sau

## Acceptance criteria

- [ ] `pnpm verify` xanh, không warning
- [ ] `pnpm dev` chạy, mở `localhost:3000` thấy trang login trống
- [ ] Không còn file nào của v1 trong repo (`git ls-files | grep -c dc.html` = 0)
- [ ] `src/styles/tokens.css` tồn tại và được import trong `globals.css`
- [ ] `.env.local` **không** nằm trong git (`git ls-files | grep .env.local` rỗng)
- [ ] README không mô tả tính năng nào chưa tồn tại
- [ ] Deploy Vercel thành công, URL hiển thị trang login trống

## Sau phase này

Chủ dự án sẽ nối Vercel với Supabase integration. Đừng tự cấu hình biến môi trường
trên Vercel.
