import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

const PROVEDOR_PLACA = "placa_api";

/** Grava o status real do provedor de dados veiculares — a partir do
 * resultado de uma consulta de verdade feita por um despachante em
 * app/api/veiculo, não de uma checagem sintética à parte. Uma checagem à
 * parte (bater só na raiz do domínio, ou no endpoint sem os parâmetros
 * reais) não reproduz o problema: o 522 só acontece quando o provedor
 * processa uma consulta de verdade, então só o resultado real diz a
 * verdade. Alimenta o monitor ao vivo (GuardiaoHelper, via
 * app/api/status/provedor). Só deve ser chamada em código de servidor de
 * confiança — usa a service role. */
export async function registrarStatusProvedor(online: boolean, detalhe?: string) {
  const admin = createAdminClient();
  await admin.from("provedor_status").upsert(
    {
      provedor: PROVEDOR_PLACA,
      online,
      atualizado_em: new Date().toISOString(),
      detalhe: detalhe ?? null,
    },
    { onConflict: "provedor" }
  );
}

export async function lerStatusProvedor(
  supabase: SupabaseClient
): Promise<{ online: boolean; atualizado_em: string } | null> {
  const { data } = await supabase
    .from("provedor_status")
    .select("online, atualizado_em")
    .eq("provedor", PROVEDOR_PLACA)
    .maybeSingle();
  return data;
}
