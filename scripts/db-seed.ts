import { readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { withDb } from "./lib/db";
import { repoRoot, requireEnv } from "./lib/env";
import { SEED_USERS } from "./lib/seed-users";

/**
 * Nạp dữ liệu mẫu cho môi trường dev. Hai bước:
 *
 *   1. Tạo 3 user qua Auth Admin API. KHÔNG dựng tay dòng auth.users bằng SQL:
 *      cấu trúc bảng đó là chuyện nội bộ của GoTrue, gồm cả auth.identities và
 *      định dạng mật khẩu, và sẽ vỡ khi Supabase nâng cấp.
 *   2. Chạy supabase/seed.sql trong MỘT transaction qua kết nối Postgres.
 *
 * seed.sql tự dừng nếu database đã có dữ liệu — xem đầu file đó để biết cách
 * seed lại từ đầu.
 */

async function ensureUsers(): Promise<void> {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`Không liệt kê được user: ${error.message}`);
  const existing = new Set(data.users.map((u) => u.email?.toLowerCase()));

  for (const user of SEED_USERS) {
    if (existing.has(user.email)) {
      console.log(`  đã có   ${user.email}`);
      continue;
    }
    const created = await admin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });
    if (created.error) {
      throw new Error(`Không tạo được ${user.email}: ${created.error.message}`);
    }
    console.log(`  đã tạo  ${user.email}`);
  }
}

async function runSeedSql(): Promise<void> {
  const file = path.join(repoRoot, "supabase", "seed.sql");
  const sql = readFileSync(file, "utf8");

  await withDb(async (c) => {
    // Một transaction duy nhất: seed hỏng giữa chừng thì không để lại dữ liệu dở.
    await c.query("begin");
    try {
      const result = await c.query(sql);
      await c.query("commit");
      void result;
    } catch (e) {
      await c.query("rollback");
      throw e;
    }
  });
}

async function main(): Promise<void> {
  console.log("Tạo user auth:");
  await ensureUsers();
  console.log("Chạy supabase/seed.sql ...");
  await runSeedSql();
  console.log("Xong.");
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
