import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consultarRntrc, FiltroRntrc, isRntrcApiConfigured } from "@/lib/rntrc";
import { consultarVeiculoPorPlaca, isPlacaApiConfigured } from "@/lib/dados-veiculo";
import { contarUsoNoPeriodo, registrarUsoAvancada } from "@/lib/uso-avancada";
import { getPlanoPorPriceId, PRECO_AVULSO_CENTAVOS } from "@/lib/plans";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { consumirCreditoAvancada, getSaldoCreditosAvancada } from "@/lib/creditos-avancada";

function inicioDoPeriodo(currentPeriodStart: string | null) {
  if (currentPeriodStart) return currentPeriodStart;
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);
  return inicioDoMes.toISOString();
}

async function cobrarAvulso(stripeCustomerId: string | null, documento: string) {
  if (!isStripeConfigured || !stripeCustomerId) {
    console.error(
      `[logistica-rntrc] cobrança avulsa não registrada (Stripe/cliente indisponível) — documento=${documento}`
    );
    return;
  }
  try {
    await getStripe().invoiceItems.create({
      customer: stripeCustomerId,
      amount: PRECO_AVULSO_CENTAVOS,
      currency: "brl",
      description: `Consulta avançada avulsa (RNTRC) — documento ${documento}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[logistica-rntrc] falha ao cobrar avulso: ${message}`);
  }
}

export async function GET(request: NextRequest) {
  const tipo = request.nextUrl.searchParams.get("tipo") || "cpf_cnpj";
  const valor = (request.nextUrl.searchParams.get("valor") || "").trim();
  if (!valor) {
    return NextResponse.json({ error: "informe um valor pra buscar" }, { status: 400 });
  }
  if (tipo !== "cpf_cnpj" && tipo !== "rntrc" && tipo !== "placa") {
    return NextResponse.json({ error: "tipo de busca inválido" }, { status: 400 });
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

  if (!isRntrcApiConfigured) {
    return NextResponse.json({ error: "APIBRASIL_TOKEN não configurado" }, { status: 500 });
  }

  // Busca por placa não é um filtro direto da API do RNTRC (que indexa por
  // transportador, não por veículo) — resolve a placa pro CNPJ do
  // proprietário primeiro, e busca o RNTRC desse CNPJ. Só funciona quando o
  // dono é pessoa jurídica: nunca expomos o CPF do proprietário (LGPD,
  // mesma regra de lib/dados-veiculo.ts), então não há CPF disponível aqui
  // pra buscar quando o dono é pessoa física.
  let filtro: FiltroRntrc;
  let identificadorParaAuditoria: string;
  if (tipo === "placa") {
    if (!isPlacaApiConfigured) {
      return NextResponse.json({ error: "PLACA_API_TOKEN não configurado" }, { status: 500 });
    }
    const veiculo = await consultarVeiculoPorPlaca(valor);
    if (!veiculo.ok) {
      return NextResponse.json({ error: veiculo.errorMessage }, { status: 502 });
    }
    if (!veiculo.data.proprietarioCnpj) {
      return NextResponse.json(
        {
          error:
            "O proprietário dessa placa é pessoa física — a busca por placa só funciona quando o dono é pessoa jurídica (CNPJ). Tente buscar pelo CNPJ ou RNTRC da transportadora diretamente.",
        },
        { status: 422 }
      );
    }
    filtro = { cpfCnpj: veiculo.data.proprietarioCnpj };
    identificadorParaAuditoria = veiculo.data.proprietarioCnpj;
  } else if (tipo === "rntrc") {
    filtro = { rntrc: valor };
    identificadorParaAuditoria = valor.replace(/\D/g, "");
  } else {
    filtro = { cpfCnpj: valor };
    identificadorParaAuditoria = valor.replace(/\D/g, "");
  }

  const plano = getPlanoPorPriceId(subscription?.price_id);
  const desde = inicioDoPeriodo(subscription?.current_period_start ?? null);
  const usoNoPeriodo = plano ? await contarUsoNoPeriodo(supabase, user.id, desde) : 0;
  const estourouCota = plano ? usoNoPeriodo >= plano.cota : false;

  const result = await consultarRntrc(filtro);

  console.log(`[logistica-rntrc] tipo=${tipo} ok=${result.ok}`);

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
      await cobrarAvulso(subscription?.stripe_customer_id ?? null, identificadorParaAuditoria);
    }
  }

  // Reaproveita avancada_usage/recargas_avancada — mesma cota e mesmo saldo
  // de "consulta avançada" que multas/roubo-furto já usa (decisão da
  // cliente: RNTRC desconta do mesmo saldo). "placa" aqui guarda o
  // CPF/CNPJ ou RNTRC consultado, não necessariamente uma placa de veículo.
  await registrarUsoAvancada({ userId: user.id, placa: identificadorParaAuditoria, origem });

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
