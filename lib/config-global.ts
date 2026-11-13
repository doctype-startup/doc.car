import type { SupabaseClient } from "@supabase/supabase-js";

export type ConfigGlobal = {
  cobrarConsultaSimples: boolean;
};

/** Lê a config global (ver migration 0019) — tabela de uma linha só,
 * lida por qualquer usuário autenticado (RLS libera só select). Se a
 * migration ainda não rodou nesse ambiente, cai pro padrão (não cobrar),
 * igual ao app se comportava antes dessa opção existir. */
export async function getConfigGlobal(supabase: SupabaseClient): Promise<ConfigGlobal> {
  const { data, error } = await supabase
    .from("config_global")
    .select("cobrar_consulta_simples")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error(`[config-global] falha ao ler (migration 0019 rodou?): ${error.message}`);
  }

  return { cobrarConsultaSimples: Boolean(data?.cobrar_consulta_simples) };
}
