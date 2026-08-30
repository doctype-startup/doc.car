import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPacotePorId } from "@/lib/plans";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured) {
    return NextResponse.redirect(new URL("/dashboard/creditos?erro=1", request.url));
  }

  const formData = await request.formData();
  const pacote = getPacotePorId(String(formData.get("pacote") || ""));

  if (!pacote) {
    return NextResponse.redirect(new URL("/dashboard/creditos?erro=1", request.url));
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

  const stripe = getStripe();
  const origin = request.nextUrl.origin;

  // Pacote é pagamento único (não assinatura) — usa price_data direto na
  // sessão em vez de exigir um Price pré-cadastrado no Stripe, pra não
  // precisar de setup manual extra no dashboard do Stripe.
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    // Pacote é compra avulsa (não recorrente) — PIX funciona bem aqui,
    // ao contrário da assinatura em /api/checkout, que precisa de um método
    // reutilizável pra cobrar automaticamente todo mês.
    payment_method_types: ["card", "pix"],
    customer: subscription?.stripe_customer_id || undefined,
    customer_email: subscription?.stripe_customer_id ? undefined : user.email,
    line_items: [
      {
        price_data: {
          currency: "brl",
          unit_amount: pacote.precoCentavos,
          product_data: {
            name: `Recarga de ${pacote.creditos} consultas simples — DOC.CAR`,
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/dashboard/creditos?compra=sucesso`,
    cancel_url: `${origin}/dashboard/creditos`,
    client_reference_id: user.id,
    metadata: {
      supabase_user_id: user.id,
      pacote_id: pacote.id,
      creditos: String(pacote.creditos),
    },
  });

  if (!session.url) {
    return NextResponse.redirect(new URL("/dashboard/creditos?erro=1", request.url));
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
