import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function contarUsoNoPeriodo(
  supabase: SupabaseClient,
  userId: string,
  desde: string
): Promise<number> {
  const { count } = await supabase
    .from("avancada_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("consultado_em", desde);

  return count ?? 0;
}

/** Só deve ser chamada em código de servidor de confiança (rota da API) —
 * usa a service role pra gravar o uso, já que não existe policy de insert
 * pro usuário direto (evita manipulação do próprio saldo pelo client). */
export async function registrarUsoAvancada(params: {
  userId: string;
  placa: string;
  cobradaAvulsa: boolean;
}) {
  const supabase = createAdminClient();
  await supabase.from("avancada_usage").insert({
    user_id: params.userId,
    placa: params.placa,
    cobrada_avulsa: params.cobradaAvulsa,
  });
}
