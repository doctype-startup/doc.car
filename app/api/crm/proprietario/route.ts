import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consultarProprietarioAtual, isApiBrasilConfigured } from "@/lib/proprietario";
import { contarUsoNoPeriodo } from "@/lib/uso-avancada";
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

async function cobrarAvulso(stripeCustomerId: string | null, placa: string) {
  if (!isStripeConfigured || !stripeCustomerId) {
    console.error(
      `[crm-proprietario] cobrança avulsa não registrada (Stripe/cliente indisponível) — placa=${placa}`
    );
    return;
  }
  try {
    await getStripe().invoiceItems.create({
      customer: stripeCustomerId,
      amount: PRECO_AVULSO_CENTAVOS,
      currency: "brl",
      description: `Consulta avançada avulsa (CRM — proprietário) — placa ${placa}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[crm-proprietario] falha ao cobrar avulso: ${message}`);
  }
}

/** Grava só o fato de que essa placa foi consultada no CRM — nunca o nome
 * ou documento do proprietário retornado. Auditoria de acesso, não dossiê. */
async function registrarAuditoria(userId: string, placa: string, origem: "cota" | "credito" | "avulso") {
  const admin = createAdminClient();
  await admin.from("crm_proprietario_auditoria").insert({ user_id: userId, placa, origem });
}

export async function GET(request: NextRequest) {
  const placa = (request.nextUrl.searchParams.get("placa") || "").trim().toUpperCase();
  const confirmacao = (request.nextUrl.searchParams.get("confirmacao") || "").replace(/\D/g, "");

  if (!placa) {
    return NextResponse.json({ error: "placa é obrigatória" }, { status: 400 });
  }
  if (!confirmacao) {
    return NextResponse.json({ error: "confirme seu CPF/CNPJ" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const [{ data: profile }, { data: subscription }] = await Promise.all([
    supabase.from("profiles").select("cpf_cnpj").eq("id", user.id).single(),
    supabase
      .from("subscriptions")
      .select("status, price_id, current_period_start, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const hasActiveAccess =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!hasActiveAccess) {
    return NextResponse.json({ error: "assinatura inativa" }, { status: 403 });
  }

  if (!profile?.cpf_cnpj) {
    return NextResponse.json(
      { error: "Cadastre seu CPF/CNPJ antes de consultar." },
      { status: 400 }
    );
  }

  if (confirmacao !== profile.cpf_cnpj) {
    return NextResponse.json(
      { error: "O CPF/CNPJ digitado não confere com o cadastrado na sua conta." },
      { status: 403 }
    );
  }

  if (!isApiBrasilConfigured) {
    return NextResponse.json({ error: "APIBRASIL_TOKEN não configurado" }, { status: 500 });
  }

  const plano = getPlanoPorPriceId(subscription?.price_id);
  const desde = inicioDoPeriodo(subscription?.current_period_start ?? null);
  const usoNoPeriodo = plano ? await contarUsoNoPeriodo(supabase, user.id, desde) : 0;
  const estourouCota = plano ? usoNoPeriodo >= plano.cota : false;

  const result = await consultarProprietarioAtual(placa);

  console.log(`[crm-proprietario] placa=${placa} ok=${result.ok}`);

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

  await registrarAuditoria(user.id, placa, origem);

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
