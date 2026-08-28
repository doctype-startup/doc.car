import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isStripeConfigured } from "@/lib/stripe";

function serviceRoleKeyLooksValid(key: string) {
  return key.startsWith("sb_secret_") || key.startsWith("eyJ");
}

export async function GET() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

  return NextResponse.json({
    supabaseConfigured: isSupabaseConfigured,
    stripeConfigured: isStripeConfigured,
    hasServiceRoleKey: Boolean(serviceRoleKey),
    serviceRoleKeyLooksValid: serviceRoleKey
      ? serviceRoleKeyLooksValid(serviceRoleKey)
      : null,
    serviceRoleKeySameAsAnonKey:
      Boolean(serviceRoleKey) && serviceRoleKey === anonKey,
    hasStripeWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  });
}
