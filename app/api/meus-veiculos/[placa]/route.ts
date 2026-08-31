import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { excluirVeiculo, normalizarPlaca, obterVeiculo, registrarAuditoria } from "@/lib/meus-veiculos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  const { placa } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  try {
    const veiculo = await obterVeiculo(supabase, user.id, placa);
    if (!veiculo) {
      return NextResponse.json({ error: "veículo não encontrado" }, { status: 404 });
    }
    await registrarAuditoria(supabase, {
      userId: user.id,
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  const { placa } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  try {
    const normalizada = normalizarPlaca(placa);
    const veiculo = await obterVeiculo(supabase, user.id, normalizada);
    await excluirVeiculo(supabase, user.id, normalizada);
    await registrarAuditoria(supabase, {
      userId: user.id,
      veiculoId: veiculo?.id,
      acao: "exclusao",
      resultado: "sucesso",
    });
    return NextResponse.json({ sucesso: true });
  } catch (err) {
    await registrarAuditoria(supabase, { userId: user.id, acao: "exclusao", resultado: "erro" });
    const message = err instanceof Error ? err.message : "erro desconhecido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
