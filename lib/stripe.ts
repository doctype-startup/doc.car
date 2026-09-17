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

/** Cria a sessão de checkout normalmente; se o `customer` salvo (de uma
 * compra anterior) não existir mais no Stripe — órfão por troca de modo
 * test/live, ou porque foi apagado manualmente no dashboard — tenta de
 * novo sem ele, deixando o Stripe criar um cliente novo a partir do
 * e-mail, em vez de falhar a compra inteira. */
export async function criarSessaoCheckout(
  params: Stripe.Checkout.SessionCreateParams,
  customerEmail: string
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  try {
    return await stripe.checkout.sessions.create(params);
  } catch (err) {
    const clienteOrfao =
      err instanceof Stripe.errors.StripeInvalidRequestError &&
      err.code === "resource_missing" &&
      err.param === "customer";
    if (!clienteOrfao || !params.customer) throw err;
    return stripe.checkout.sessions.create({
      ...params,
      customer: undefined,
      customer_email: customerEmail,
    });
  }
}
