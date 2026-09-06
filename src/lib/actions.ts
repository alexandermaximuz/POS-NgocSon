/**
 * Kiểu kết quả chung của Server Action.
 *
 * Để ở module riêng vì file `"use server"` chỉ được export hàm async — export một
 * `type` từ đó chạy được nhờ TypeScript xoá nó trước khi Next kiểm tra, nhưng đó là
 * chỗ dựa vào chi tiết cài đặt, không nên xây lên trên.
 *
 * Action trả `data` thay vì tự `redirect()`: client cần hiện thông báo xác nhận
 * **kèm con số server vừa ghi** trước khi điều hướng (05-giao-dien.md §"Xác nhận
 * thao tác"). `redirect()` ném NEXT_REDIRECT nên không có đường nào trả số về.
 */

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string };

export function actionOk<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function actionError<T>(message: string): ActionResult<T> {
  return { ok: false, message };
}
