import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { repoRoot } from "./lib/env";
import { runSupabase } from "./lib/supabase-cli";

/**
 * Sinh lại src/lib/db/types.ts từ schema thật trên database dev.
 *
 * File đích KHÔNG SỬA TAY. Mọi kiểu dữ liệu của ứng dụng lấy từ đó.
 */
const target = path.join(repoRoot, "src", "lib", "db", "types.ts");

const banner = [
  "// Sinh tự động bởi `pnpm db:types` — KHÔNG SỬA TAY.",
  "// Nguồn: schema của database dev. Sửa schema thì viết migration mới rồi chạy lại lệnh trên.",
  "",
].join("\n");

// Đi qua Management API, KHÔNG dùng --db-url: bản --db-url của `gen types` khởi
// động một container để introspect và sẽ chết trên máy không có Docker.
const generated = runSupabase(["gen", "types", "typescript"], {
  captureStdout: true,
  mode: "project-id",
});

if (!generated.includes("export type Database")) {
  throw new Error("Kết quả sinh types không chứa `export type Database` — không ghi đè file.");
}

mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, banner + generated, "utf8");

console.log(`Đã ghi ${path.relative(repoRoot, target)} (${String(generated.length)} ký tự)`);
