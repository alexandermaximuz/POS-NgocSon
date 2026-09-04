# POS Ngọc Sơn — Hướng dẫn cho Claude Code

Hệ thống bán hàng cho **2 cửa hàng** đồ gia dụng (nhựa, nhôm, inox, thuỷ tinh) tại Việt Nam.
Người dùng: chủ cửa hàng và người nhà. Mỗi cửa hàng 1 máy.

**Spec đầy đủ ở `docs/spec/`. Đọc file spec của phase đang làm trước khi viết code.**

---

## Triết lý sản phẩm

Chủ cửa hàng đã thử ERPNext và từ bỏ vì quá phức tạp. Mục tiêu:

> Lấy **kỷ luật dữ liệu** của ERPNext. Không lấy giao diện, quy trình hay độ phủ tính năng.

Trước khi thêm bất kỳ trường, bước xác nhận hay màn hình nào, hỏi:
*người nhà đứng bán hàng có thật sự cần cái này không?* Không chắc thì **bỏ**.

---

## Stack

- Next.js 15 App Router · TypeScript strict
- Tailwind v4 + shadcn/ui · design tokens ở `src/styles/tokens.css`
- TanStack Query (server state) + Zustand (giỏ hàng)
- react-hook-form + zod
- Supabase: Postgres + Auth + RLS + RPC
- Dexie (offline cache + outbox) — chỉ cho bán hàng
- ExcelJS (xuất xlsx) · Deploy Vercel

---

## Năm kỷ luật dữ liệu — không được vi phạm

1. **Mọi số lượng lưu ở đơn vị gốc.** Chục/thùng/hộp chỉ là hệ số quy đổi khi nhập và hiển thị.
2. **`stock_ledger` chỉ ghi thêm.** Tồn kho = tổng cộng dồn từ ledger. Sai thì lập phiếu
   điều chỉnh, không bao giờ ghi đè.
3. **Chứng từ đã chốt là bất biến.** Sửa đơn = huỷ đơn cũ + tạo đơn mới, có dấu vết.
4. **Giá nằm ở bảng giá**, không nằm ở sản phẩm. Mỗi cửa hàng có bảng giá lẻ và sỉ riêng.
5. **Postgres là nguồn sự thật duy nhất.** IndexedDB chỉ là cache + hàng đợi.

---

## Ranh giới dữ liệu (sai chỗ này sửa rất đắt)

**Dùng chung, KHÔNG có `store_id`:**
`item_groups`, `uoms`, `products`, `product_uoms`, `product_variants`, `product_barcodes`,
`customers`, `suppliers`, `profiles`

**Riêng từng cửa hàng, CÓ `store_id`:**
`price_lists`, `price_list_items`, `stock_ledger`, `stock_balances`, `orders`, `order_items`,
`payments`, `inbound_receipts`, `inbound_items`, `returns`, `return_items`, `receipts`,
`receipt_allocations`, `cash_shifts`, `cash_transactions`, `stock_takes`, `stock_take_items`

## Mô hình sản phẩm

- **Kích thước là sản phẩm riêng** — `TH40` và `TH45` độc lập, giá khác nhau
- **Màu là biến thể** — `TH40-XD`, `TH40-D` cùng giá
- **Giá gắn ở `products` (mẫu)** · **Tồn kho và mã vạch gắn ở `product_variants`**
- Mọi sản phẩm có ít nhất 1 biến thể mặc định. `stock_ledger` luôn trỏ `variant_id`,
  không bao giờ trỏ thẳng `product_id`
- Một biến thể có thể có nhiều mã vạch (~50% mã nhà sản xuất, ~50% tem tự in)

## Phân quyền — chỉ 2 vai trò

| Vai trò | Quyền |
|---|---|
| `owner` | Cả 2 cửa hàng. Sửa danh mục, bảng giá, xem mọi báo cáo, huỷ đơn, điều chỉnh kho |
| `staff` | 1 cửa hàng được gán. Bán hàng, nhập kho, thu tiền nợ, kiểm kê, xem tồn |

RLS phục vụ **tách dữ liệu giữa 2 cửa hàng**, không phải chống người dùng nội bộ.

