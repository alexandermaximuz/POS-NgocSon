# Phase 9 — Báo cáo, xuất file & lên production

**Branch:** `phase-9-reports`
**Phụ thuộc:** Phase 8

## Mục tiêu

Chủ cửa hàng xem được kết quả kinh doanh và xuất ra Excel/PDF khi cần.

## Bối cảnh

Ở v1, doanh thu là hằng số `18.420.000` hardcode và màn tồn kho ghi "1.847 mã hàng"
khi thực tế có 10. Lần này **mọi con số phải là kết quả truy vấn**.

## Việc cần làm

### 1. Tồn kho
- Danh sách tồn theo biến thể, phân trang server-side, lọc theo nhóm
- Hiển thị **quy thùng**: `142 cái = 11 thùng + 10 cái` (dùng hệ số của đơn vị lớn nhất)
- Cảnh báo dưới `safety_stock`, có bộ lọc "Sắp hết hàng"
- `owner` xem được cả 2 cửa hàng cạnh nhau

### 2. Sổ kho
- Chọn biến thể → lịch sử nhập/xuất, lọc theo khoảng ngày và loại chứng từ
- Mỗi dòng link tới chứng từ gốc
- Phân trang, mặc định 30 ngày gần nhất

### 3. Dashboard & báo cáo
- Tổng kết ca / ngày / tuần / tháng
- Doanh thu theo cửa hàng, biểu đồ theo ngày
- Top sản phẩm bán chạy
- Hàng chậm luân chuyển (không phát sinh xuất trong N ngày)
- Doanh thu theo người bán
- Công nợ khách & NCC, tuổi nợ
- Báo cáo hao hụt (từ `return_scrap` và `adjust` âm)
- Lịch sử giao dịch: bộ lọc theo ngày, loại chứng từ, khách, người tạo

### 4. Xuất file
- **Excel** (ExcelJS): mọi báo cáo. Tiêu đề tiếng Việt, định dạng số `1.234.567`,
  freeze dòng tiêu đề, độ rộng cột hợp lý
- **PDF**: bản in của báo cáo tổng kết ca, tổng kết ngày, công nợ

### 5. Lên production
- Tạo Supabase project thứ hai `pos-ngocson-prod`, region Singapore
- `supabase db push` toàn bộ migration. **Không chạy `seed.sql`**
- Vercel: Supabase integration cho môi trường Production trỏ project prod,
  giữ project dev cho Preview
- Bật **PITR** trên Supabase production
- Tạo tài khoản thật, xoá tài khoản demo

## Ràng buộc

- Không tính hay hiển thị lãi gộp, biên lợi nhuận, giá vốn ở bất kỳ báo cáo nào
- Không hardcode bất kỳ con số nào — chưa có dữ liệu thì hiện empty state
- Báo cáo nặng thì dùng view hoặc RPC, không kéo hết dữ liệu về client

## Acceptance criteria

- [ ] Doanh thu dashboard = `SUM(orders.total) WHERE status = 'paid'` trong kỳ,
      tách đúng theo cửa hàng
- [ ] Tồn 142 cái với thùng = 12 → hiển thị **11 thùng + 10 cái**
- [ ] Sổ kho một biến thể liệt kê đủ mọi chứng từ, mỗi dòng bấm được sang chứng từ gốc
- [ ] File Excel xuất ra mở được trong Excel bản tiếng Việt, không lỗi font,
      số hiển thị đúng định dạng
- [ ] PDF tổng kết ca in ra khớp số liệu trên màn hình
- [ ] `grep -rnE "[0-9]{3}\.[0-9]{3}" src/app src/components` không có con số tiền
      nào hardcode
- [ ] Database production chạy được, không có dữ liệu seed
- [ ] PITR đã bật
- [ ] `pnpm verify` xanh
