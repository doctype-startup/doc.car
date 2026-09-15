import { NextRequest, NextResponse } from "next/server";
import { cadastrarVeiculo, listarVeiculos, registrarAuditoria } from "@/lib/meus-veiculos";
import { exigirAcessoAtivo } from "@/lib/api-acesso";

export async function GET() {
  const acesso = await exigirAcessoAtivo();
  if ("erro" in acesso) return acesso.erro;

  const veiculos = await listarVeiculos(acesso.supabase, acesso.userId);
  return NextResponse.json({ veiculos });
}

export async function POST(request: NextRequest) {
  const acesso = await exigirAcessoAtivo();
  if ("erro" in acesso) return acesso.erro;

  const { supabase, userId } = acesso;
  const input = await request.json().catch(() => null);

  if (!input?.placa) {
    return NextResponse.json({ error: "placa é obrigatória" }, { status: 400 });
  }

  const pdfBuffer = input.pdfBase64 ? Buffer.from(input.pdfBase64, "base64") : undefined;

  try {
    const { veiculo, avisoCrlv } = await cadastrarVeiculo(supabase, userId, input, pdfBuffer);
    await registrarAuditoria(supabase, {
      userId,
      veiculoId: veiculo.id,
      acao: "cadastro",
      resultado: "sucesso",
    });
    return NextResponse.json({ veiculo, avisoCrlv }, { status: 201 });
  } catch (err) {
    await registrarAuditoria(supabase, { userId, acao: "cadastro", resultado: "erro" });
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
