import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { CREDITOS_VALIDADE_MESES, getPacotePorId } from "@/lib/plans";

export type RecargaAvancada = {
  id: string;
  pacoteId: string;
  creditosTotais: number;
  creditosRestantes: number;
  compradoEm: string;
  expiraEm: string;
};

/** Mesmo modelo de lib/creditos.ts, pra crédito de consulta avançada —
 * recargas com saldo e ainda dentro da validade, mais próximas de expirar
 * primeiro (também a ordem de consumo, FIFO por validade). */
export async function getRecargasAtivasAvancada(
  supabase: SupabaseClient,
  userId: string
): Promise<RecargaAvancada[]> {
  const { data } = await supabase
    .from("recargas_avancada")
    .select("id, pacote_id, creditos_totais, creditos_restantes, comprado_em, expira_em")
    .eq("user_id", userId)
    .gt("creditos_restantes", 0)
    .gt("expira_em", new Date().toISOString())
    .order("expira_em", { ascending: true });

  return (data || []).map((row) => ({
    id: row.id,
    pacoteId: row.pacote_id,
    creditosTotais: row.creditos_totais,
    creditosRestantes: row.creditos_restantes,
    compradoEm: row.comprado_em,
    expiraEm: row.expira_em,
  }));
}

export async function getSaldoCreditosAvancada(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const recargas = await getRecargasAtivasAvancada(supabase, userId);
  return recargas.reduce((total, recarga) => total + recarga.creditosRestantes, 0);
}

/** Consome 1 crédito da recarga mais próxima de expirar. Retorna `true` se
 * havia crédito disponível e foi consumido, `false` caso contrário. Só deve
 * ser chamada em código de servidor de confiança — usa a service role. */
export async function consumirCreditoAvancada(userId: string): Promise<boolean> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("recargas_avancada")
    .select("id, creditos_restantes")
    .eq("user_id", userId)
    .gt("creditos_restantes", 0)
    .gt("expira_em", new Date().toISOString())
    .order("expira_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data) return false;

  const { error } = await admin
    .from("recargas_avancada")
    .update({ creditos_restantes: data.creditos_restantes - 1 })
    .eq("id", data.id)
    .gt("creditos_restantes", 0);

  return !error;
}

/** Registra uma recarga de consulta avançada comprada (chamada pelo webhook
 * do Stripe, após pagamento confirmado). Idempotente pelo id da sessão de
 * checkout — uma mesma sessão nunca concede crédito duas vezes. */
export async function registrarRecargaAvancada(params: {
  userId: string;
  pacoteId: string;
  checkoutSessionId: string;
}) {
  const pacote = getPacotePorId(params.pacoteId);
  if (!pacote) {
    console.error(`[creditos-avancada] pacote desconhecido: ${params.pacoteId}`);
    return;
  }

  const expiraEm = new Date();
  expiraEm.setMonth(expiraEm.getMonth() + CREDITOS_VALIDADE_MESES);

  const admin = createAdminClient();
  const { error } = await admin.from("recargas_avancada").insert({
    user_id: params.userId,
    pacote_id: pacote.id,
    creditos_totais: pacote.creditos,
    creditos_restantes: pacote.creditos,
    expira_em: expiraEm.toISOString(),
    stripe_checkout_session_id: params.checkoutSessionId,
  });

  if (error && error.code !== "23505") {
    // 23505 = violação de unicidade em stripe_checkout_session_id — o
    // webhook do Stripe pode reenviar o mesmo evento, e isso é esperado.
    console.error(`[creditos-avancada] falha ao registrar recarga: ${error.message}`);
  }
}

/** Zera o saldo de créditos do usuário — chamada quando a assinatura é
 * cancelada (créditos de recarga não sobrevivem ao cancelamento). */
export async function expirarCreditosAvancadaPorCancelamento(userId: string) {
  const admin = createAdminClient();
  await admin
    .from("recargas_avancada")
    .update({ creditos_restantes: 0 })
    .eq("user_id", userId)
    .gt("creditos_restantes", 0);
}
