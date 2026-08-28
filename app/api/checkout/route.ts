import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, isStripeConfigured, stripePriceId } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  if (!isStripeConfigured) {
    return NextResponse.redirect(new URL("/assinar?erro=1", request.url));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const stripe = getStripe();
  const origin = request.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: existing?.stripe_customer_id || undefined,
    customer_email: existing?.stripe_customer_id ? undefined : user.email,
    line_items: [{ price: stripePriceId, quantity: 1 }],
    success_url: `${origin}/dashboard`,
    cancel_url: `${origin}/assinar`,
    client_reference_id: user.id,
    subscription_data: {
      metadata: { supabase_user_id: user.id },
    },
  });

  if (!session.url) {
    return NextResponse.redirect(new URL("/assinar?erro=1", request.url));
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
