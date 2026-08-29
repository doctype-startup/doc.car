import Stripe from "stripe";
import { PLANOS } from "@/lib/plans";

export const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
export const isStripeConfigured = Boolean(
  stripeSecretKey && PLANOS.every((plano) => plano.priceId)
);

export function getStripe() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY não configurada.");
  }
  return new Stripe(stripeSecretKey);
}
