import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/db/types";
import { supabaseAnonKey, supabaseUrl } from "./env";

/**
 * Client Supabase cho Client Component.
 *
 * Phase 2 gần như không cần tới nó — mọi thao tác ghi đều đi qua Server Action.
 * Giữ sẵn cho TanStack Query ở các phase sau.
 */
export function createClient() {
  return createBrowserClient<Database>(supabaseUrl(), supabaseAnonKey());
}
