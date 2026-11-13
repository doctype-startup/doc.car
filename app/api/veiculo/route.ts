import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consultarVeiculoPorPlaca, isPlacaApiConfigured } from "@/lib/dados-veiculo";
import { contarUsoSimplesNoPeriodo, registrarUsoSimples } from "@/lib/uso-simples";
import { consumirCredito, getSaldoCreditos } from "@/lib/creditos";
import {
  getPlanoPorPriceId,
  PRECO_AVULSO_SIMPLES_CENTAVOS,
  PRECO_CONSULTA_SIMPLES_SEMPRE_CENTAVOS,
} from "@/lib/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { salvarVeiculoCache } from "@/lib/consulta-cache";
import { registrarStatusProvedor } from "@/lib/status-provedor";
import { getConfigGlobal } from "@/lib/config-global";

function inicioDoPeriodo(currentPeriodStart: string | null) {
  if (currentPeriodStart) return currentPeriodStart;
  // Assinaturas antigas (de antes dessa coluna existir) não têm início de
  // período salvo — usa o começo do mês corrente como aproximação.
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);
  return inicioDoMes.toISOString();
}

async function cobrarAvulsoSimples(
  stripeCustomerId: string | null,
  placa: string,
  valorCentavos: number,
  descricao: string
) {
  if (!isStripeConfigured || !stripeCustomerId) {
    console.error(
      `[dados-veiculo] cobrança avulsa não registrada (Stripe/cliente indisponível) — placa=${placa}`
    );
    return;
  }
  try {
    await getStripe().invoiceItems.create({
      customer: stripeCustomerId,
      amount: valorCentavos,
      currency: "brl",
      description: descricao,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[dados-veiculo] falha ao cobrar avulso: ${message}`);
  }
}

export async function GET(request: NextRequest) {
  const placa = request.nextUrl.searchParams.get("placa") || "";
  if (!placa) {
    return NextResponse.json({ error: "placa é obrigatória" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, price_id, current_period_start, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasActiveAccess =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!hasActiveAccess) {
    return NextResponse.json({ error: "assinatura inativa" }, { status: 403 });
  }

  if (!isPlacaApiConfigured) {
    return NextResponse.json(
      { error: "APIBRASIL_TOKEN não configurado" },
      { status: 500 }
    );
  }

  const plano = getPlanoPorPriceId(subscription?.price_id);
  const desde = inicioDoPeriodo(subscription?.current_period_start ?? null);
  const usoNoPeriodo = plano ? await contarUsoSimplesNoPeriodo(supabase, user.id, desde) : 0;
  const estourouCota = plano ? usoNoPeriodo >= plano.cotaSimples : false;

  const result = await consultarVeiculoPorPlaca(placa);

  console.log(`[dados-veiculo] placa=${placa} ok=${result.ok}`);

  // Grava o status real do provedor a partir dessa consulta de verdade —
  // "não encontrado" é resultado normal (o provedor respondeu certinho, só
  // não tem essa placa), então não conta como provedor fora do ar; só uma
  // falha de verdade (motivo "http") marca indisponibilidade.
  await registrarStatusProvedor(result.ok || result.motivo !== "http");

  if (!result.ok) {
    return NextResponse.json({ error: result.errorMessage }, { status: 502 });
  }

  // Com a cota disponível, só cobra se "Cobrar consulta simples" estiver
  // ligada no super admin — senão seria sempre "cota" (de graça), como
  // sempre foi.
  const cobrarMesmoComCota = !estourouCota && (await getConfigGlobal(supabase)).cobrarConsultaSimples;

  let origem: "cota" | "credito" | "avulso" = "cota";
  if (estourouCota || cobrarMesmoComCota) {
    // Desconta primeiro do saldo de recarga que o despachante já comprou
    // (recargas_simples) — só cobra avulso de verdade quando não sobra
    // nenhum crédito. Sem isso, ligar a opção no admin cobraria em cima
    // de um saldo que o cliente já pagou, em vez de consumi-lo.
    const usouCredito = await consumirCredito(user.id);
    if (usouCredito) {
      origem = "credito";
    } else {
      origem = "avulso";
      await cobrarAvulsoSimples(
        subscription?.stripe_customer_id ?? null,
        placa,
        estourouCota ? PRECO_AVULSO_SIMPLES_CENTAVOS : PRECO_CONSULTA_SIMPLES_SEMPRE_CENTAVOS,
        estourouCota ? `Consulta simples avulsa — placa ${placa}` : `Consulta simples — placa ${placa}`
      );
    }
  }

  await registrarUsoSimples({ userId: user.id, placa, origem });
  await salvarVeiculoCache(user.id, result.data.placa, result.data);

  return NextResponse.json({
    data: result.data,
    saldo: plano
      ? {
          cota: plano.cotaSimples,
          usado: usoNoPeriodo + 1,
          origem,
          creditos: await getSaldoCreditos(supabase, user.id),
        }
      : null,
  });
}
