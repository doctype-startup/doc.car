import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isStripeConfigured } from "@/lib/stripe";

export async function GET() {
  return NextResponse.json({
    supabaseConfigured: isSupabaseConfigured,
    stripeConfigured: isStripeConfigured,
    hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasStripeWebhookSecret: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
  });
}