---

## KHÔNG ĐƯỢC LÀM

1. Không viết `CREATE POLICY ... USING (true)`
2. Không `INSERT`/`UPDATE` trực tiếp từ client vào bảng giao dịch — **chỉ qua RPC**
3. **Không thêm bất kỳ tính toán giá vốn nào** — không MAC, không `avg_cost`, không COGS,
   không lãi gộp, không phân bổ chi phí vận chuyển. Chỉ **lưu** `unit_cost` trên
   `inbound_items` và `stock_ledger`, không tính và không hiển thị gì phái sinh
4. Không hardcode số liệu demo trong UI. Chưa có dữ liệu thì hiện empty state
5. Không dùng localStorage/IndexedDB làm nguồn sự thật
6. Không đặt `store_id` lên bảng dùng chung, và ngược lại
7. Không thêm: chuyển kho, kho tổng, kế toán, thuế VAT, lô/hạn dùng, workflow duyệt
8. Không file `.ts`/`.tsx` nào vượt **400 dòng**
9. Không viết vào README tính năng chưa chạy được
10. Không làm nhiều phase trong một PR
11. Không commit `.env.local` hoặc bất kỳ khoá bí mật nào
12. Không sửa file migration đã commit — luôn tạo file mới có số thứ tự tiếp theo

---

## Quy trình làm việc

- Mỗi phase = 1 branch `phase-N-ten-ngan` + 1 PR. Không push thẳng lên `main`
- Trước khi viết code: đọc `docs/spec/phase-N.md`, trình bày kế hoạch, chờ tôi duyệt
- Sau khi code xong: chạy `pnpm verify`, tự sửa hết lỗi, rồi mới commit
- Commit theo Conventional Commits, tiếng Anh: `feat(pos): add barcode scan`
- Tạo PR bằng `gh pr create`, mô tả PR viết tiếng Việt, liệt kê rõ **acceptance criteria
  nào đã đạt** của phase đó
- Nếu spec mâu thuẫn hoặc thiếu: **dừng lại và hỏi**, không tự suy diễn

## Lệnh

```bash
pnpm dev                 # chạy local
pnpm verify              # typecheck + lint + build — BẮT BUỘC chạy trước khi commit
pnpm db:push             # supabase db push
pnpm db:types            # sinh lại src/lib/db/types.ts
pnpm test:rls            # kiểm tra RLS tách dữ liệu 2 cửa hàng
pnpm test:e2e            # Playwright
```

## Quy ước code

- Tiếng Việt cho mọi text hiển thị. Tiền định dạng `1.234.567`, không có ký tự `đ` trong ô nhập
- Tên bảng và cột: `snake_case` tiếng Anh. Tên biến TS: `camelCase`
- Server Component mặc định; `'use client'` chỉ khi thật sự cần tương tác
- Mọi màn hình phải có đủ 4 trạng thái: loading, empty, error, có dữ liệu
- Không dùng `any`. Kiểu dữ liệu lấy từ `src/lib/db/types.ts`
- Không hardcode mã màu — dùng biến từ `tokens.css`
- Tối ưu màn hình 1366×768, thao tác được hoàn toàn bằng bàn phím
  (F1 tìm hàng · F4 đổi đơn vị · F9 thanh toán · Esc đóng), vùng bấm ≥ 44px

## Kiểm tra bắt buộc sau mỗi phase động tới dữ liệu

- `SUM(stock_ledger.qty_base)` = `stock_balances.qty_base` cho **mọi** biến thể
- Bán ở cửa hàng A không làm đổi tồn kho hay doanh thu cửa hàng B
- Không tồn tại từ khoá `valuation`, `avg_cost`, `cogs`, `gross_profit` trong `src/`

## Biến môi trường

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY      — dùng ở client
SUPABASE_SERVICE_ROLE_KEY          — server-only, KHÔNG có tiền tố NEXT_PUBLIC_

Dùng đúng ba tên biến trên, không đổi sang tên khác.
File .env.local đã có sẵn ở máy, không đọc và không ghi đè file này.
Khi cần biến mới, báo tôi biết để tôi tự thêm.