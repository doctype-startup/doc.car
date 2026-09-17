import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { criarSessaoCheckout, isStripeConfigured } from "@/lib/stripe";
import { isApiBrasilConfigured, PRECO_CRLV_CENTAVOS } from "@/lib/crlv";
import { normalizarPlaca } from "@/lib/meus-veiculos";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured || !isApiBrasilConfigured) {
    return NextResponse.redirect(new URL("/dashboard/documentos?erro=1", request.url));
  }

  const formData = await request.formData();
  const uf = String(formData.get("uf") || "").trim().toUpperCase();

  // normalizarPlaca tira traço/espaço e valida o formato (ex: "MHF-2G17" →
  // "MHF2G17") — sem isso, a API Brasil rejeita qualquer placa digitada com
  // pontuação, mesmo com o formato certo por baixo.
  let placa: string;
  try {
    placa = normalizarPlaca(String(formData.get("placa") || ""));
  } catch {
    return NextResponse.redirect(new URL("/dashboard/documentos?erro=1", request.url));
  }

  if (!uf) {
    return NextResponse.redirect(new URL("/dashboard/documentos?erro=1", request.url));
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
    const session = await criarSessaoCheckout({
      mode: "payment",
      customer: subscription?.stripe_customer_id || undefined,
      customer_email: subscription?.stripe_customer_id ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: PRECO_CRLV_CENTAVOS,
            product_data: {
              name: `Emissão de CRLV-e — placa ${placa} — DOC.CAR`,
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard/documentos?compra=sucesso`,
      cancel_url: `${origin}/dashboard/documentos`,
      client_reference_id: user.id,
      metadata: {
        supabase_user_id: user.id,
        tipo: "crlv_emissao",
        placa,
        uf,
      },
    }, user.email);
    sessionUrl = session.url;
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[checkout-crlv] falha ao criar sessão (placa=${placa}): ${message}`);
  }

  if (!sessionUrl) {
    return NextResponse.redirect(new URL("/dashboard/documentos?erro=1", request.url));
  }

  return NextResponse.redirect(sessionUrl, { status: 303 });
}
