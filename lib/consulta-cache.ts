import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { VeiculoReal } from "@/lib/dados-veiculo";
import { ConsultaAvancada } from "@/lib/dados-avancados";

export type ConsultaCache = {
  veiculo: VeiculoReal;
  avancada: ConsultaAvancada | null;
  atualizadoEm: string;
};

export async function obterCache(
  supabase: SupabaseClient,
  userId: string,
  placa: string
): Promise<ConsultaCache | null> {
  const { data } = await supabase
    .from("consulta_cache")
    .select("veiculo_data, avancada_data, atualizado_em")
    .eq("user_id", userId)
    .eq("placa", placa)
    .maybeSingle();

  if (!data) return null;

  return {
    veiculo: data.veiculo_data as VeiculoReal,
    avancada: (data.avancada_data as ConsultaAvancada | null) ?? null,
    atualizadoEm: data.atualizado_em,
  };
}

/** Só deve ser chamada em código de servidor de confiança (rota da API) —
 * usa a service role, já que não existe policy de insert/update pro
 * usuário direto (evita cache forjado pra "ver de graça"). */
export async function salvarVeiculoCache(userId: string, placa: string, veiculo: VeiculoReal) {
  const admin = createAdminClient();
  await admin.from("consulta_cache").upsert(
    {
      user_id: userId,
      placa,
      veiculo_data: veiculo,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "user_id,placa" }
  );
}

/** Atualiza só o pedaço de consulta avançada do cache já existente pra
 * essa placa (criado pela consulta simples). Se por algum motivo o cache
 * da simples ainda não existir, não faz nada — a consulta avançada sempre
 * acontece depois de uma simples bem-sucedida na mesma tela. */
export async function salvarAvancadaCache(
  userId: string,
  placa: string,
  avancada: ConsultaAvancada
) {
  const admin = createAdminClient();
  await admin
    .from("consulta_cache")
    .update({ avancada_data: avancada, atualizado_em: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("placa", placa);
}
