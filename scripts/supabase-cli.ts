import { runSupabase } from "./lib/supabase-cli";

/**
 * Cổng vào chung cho Supabase CLI.
 *
 *   pnpm db:push                          → supabase db push
 *   pnpm exec tsx scripts/supabase-cli.ts migration list
 */
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("Thiếu tham số. Ví dụ: tsx scripts/supabase-cli.ts db push");
  process.exit(1);
}

try {
  runSupabase(args);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
