/**
 * Hai biến công khai của Supabase.
 *
 * Đọc thẳng `process.env.TÊN_ĐẦY_ĐỦ` chứ không qua biến trung gian: Next thay thế
 * chuỗi này lúc build bằng cách so khớp văn bản, nên `process.env[name]` sẽ thành
 * `undefined` trong bundle client.
 *
 * SUPABASE_SERVICE_ROLE_KEY và SUPABASE_DB_URL KHÔNG bao giờ xuất hiện ở đây.
 */

function required(value: string | undefined, name: string): string {
  if (value === undefined || value.trim() === "") {
    throw new Error(`Thiếu biến môi trường ${name}. Kiểm tra .env.local.`);
  }
  return value;
}

export function supabaseUrl(): string {
  return required(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL");
}

export function supabaseAnonKey(): string {
  return required(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "NEXT_PUBLIC_SUPABASE_ANON_KEY");
}
