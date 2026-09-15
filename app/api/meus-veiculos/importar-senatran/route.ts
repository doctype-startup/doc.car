import { NextRequest, NextResponse } from "next/server";
import { importarSenatran, registrarAuditoria } from "@/lib/meus-veiculos";
import { exigirAcessoAtivo } from "@/lib/api-acesso";

export async function POST(request: NextRequest) {
  const acesso = await exigirAcessoAtivo();
  if ("erro" in acesso) return acesso.erro;
  const { supabase, userId } = acesso;

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  try {
    const veiculos = await importarSenatran(supabase, userId, payload);
    await registrarAuditoria(supabase, {
      userId,
      acao: "importacao_senatran",
      resultado: "sucesso",
    });
    return NextResponse.json({ sucesso: true, totalRegistros: veiculos.length, veiculos });
  } catch (err) {
    await registrarAuditoria(supabase, {
      userId,
      acao: "importacao_senatran",
      resultado: "erro",
    });
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
