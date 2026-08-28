import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./env";

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Usa a service role key: ignora RLS. Só pode ser importado em código de
// servidor de confiança (webhooks), nunca em código enviado ao browser.
export function createAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase (service role) não configurado.");
  }
  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
