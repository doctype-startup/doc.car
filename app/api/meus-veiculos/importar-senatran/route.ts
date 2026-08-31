import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { importarSenatran, registrarAuditoria } from "@/lib/meus-veiculos";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasActiveAccess =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!hasActiveAccess) {
    return NextResponse.json({ error: "assinatura inativa" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const veiculos = await importarSenatran(supabase, user.id, payload);
    await registrarAuditoria(supabase, {
      userId: user.id,
      acao: "importacao_senatran",
      resultado: "sucesso",
    });
    return NextResponse.json({ sucesso: true, totalRegistros: veiculos.length, veiculos });
  } catch (err) {
    await registrarAuditoria(supabase, {
      userId: user.id,
      acao: "importacao_senatran",
      resultado: "erro",
    });
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
