import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contarUsoNoPeriodo, registrarUsoAvancada } from "@/lib/uso-avancada";
import { getPlanoPorPriceId, PRECO_PROPRIETARIO_AVULSO_CENTAVOS } from "@/lib/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { consumirCreditoAvancada, getSaldoCreditosAvancada } from "@/lib/creditos-avancada";

function inicioDoPeriodo(currentPeriodStart: string | null) {
  if (currentPeriodStart) return currentPeriodStart;
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);
  return inicioDoMes.toISOString();
}

async function cobrarAvulso(stripeCustomerId: string | null, placa: string) {
  if (!isStripeConfigured || !stripeCustomerId) {
    console.error(
      `[consulta-avancada-proprietario] cobrança avulsa não registrada (Stripe/cliente indisponível) — placa=${placa}`
    );
    return;
  }
  try {
    await getStripe().invoiceItems.create({
      customer: stripeCustomerId,
      amount: PRECO_PROPRIETARIO_AVULSO_CENTAVOS,
      currency: "brl",
      description: `Dados do proprietário avulso (consulta avançada) — placa ${placa}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[consulta-avancada-proprietario] falha ao cobrar avulso: ${message}`);
  }
}

/** Libera o dossiê completo do proprietário (CPF/CNPJ, nome da mãe,
 * telefones, endereços) na ficha da consulta simples — o dado em si já foi
 * buscado de graça durante a consulta simples (lib/dados-veiculo.ts) e já
 * está no navegador; essa rota só cuida da cota/cobrança, igual à consulta
 * avançada principal (app/api/consulta-avancada), reaproveitando a mesma
 * cota mensal — desconta dela quando disponível, senão tenta crédito e por
 * último cobra avulso (preço próprio, diferente do avulso principal). */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const placa = String(body?.placa || "").trim().toUpperCase();
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

  const plano = getPlanoPorPriceId(subscription?.price_id);
  const desde = inicioDoPeriodo(subscription?.current_period_start ?? null);
  const usoNoPeriodo = plano ? await contarUsoNoPeriodo(supabase, user.id, desde) : 0;
  const estourouCota = plano ? usoNoPeriodo >= plano.cota : false;

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

  console.log(`[consulta-avancada-proprietario] placa=${placa} origem=${origem}`);

  return NextResponse.json({
    ok: true,
    origem,
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
