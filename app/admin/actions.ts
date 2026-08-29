"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPlanoPorId } from "@/lib/plans";

async function exigirAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) throw new Error("Acesso negado.");
}

/** Revoga o acesso de um despachante. Se a assinatura for real (Stripe),
 * cancela lá também — não só corta o acesso no app, senão a cobrança
 * continuaria rodando sem ele saber. Assinaturas concedidas manualmente
 * (sem stripe_subscription_id) só têm o status marcado como cancelado
 * aqui mesmo. */
export async function revogarAcesso(userId: string) {
  await exigirAdmin();
  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (sub?.stripe_subscription_id && isStripeConfigured) {
    try {
      await getStripe().subscriptions.cancel(sub.stripe_subscription_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      console.error(`[admin] falha ao cancelar assinatura ${sub.stripe_subscription_id} no Stripe: ${message}`);
    }
  }

  await admin
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  revalidatePath("/admin");
}

/** Concede acesso manual (ex: período de teste) sem passar pelo Stripe —
 * fica sem prazo, até a admin revogar. Recusa se o despachante já tiver
 * uma assinatura paga ativa, pra não sobrescrever o vínculo com o Stripe
 * por engano (a UI já evita chamar isso nesse caso). */
export async function concederAcessoManual(userId: string, formData: FormData) {
  await exigirAdmin();

  const planoId = String(formData.get("plano") || "");
  const plano = getPlanoPorId(planoId);
  if (!plano) throw new Error("Plano inválido.");

  const admin = createAdminClient();

  const { data: existente } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status")
    .eq("user_id", userId)
    .maybeSingle();

  const temAssinaturaPagaAtiva =
    existente?.stripe_subscription_id &&
    (existente.status === "active" || existente.status === "trialing");

  if (temAssinaturaPagaAtiva) {
    throw new Error(
      "Esse despachante já tem uma assinatura paga ativa no Stripe — revogue antes de conceder acesso manual."
    );
  }

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      status: "trialing",
      price_id: plano.priceId,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_start: new Date().toISOString(),
      current_period_end: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  revalidatePath("/admin");
}
