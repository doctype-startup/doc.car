import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consultarAvancadaPorPlaca, isDebitosApiConfigured } from "@/lib/dados-avancados";
import { contarUsoNoPeriodo, registrarUsoAvancada } from "@/lib/uso-avancada";
import { getPlanoPorPriceId, PRECO_AVULSO_CENTAVOS } from "@/lib/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { salvarAvancadaCache } from "@/lib/consulta-cache";
import { consumirCreditoAvancada, getSaldoCreditosAvancada } from "@/lib/creditos-avancada";

function inicioDoPeriodo(currentPeriodStart: string | null) {
  if (currentPeriodStart) return currentPeriodStart;
  // Assinaturas antigas (de antes dessa coluna existir) não têm início de
  // período salvo — usa o começo do mês corrente como aproximação.
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);
  return inicioDoMes.toISOString();
}

async function cobrarAvulso(stripeCustomerId: string | null, placa: string) {
  if (!isStripeConfigured || !stripeCustomerId) {
    console.error(
      `[consulta-avancada] cobrança avulsa não registrada (Stripe/cliente indisponível) — placa=${placa}`
    );
    return;
  }
  try {
    await getStripe().invoiceItems.create({
      customer: stripeCustomerId,
      amount: PRECO_AVULSO_CENTAVOS,
      currency: "brl",
      description: `Consulta avançada avulsa — placa ${placa}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[consulta-avancada] falha ao cobrar avulso: ${message}`);
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

  if (!isDebitosApiConfigured) {
    return NextResponse.json(
      { error: "PLACA_DEBITOS_API_TOKEN não configurado" },
      { status: 500 }
    );
  }

  const plano = getPlanoPorPriceId(subscription?.price_id);
  const desde = inicioDoPeriodo(subscription?.current_period_start ?? null);
  const usoNoPeriodo = plano ? await contarUsoNoPeriodo(supabase, user.id, desde) : 0;
  const estourouCota = plano ? usoNoPeriodo >= plano.cota : false;

  const result = await consultarAvancadaPorPlaca(placa);

  console.log(`[dados-avancados] placa=${placa} ok=${result.ok}`);

  if (!result.ok) {
    return NextResponse.json({ error: result.errorMessage }, { status: 502 });
  }

  let origem: "cota" | "credito" | "avulso" = "cota";
  if (estourouCota) {
    const usouCredito = await consumirCreditoAvancada(user.id);
    if (usouCredito) {
      origem = "credito";
    } else {
      origem = "avulso";
      await cobrarAvulso(subscription?.stripe_customer_id ?? null, placa);
    }
  }

  await registrarUsoAvancada({ userId: user.id, placa, origem });
  await salvarAvancadaCache(user.id, result.data.placa, result.data);

  return NextResponse.json({
    data: result.data,
    saldo: plano
      ? {
          cota: plano.cota,
          usado: usoNoPeriodo + 1,
          origem,
          creditos: await getSaldoCreditosAvancada(supabase, user.id),
        }
      : null,
  });
}
