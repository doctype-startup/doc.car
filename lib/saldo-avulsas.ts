import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getSaldoAvulsas(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("saldo_avulsas")
    .select("saldo_centavos")
    .eq("user_id", userId)
    .maybeSingle();

  return data?.saldo_centavos ?? 0;
}

/** Debita o preço de uma consulta avulsa do saldo do usuário, de forma
 * atômica (ver a função debitar_saldo_avulsas no banco — evita duas
 * consultas simultâneas gastarem o mesmo saldo). Só deve ser chamada em
 * código de servidor de confiança — usa a service role. */
export async function debitarSaldoAvulsas(
  userId: string,
  valorCentavos: number
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("debitar_saldo_avulsas", {
    p_user_id: userId,
    p_valor_centavos: valorCentavos,
  });

  if (error) {
    console.error(`[saldo-avulsas] falha ao debitar: ${error.message}`);
    return false;
  }

  return Boolean(data);
}

/** Devolve saldo depois de uma consulta que não retornou dado (falha do
 * provedor) — chamada uma única vez, na mesma requisição que debitou,
 * então não precisa da idempotência por sessão de checkout que
 * creditarSaldoAvulsas usa pro webhook do Stripe. */
export async function estornarSaldoAvulsas(userId: string, valorCentavos: number) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("creditar_saldo_avulsas", {
    p_user_id: userId,
    p_valor_centavos: valorCentavos,
  });

  if (error) {
    console.error(`[saldo-avulsas] falha ao estornar: ${error.message}`);
  }
}

/** Credita o saldo depois de um pagamento confirmado pelo webhook do
 * Stripe. Idempotente pela sessão de checkout — grava a recarga primeiro
 * (unique em stripe_checkout_session_id) e só credita o saldo se a
 * gravação for nova, pra um reenvio do mesmo evento do Stripe nunca
 * creditar duas vezes (mesmo padrão de registrarRecarga em
 * lib/creditos.ts). */
export async function creditarSaldoAvulsas(params: {
  userId: string;
  valorCentavos: number;
  checkoutSessionId: string;
}) {
  const admin = createAdminClient();

  const { error: erroRecarga } = await admin.from("recargas_avulsas").insert({
    user_id: params.userId,
    valor_centavos: params.valorCentavos,
    stripe_checkout_session_id: params.checkoutSessionId,
  });

  if (erroRecarga) {
    if (erroRecarga.code !== "23505") {
      console.error(`[saldo-avulsas] falha ao registrar recarga: ${erroRecarga.message}`);
    }
    return;
  }

  const { error: erroCredito } = await admin.rpc("creditar_saldo_avulsas", {
    p_user_id: params.userId,
    p_valor_centavos: params.valorCentavos,
  });

  if (erroCredito) {
    console.error(`[saldo-avulsas] falha ao creditar saldo: ${erroCredito.message}`);
  }
}
