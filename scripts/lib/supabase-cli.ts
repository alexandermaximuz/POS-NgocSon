import { spawnSync } from "node:child_process";
import path from "node:path";
import { dbUrl, redactDbUrl, repoRoot, requireEnv } from "./env";

/**
 * Chạy Supabase CLI.
 *
 * Máy dev không có Docker nên ta không dùng stack local. Hai đường đi tới
 * database dev trên cloud, mỗi lệnh dùng đường phù hợp:
 *
 *   withDbUrl  — nối thẳng Postgres bằng SUPABASE_DB_URL. Dùng cho `db push`.
 *   withProjectId — đi qua Management API bằng SUPABASE_ACCESS_TOKEN. Bắt buộc
 *     cho `gen types`, vì bản `--db-url` của lệnh đó khởi động container để
 *     introspect và sẽ chết nếu không có Docker.
 *
 * Gọi thẳng file JS trong package thay vì node_modules/.bin/supabase.cmd: trên
 * Windows, spawn một file .cmd bắt buộc phải bật shell, mà shell thì không trích
 * dẫn tham số đúng cách cho connection string chứa ký tự đặc biệt.
 */
const cliEntry = path.join(repoRoot, "node_modules", "supabase", "dist", "supabase.js");

type Mode = "db-url" | "project-id" | "none";

interface RunOptions {
  captureStdout?: boolean;
  mode?: Mode;
}

/** Lấy project ref từ NEXT_PUBLIC_SUPABASE_URL (https://<ref>.supabase.co). */
export function projectRef(): string {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const match = /^https:\/\/([a-z0-9]+)\.supabase\.(co|in)/.exec(url);
  if (!match?.[1]) {
    throw new Error(`Không tách được project ref từ NEXT_PUBLIC_SUPABASE_URL = ${url}`);
  }
  return match[1];
}

export function runSupabase(args: string[], options: RunOptions = {}): string {
  const mode: Mode = options.mode ?? "db-url";
  const env = { ...process.env };
  let fullArgs = [...args];
  let context = "";

  if (mode === "db-url") {
    const url = dbUrl();
    fullArgs = [...fullArgs, "--db-url", url];
    context = redactDbUrl(url);
  } else if (mode === "project-id") {
    const ref = projectRef();
    env.SUPABASE_ACCESS_TOKEN = requireEnv("SUPABASE_ACCESS_TOKEN");
    fullArgs = [...fullArgs, "--project-id", ref];
    context = `project ${ref}`;
  }

  const result = spawnSync(process.execPath, [cliEntry, ...fullArgs], {
    cwd: repoRoot,
    env,
    stdio: options.captureStdout ? ["inherit", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `supabase ${args.join(" ")} thất bại (exit ${String(result.status)}) — ${context}`
    );
  }
  return result.stdout ?? "";
}
