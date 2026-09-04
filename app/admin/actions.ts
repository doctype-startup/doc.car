"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPlanoPorId, PLANO_TESTE } from "@/lib/plans";
import { expirarCreditosPorCancelamento } from "@/lib/creditos";

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

  return user.id;
}

/** Cancela a assinatura real no Stripe, se houver — usado tanto pra revogar
 * acesso quanto antes de excluir a conta, pra nunca deixar cobrança rodando
 * sem o despachante ter mais acesso. */
async function cancelarAssinaturaStripe(stripeSubscriptionId: string | null | undefined) {
  if (!stripeSubscriptionId || !isStripeConfigured) return;
  try {
    await getStripe().subscriptions.cancel(stripeSubscriptionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[admin] falha ao cancelar assinatura ${stripeSubscriptionId} no Stripe: ${message}`);
  }
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

  await cancelarAssinaturaStripe(sub?.stripe_subscription_id);

  await admin
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  await expirarCreditosPorCancelamento(userId);

  revalidatePath("/admin");
}

/** Revoga o acesso (cancelando a assinatura no Stripe, se houver) E apaga
 * permanentemente a conta do despachante — perfil, histórico de consultas,
 * uso de consulta avançada e assinatura somem juntos, via ON DELETE CASCADE
 * a partir do usuário em auth.users. Irreversível: não existe undo, nem
 * cópia de segurança automática desses dados. A UI exige confirmação antes
 * de chamar isso. */
export async function revogarEExcluirDados(userId: string) {
  const adminUserId = await exigirAdmin();
  if (userId === adminUserId) {
    throw new Error("Você não pode excluir a própria conta de admin por aqui.");
  }

  const admin = createAdminClient();

  const { data: sub } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id")
    .eq("user_id", userId)
    .maybeSingle();

  await cancelarAssinaturaStripe(sub?.stripe_subscription_id);

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error(`[admin] falha ao excluir conta ${userId}: ${error.message}`);
    throw new Error(`Não foi possível excluir a conta: ${error.message}`);
  }

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

/** Cria um teste temporário pra qualquer e-mail — novo ou já cadastrado —
 * com cota fixa (PLANO_TESTE: 20 consultas simples + 10 avançadas) e prazo
 * definido pelo admin, sem passar pelo Stripe. Se uma senha provisória for
 * informada, o despachante já entra com ela na hora (avise por fora — não
 * mandamos e-mail com a senha); sem senha, o e-mail novo recebe convite do
 * Supabase pra definir a própria senha (perfil criado automaticamente pelo
 * trigger de novo usuário). O teste expira sozinho no prazo — ver
 * app/api/cron/expirar-testes — mas pode ser revogado a qualquer momento
 * pelo botão "Revogar acesso" na tabela. */
export async function criarTeste(formData: FormData) {
  await exigirAdmin();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  const dias = Number(formData.get("dias"));
  const senha = String(formData.get("senha") || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um e-mail válido.");
  }
  if (!Number.isFinite(dias) || dias <= 0) {
    throw new Error("Informe por quantos dias o teste deve durar.");
  }
  if (senha && senha.length < 6) {
    throw new Error("A senha provisória precisa ter pelo menos 6 caracteres.");
  }

  const admin = createAdminClient();

  const { data: perfilExistente } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  let userId = perfilExistente?.id as string | undefined;

  if (!userId) {
    if (senha) {
      // Senha provisória informada: cria a conta já com ela e confirma o
      // e-mail na hora, pra não depender do convite por e-mail — a admin
      // passa a senha direto pro despachante.
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(
          `Não foi possível criar a conta de ${email}: ${error?.message ?? "erro desconhecido"}`
        );
      }
      userId = data.user.id;
    } else {
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
      if (error || !data.user) {
        throw new Error(
          `Não foi possível convidar ${email}: ${error?.message ?? "erro desconhecido"}`
        );
      }
      userId = data.user.id;
    }
  } else {
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
        "Esse e-mail já tem uma assinatura paga ativa no Stripe — revogue antes de conceder um teste."
      );
    }

    if (senha) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password: senha });
      if (error) {
        throw new Error(`Não foi possível trocar a senha de ${email}: ${error.message}`);
      }
    }
  }

  const agora = new Date();
  const fim = new Date(agora);
  fim.setDate(fim.getDate() + dias);

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      status: "trialing",
      price_id: PLANO_TESTE.priceId,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_start: agora.toISOString(),
      current_period_end: fim.toISOString(),
      updated_at: agora.toISOString(),
    },
    { onConflict: "user_id" }
  );

  revalidatePath("/admin");
}
