import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { expirarCreditosPorCancelamento } from "@/lib/creditos";

/** Roda diariamente (ver vercel.json) e revoga sozinho qualquer teste
 * concedido pelo admin (app/admin/actions.ts → criarTeste) cujo prazo já
 * passou — mesmo efeito de clicar em "Revogar acesso" na tabela, só que
 * automático. Não mexe em assinaturas reais do Stripe: só considera testes
 * manuais (sem stripe_subscription_id) com prazo definido. */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: expirados, error } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("status", "trialing")
    .is("stripe_subscription_id", null)
    .not("current_period_end", "is", null)
    .lt("current_period_end", new Date().toISOString());

  if (error) {
    console.error(`[cron/expirar-testes] falha ao buscar testes vencidos: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  for (const { user_id: userId } of expirados ?? []) {
    await admin
      .from("subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    await expirarCreditosPorCancelamento(userId);
  }

  return NextResponse.json({ expirados: expirados?.length ?? 0 });
}
