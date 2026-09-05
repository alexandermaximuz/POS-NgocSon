import { existsSync } from "node:fs";
import path from "node:path";
import { config } from "dotenv";

/**
 * Nạp biến môi trường từ .env.local ở gốc repo.
 *
 * Ba biến NEXT_PUBLIC_* / SERVICE_ROLE dùng chung với ứng dụng.
 * SUPABASE_DB_URL là server-only, chỉ các script trong thư mục này dùng —
 * không bao giờ đưa vào bundle client.
 *
 * Mọi script ở đây được gọi qua `pnpm <script>` nên cwd luôn là gốc repo.
 */

export const repoRoot = process.cwd();

let loaded = false;

function loadEnvOnce(): void {
  if (loaded) return;
  const envPath = path.join(repoRoot, ".env.local");
  if (!existsSync(envPath)) {
    throw new Error(
      `Không tìm thấy ${envPath}. Sao chép .env.example thành .env.local rồi điền giá trị.`
    );
  }
  config({ path: envPath, quiet: true });
  loaded = true;
}

export function requireEnv(name: string): string {
  loadEnvOnce();
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    throw new Error(`Thiếu biến môi trường ${name} trong .env.local`);
  }
  return value.trim();
}

/** Connection string Postgres của project dev. Chỉ dùng cho migration và seed. */
export function dbUrl(): string {
  return requireEnv("SUPABASE_DB_URL");
}

/** Che mật khẩu trước khi in connection string ra log. */
export function redactDbUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):[^@]*@/, "://$1:***@");
}
