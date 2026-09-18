"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

/** Autoriza manualmente o acesso de um funcionário de um despachante já
 * ativo. O funcionário recebe login e cota próprios (mesmo esquema de
 * "Criar acesso de teste" em app/admin/actions.ts) — não compartilha a
 * cota do despachante. O vínculo em profiles.vinculado_a_id só serve pra
 * organizar quem pertence a quem nesta aba do admin. */
export async function autorizarFuncionario(formData: FormData) {
  await exigirAdmin();

  const despachanteId = String(formData.get("despachanteId") || "");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const senha = String(formData.get("senha") || "").trim();
  const planoId = String(formData.get("plano") || "");

  if (!despachanteId) {
    throw new Error("Selecione a qual despachante esse funcionário pertence.");
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Informe um e-mail válido.");
  }
  if (senha && senha.length < 6) {
    throw new Error("A senha provisória precisa ter pelo menos 6 caracteres.");
  }
  const plano = getPlanoPorId(planoId);
  if (!plano) throw new Error("Plano inválido.");

  const admin = createAdminClient();

  const { data: despachante } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", despachanteId)
    .maybeSingle();
  if (!despachante) throw new Error("Despachante não encontrado.");

  const { data: subDespachante } = await admin
    .from("subscriptions")
    .select("status")
    .eq("user_id", despachanteId)
    .maybeSingle();
  const despachanteTemAcesso =
    subDespachante?.status === "active" || subDespachante?.status === "trialing";
  if (!despachanteTemAcesso) {
    throw new Error("Esse despachante não tem acesso ativo — autorize o acesso dele antes.");
  }

  if (email === despachante.email.toLowerCase()) {
    throw new Error("Esse e-mail é o do próprio despachante — não pode vincular a si mesmo.");
  }

  const { data: perfilExistente } = await admin
    .from("profiles")
    .select("id, vinculado_a_id")
    .ilike("email", email)
    .maybeSingle();

  let userId = perfilExistente?.id as string | undefined;

  if (!userId) {
    if (senha) {
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
    if (perfilExistente?.id === despachanteId) {
      throw new Error("Esse e-mail é o do próprio despachante — não pode vincular a si mesmo.");
    }
    if (senha) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password: senha });
      if (error) {
        throw new Error(`Não foi possível trocar a senha de ${email}: ${error.message}`);
      }
    }
  }

  await admin
    .from("profiles")
    .update({ vinculado_a_id: despachanteId })
    .eq("id", userId);

  await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      status: "active",
      price_id: plano.priceId,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      current_period_start: new Date().toISOString(),
      current_period_end: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  revalidatePath("/admin/cadastro-autorizacoes");
  revalidatePath("/admin");
}

/** Remove só o vínculo de organização com o despachante — o funcionário
 * mantém login e acesso próprios normalmente, só deixa de aparecer
 * agrupado nesta aba. Pra cortar o acesso dele, use "Revogar acesso". */
export async function desvincularFuncionario(userId: string) {
  await exigirAdmin();
  const admin = createAdminClient();
  await admin.from("profiles").update({ vinculado_a_id: null }).eq("id", userId);
  revalidatePath("/admin/cadastro-autorizacoes");
}
