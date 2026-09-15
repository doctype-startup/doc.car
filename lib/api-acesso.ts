import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Confere sessão + assinatura ativa/trialing — usado pelas rotas de "Meus
 * Veículos" (list/create/get/edit/delete/CRLV/importação), pra não depender
 * só do redirecionamento de página (DashboardLayout) como controle de
 * acesso: a rota de API continua protegida mesmo se chamada direto, sem
 * passar pela tela. Fica num arquivo à parte de lib/meus-veiculos.ts —
 * aquele também é importado por componentes cliente (tipos, formatação), e
 * este usa next/headers, que só pode rodar no servidor. */
export async function exigirAcessoAtivo() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { erro: NextResponse.json({ error: "não autenticado" }, { status: 401 }) };

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasActiveAccess =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!hasActiveAccess) {
    return { erro: NextResponse.json({ error: "assinatura inativa" }, { status: 403 }) };
  }

  return { supabase, userId: user.id };
}
