# Spec — POS Ngọc Sơn

Tài liệu đặc tả. Claude Code đọc `CLAUDE.md` ở thư mục gốc tự động mỗi phiên;
các file dưới đây chỉ nạp khi cần.

## Tài liệu tham chiếu (đọc khi phase liên quan)

| File | Nội dung | Đọc khi làm phase |
|---|---|---|
| `00-tong-quan.md` | Bối cảnh, triết lý, ranh giới scope | Mọi phase |
| `01-du-lieu.md` | Mô hình dữ liệu, toàn bộ bảng | 1, 3, 4, 5, 6, 7, 8 |
| `02-phan-quyen.md` | Vai trò, RLS | 1, 2 |
| `03-rpc.md` | Đặc tả từng RPC | 1, 4, 5, 6, 7, 8 |
| `04-erpnext-mapping.md` | Giữ gì / bỏ gì so với ERPNext | 1, 3 |
| `05-giao-dien.md` | Quy ước UI, phím tắt, in ấn | 2, 5, 9, 10 |

## Phase

| Phase | Tên | Rủi ro |
|---|---|---|
| 0 | Dọn repo & khởi tạo | Thấp |
| 1 | Database & RLS | **Cao — sai là sửa cả dự án** |
| 2 | Auth, ca làm việc, khung ứng dụng | Trung bình |
| 3 | Danh mục & import Excel | Trung bình |
| 4 | Tồn đầu kỳ & kiểm kê | **Cao — rủi ro vận hành, không phải code** |
| 5 | Bán hàng | **Cao — phase quan trọng nhất** |
| 6 | Nhập kho & công nợ NCC | Trung bình |
| 7 | Công nợ khách & phiếu thu | **Cao — sai số học là mất tiền thật** |
| 8 | Trả hàng | Thấp |
| 9 | Báo cáo & xuất file | Thấp |
| 10 | Tem QR & offline | Trung bình |
| 11 | Hoàn thiện & bàn giao | Thấp |

## Quy tắc
- Một phase = một branch = một PR
- Không sang phase sau khi acceptance của phase trước chưa xanh
- Spec mâu thuẫn hoặc thiếu → dừng lại và hỏi, không tự suy diễn
