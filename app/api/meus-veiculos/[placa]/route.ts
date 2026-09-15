import { NextRequest, NextResponse } from "next/server";
import {
  cadastrarVeiculo,
  excluirVeiculo,
  normalizarPlaca,
  obterVeiculo,
  registrarAuditoria,
} from "@/lib/meus-veiculos";
import { exigirAcessoAtivo } from "@/lib/api-acesso";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  const { placa } = await params;
  const acesso = await exigirAcessoAtivo();
  if ("erro" in acesso) return acesso.erro;
  const { supabase, userId } = acesso;

  try {
    const veiculo = await obterVeiculo(supabase, userId, placa);
    if (!veiculo) {
      return NextResponse.json({ error: "veículo não encontrado" }, { status: 404 });
    }
    await registrarAuditoria(supabase, {
      userId,
      veiculoId: veiculo.id,
      acao: "visualizacao",
      resultado: "sucesso",
    });
    return NextResponse.json({ veiculo });
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  const { placa } = await params;
  const acesso = await exigirAcessoAtivo();
  if ("erro" in acesso) return acesso.erro;
  const { supabase, userId } = acesso;

  const input = await request.json().catch(() => null);
  if (!input) {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const pdfBuffer = input.pdfBase64 ? Buffer.from(input.pdfBase64, "base64") : undefined;

  try {
    const normalizada = normalizarPlaca(placa);
    const { veiculo, avisoCrlv } = await cadastrarVeiculo(
      supabase,
      userId,
      { ...input, placa: normalizada },
      pdfBuffer
    );
    await registrarAuditoria(supabase, {
      userId,
      veiculoId: veiculo.id,
      acao: "cadastro",
      resultado: "sucesso",
    });
    return NextResponse.json({ veiculo, avisoCrlv });
  } catch (err) {
    await registrarAuditoria(supabase, { userId, acao: "cadastro", resultado: "erro" });
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  const { placa } = await params;
  const acesso = await exigirAcessoAtivo();
  if ("erro" in acesso) return acesso.erro;
  const { supabase, userId } = acesso;

  try {
    const normalizada = normalizarPlaca(placa);
    const veiculo = await obterVeiculo(supabase, userId, normalizada);
    await excluirVeiculo(supabase, userId, normalizada, veiculo);
    await registrarAuditoria(supabase, {
      userId,
      veiculoId: veiculo?.id,
      acao: "exclusao",
      resultado: "sucesso",
    });
    return NextResponse.json({ sucesso: true });
  } catch (err) {
    await registrarAuditoria(supabase, { userId, acao: "exclusao", resultado: "erro" });
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
