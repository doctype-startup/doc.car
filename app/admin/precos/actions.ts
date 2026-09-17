"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

/** Cadastra ou atualiza o preço de uma API (upsert por nome) — usado tanto
 * pra adicionar uma API nova quanto pra atualizar o preço de uma existente
 * quando mudar na API Brasil. */
export async function salvarPreco(formData: FormData) {
  await exigirAdmin();

  const nome = String(formData.get("nome") || "").trim();
  const categoria = String(formData.get("categoria") || "").trim();
  const precoReais = Number(formData.get("preco") || 0);

  if (!nome || !categoria || !Number.isFinite(precoReais) || precoReais < 0) {
    throw new Error("Preencha nome, categoria e um preço válido.");
  }

  const admin = createAdminClient();
  await admin.from("api_precos").upsert(
    {
      nome,
      categoria,
      preco_centavos: Math.round(precoReais * 100),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "nome" }
  );

  revalidatePath("/admin/precos");
}

export async function removerPreco(id: string) {
  await exigirAdmin();
  const admin = createAdminClient();
  await admin.from("api_precos").delete().eq("id", id);
  revalidatePath("/admin/precos");
}
