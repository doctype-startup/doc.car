"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { IMPERSONADOR_COOKIE } from "@/lib/impersonar";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { getPlanoPorId, PLANO_TESTE } from "@/lib/plans";
import {
  expirarCreditosPorCancelamento,
  concederCreditoManual,
  retirarCreditoManual,
} from "@/lib/creditos";
import { concederCreditoManualAvancada, retirarCreditoManualAvancada } from "@/lib/creditos-avancada";
import { concederSaldoAvulsasManual, getSaldoAvulsas, debitarSaldoAvulsas } from "@/lib/saldo-avulsas";

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

/** Concede crédito direto pra um despachante, sem passar pelo Stripe — pra
 * cortesia, compensação por bug, ou qualquer motivo que não seja uma
 * compra real. `tipo` escolhe qual das três carteiras recebe o crédito;
 * pra "avulsas" a quantidade é em reais (convertida pra centavos aqui),
 * pras outras duas é a quantidade de consultas. `bonus` só marca a
 * origem do crédito pra auditoria — não muda como ele é gasto. */
export async function concederCreditoManualAdmin(userId: string, formData: FormData) {
  await exigirAdmin();

  const tipo = String(formData.get("tipo") || "");
  const direcao = String(formData.get("direcao") || "conceder");
  const quantidade = Number(formData.get("quantidade"));
  const bonus = formData.get("bonus") === "on";

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error("Informe uma quantidade válida.");
  }

  if (direcao === "retirar") {
    if (tipo === "simples") {
      await retirarCreditoManual(userId, Math.round(quantidade));
    } else if (tipo === "avancada") {
      await retirarCreditoManualAvancada(userId, Math.round(quantidade));
    } else if (tipo === "avulsas") {
      const admin = createAdminClient();
      const saldoAtual = await getSaldoAvulsas(admin, userId);
      const valorCentavos = Math.min(Math.round(quantidade * 100), saldoAtual);
      if (valorCentavos > 0) await debitarSaldoAvulsas(userId, valorCentavos);
    } else {
      throw new Error("Tipo de crédito inválido.");
    }
  } else if (tipo === "simples") {
    await concederCreditoManual({ userId, creditos: Math.round(quantidade), bonus });
  } else if (tipo === "avancada") {
    await concederCreditoManualAvancada({ userId, creditos: Math.round(quantidade), bonus });
  } else if (tipo === "avulsas") {
    await concederSaldoAvulsasManual({
      userId,
      valorCentavos: Math.round(quantidade * 100),
      bonus,
    });
  } else {
    throw new Error("Tipo de crédito inválido.");
  }

  revalidatePath("/admin");
}

/** Liga/desliga a tabela de preços dos planos na tela de login pro link de
 * acesso personalizado (/login?email=...) desse despachante — pra quem
 * paga direto com a DOCTYPE (valor negociado, fora do preço público). */
export async function definirOcultarPrecosLogin(userId: string, formData: FormData) {
  await exigirAdmin();
  const admin = createAdminClient();

  const ocultar = formData.get("ocultar") === "on";

  const { error } = await admin
    .from("profiles")
    .update({ ocultar_precos_login: ocultar })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/usuario/${userId}`);
}

/** "Entrar como o usuário" — pra suporte, quando é mais rápido ver e mexer
 * no dashboard exatamente como o despachante vê do que tentar reproduzir o
 * problema só pela "Ver conta" (que é só leitura). Gera um magic link pro
 * e-mail do despachante com a service role (sem precisar da senha dele) e
 * consome esse link na hora, trocando a sessão do navegador do admin pela
 * sessão dele. A sessão original do admin fica salva num cookie separado
 * (ver lib/impersonar.ts) pra dar pra voltar depois, com pararImpersonar
 * (app/dashboard/parar-impersonar-action.ts). */
export async function entrarComoUsuario(userId: string) {
  const supabase = await createClient();
  const {
    data: { user: adminUser },
  } = await supabase.auth.getUser();
  if (!adminUser) throw new Error("Não autenticado.");

  const { data: profileAdmin } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", adminUser.id)
    .single();
  if (!profileAdmin?.is_admin) throw new Error("Acesso negado.");

  if (userId === adminUser.id) {
    throw new Error("Você já está logado como você mesmo.");
  }

  const {
    data: { session: sessaoAdmin },
  } = await supabase.auth.getSession();
  if (!sessaoAdmin) throw new Error("Sessão de admin inválida.");

  const admin = createAdminClient();
  const { data: despachante } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (!despachante?.email) throw new Error("Despachante não encontrado.");

  const { data: link, error: erroLink } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: despachante.email,
  });
  const hashedToken = link?.properties?.hashed_token;
  if (erroLink || !hashedToken) {
    throw new Error(`Não foi possível gerar o acesso: ${erroLink?.message ?? "token ausente"}`);
  }

  const { error: erroVerify } = await supabase.auth.verifyOtp({
    token_hash: hashedToken,
    type: "magiclink",
  });
  if (erroVerify) {
    throw new Error(`Não foi possível entrar como o despachante: ${erroVerify.message}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(
    IMPERSONADOR_COOKIE,
    JSON.stringify({
      accessToken: sessaoAdmin.access_token,
      refreshToken: sessaoAdmin.refresh_token,
    }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    }
  );

  redirect("/dashboard");
}

/** Liga/desliga a cobrança da consulta simples mesmo dentro da cota do
 * plano (hoje ela é "de graça" pro despachante enquanto não estoura a
 * cota) — por despachante, não vale pra todo mundo de uma vez. Ver
 * PRECO_CONSULTA_SIMPLES_SEMPRE_CENTAVOS em lib/plans.ts pro valor
 * cobrado. */
export async function definirCobrarConsultaSimples(userId: string, formData: FormData) {
  await exigirAdmin();
  const admin = createAdminClient();

  const ativar = formData.get("ativar") === "on";

  const { error } = await admin
    .from("profiles")
    .update({ cobrar_consulta_simples: ativar })
    .eq("id", userId);

  if (error) throw new Error(error.message);

  revalidatePath(`/admin/usuario/${userId}`);
}
