import { Client } from "pg";
import { dbUrl } from "./env";

/**
 * Kết nối Postgres trực tiếp bằng SUPABASE_DB_URL.
 *
 * Chỉ dùng cho seed và cho các khẳng định trong test:rls cần chạy dưới quyền
 * chủ sở hữu bảng (ví dụ: chứng minh UPDATE stock_ledger bị chặn kể cả với
 * `postgres`, thứ mà REVOKE một mình không làm được).
 */
export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: dbUrl() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
