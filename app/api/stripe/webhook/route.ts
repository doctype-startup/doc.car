import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { expirarCreditosPorCancelamento, registrarRecarga } from "@/lib/creditos";
import {
  expirarCreditosAvancadaPorCancelamento,
  registrarRecargaAvancada,
} from "@/lib/creditos-avancada";
import { getPacotePorId } from "@/lib/plans";
import { emitirCrlv } from "@/lib/crlv";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

function extractPeriodEnd(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const seconds =
    (item as unknown as { current_period_end?: number })?.current_period_end ??
    (subscription as unknown as { current_period_end?: number })
      .current_period_end;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

function extractPeriodStart(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  const seconds =
    (item as unknown as { current_period_start?: number })?.current_period_start ??
    (subscription as unknown as { current_period_start?: number })
      .current_period_start;
  return seconds ? new Date(seconds * 1000).toISOString() : null;
}

async function upsertSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.supabase_user_id;
  if (!userId) {
    console.error(
      `[stripe-webhook] subscription ${subscription.id} sem metadata.supabase_user_id`
    );
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: String(subscription.customer),
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: subscription.items.data[0]?.price.id,
      current_period_start: extractPeriodStart(subscription),
      current_period_end: extractPeriodEnd(subscription),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error(
      `[stripe-webhook] falha ao gravar assinatura do usuário ${userId}: ${error.message}`
    );
  } else {
    console.log(
      `[stripe-webhook] assinatura do usuário ${userId} gravada com status ${subscription.status}`
    );
  }

  // Créditos de recarga não sobrevivem ao cancelamento da assinatura.
  if (subscription.status === "canceled") {
    await expirarCreditosPorCancelamento(userId);
    await expirarCreditosAvancadaPorCancelamento(userId);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") return;

  const userId = session.metadata?.supabase_user_id;
  if (!userId) return;

  if (session.metadata?.tipo === "crlv_emissao") {
    await handleCrlvPago(userId, session);
    return;
  }

  const pacoteId = session.metadata?.pacote_id;
  if (!pacoteId) return;

  const pacote = getPacotePorId(pacoteId);
  const registrar = pacote?.tipo === "avancada" ? registrarRecargaAvancada : registrarRecarga;

  await registrar({
    userId,
    pacoteId,
    checkoutSessionId: session.id,
  });

  console.log(
    `[stripe-webhook] recarga (${pacoteId}) registrada pro usuário ${userId}`
  );
}

/** Pagamento avulso do CRLV-e já foi confirmado pelo Stripe — a partir daqui
 * emite o documento na API Brasil e grava o resultado (sucesso ou erro),
 * pra aparecer em /dashboard/documentos independentemente do despachante
 * seguir com a aba aberta ou não. */
async function handleCrlvPago(userId: string, session: Stripe.Checkout.Session) {
  const placa = session.metadata?.placa || "";
  const uf = session.metadata?.uf || "";
  if (!placa || !uf) {
    console.error(`[stripe-webhook] sessão de CRLV-e ${session.id} sem placa/uf no metadata`);
    return;
  }

  const resultado = await emitirCrlv(placa, uf);
  const admin = createAdminClient();

  const id = crypto.randomUUID();
  let pdfStoragePath: string | null = null;

  if (resultado.ok) {
    const path = `${userId}/emissoes/${id}.pdf`;
    const { error: uploadError } = await admin.storage
      .from("crlv-pdfs")
      .upload(path, Buffer.from(resultado.pdfBase64, "base64"), {
        contentType: "application/pdf",
      });
    if (uploadError) {
      console.error(`[stripe-webhook] falha ao salvar PDF do CRLV-e: ${uploadError.message}`);
    } else {
      pdfStoragePath = path;
    }
  }

  const { error } = await admin.from("documentos_crlv").insert({
    id,
    user_id: userId,
    placa,
    uf,
    status: resultado.ok && pdfStoragePath ? "emitido" : "erro",
    pdf_storage_path: pdfStoragePath,
    erro_mensagem: resultado.ok
      ? pdfStoragePath
        ? null
        : "CRLV-e emitido, mas falhou ao salvar o PDF."
      : resultado.errorMessage,
    stripe_checkout_session_id: session.id,
  });

  if (error && error.code !== "23505") {
    // 23505 = violação de unicidade em stripe_checkout_session_id — o
    // webhook do Stripe pode reenviar o mesmo evento, e isso é esperado.
    console.error(`[stripe-webhook] falha ao gravar documento CRLV-e: ${error.message}`);
    return;
  }

  console.log(
    `[stripe-webhook] CRLV-e (placa=${placa}) ${resultado.ok ? "emitido" : "com erro"} pro usuário ${userId}`
  );
}

export async function POST(request: NextRequest) {
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET não configurada" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("stripe-signature");
  const body = await request.text();

  if (!signature) {
    return NextResponse.json({ error: "assinatura ausente" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: `webhook inválido: ${message}` }, { status: 400 });
  }

  console.log(`[stripe-webhook] evento recebido: ${event.type}`);

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscription(event.data.object as Stripe.Subscription);
      break;
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
