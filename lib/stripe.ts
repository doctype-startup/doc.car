import Stripe from "stripe";

export const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
export const stripePriceId = process.env.STRIPE_PRICE_ID || "";
export const isStripeConfigured = Boolean(stripeSecretKey && stripePriceId);

export function getStripe() {
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY não configurada.");
  }
  return new Stripe(stripeSecretKey);
}
