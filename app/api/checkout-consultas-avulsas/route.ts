import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarSessaoCheckout, isStripeConfigured } from "@/lib/stripe";

/** Valor mínimo de recarga do saldo de Consultas Avulsas, em centavos. */
const VALOR_MINIMO_CENTAVOS = 2000;

export async function POST(request: NextRequest) {
  if (!isStripeConfigured) {
    return NextResponse.redirect(
      new URL("/dashboard/consultas-avulsas/recarga?erro=1", request.url)
    );
  }

  const formData = await request.formData();
  const valorReais = Number(formData.get("valor") || 0);
  const valorCentavos = Math.round(valorReais * 100);

  if (!Number.isFinite(valorCentavos) || valorCentavos < VALOR_MINIMO_CENTAVOS) {
    return NextResponse.redirect(
      new URL("/dashboard/consultas-avulsas/recarga?erro=1", request.url)
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasActiveAccess =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!hasActiveAccess) {
    return NextResponse.redirect(new URL("/assinar", request.url));
  }

  const origin = request.nextUrl.origin;

  let sessionUrl: string | null = null;
  try {
    // Valor livre (não é um Price pré-cadastrado no Stripe) — o despachante
    // escolhe quanto recarregar, mesmo padrão de app/api/checkout-creditos
    // pros pacotes de recarga de consulta simples/avançada.
    const session = await criarSessaoCheckout(
      {
        mode: "payment",
        customer: subscription?.stripe_customer_id || undefined,
        customer_email: subscription?.stripe_customer_id ? undefined : user.email,
        line_items: [
          {
            price_data: {
              currency: "brl",
              unit_amount: valorCentavos,
              product_data: { name: "Recarga de saldo — Consultas Avulsas — DOC.CAR" },
            },
            quantity: 1,
          },
        ],
        success_url: `${origin}/dashboard/consultas-avulsas/recarga?compra=sucesso`,
        cancel_url: `${origin}/dashboard/consultas-avulsas/recarga`,
        client_reference_id: user.id,
        metadata: {
          supabase_user_id: user.id,
          tipo: "saldo_avulsas",
          valor_centavos: String(valorCentavos),
        },
      },
      user.email
    );
    sessionUrl = session.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[checkout-consultas-avulsas] falha ao criar sessão: ${message}`);
  }

  if (!sessionUrl) {
    return NextResponse.redirect(
      new URL("/dashboard/consultas-avulsas/recarga?erro=1", request.url)
    );
  }

  return NextResponse.redirect(sessionUrl, { status: 303 });
}
