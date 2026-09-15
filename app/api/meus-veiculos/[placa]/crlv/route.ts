import { NextRequest, NextResponse } from "next/server";
import { normalizarPlaca, obterVeiculo, registrarAuditoria } from "@/lib/meus-veiculos";
import { exigirAcessoAtivo } from "@/lib/api-acesso";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  const { placa } = await params;
  const visualizar = request.nextUrl.searchParams.get("visualizar") === "1";
  const acesso = await exigirAcessoAtivo();
  if ("erro" in acesso) return acesso.erro;
  const { supabase, userId } = acesso;

  let normalizada: string;
  try {
    normalizada = normalizarPlaca(placa);
  } catch {
    return NextResponse.json({ error: "placa inválida" }, { status: 400 });
  }

  const veiculo = await obterVeiculo(supabase, userId, normalizada);
  if (!veiculo?.crlvDisponivel) {
    return NextResponse.json({ error: "CRLV não encontrado" }, { status: 404 });
  }

  const { data: pdf, error } = await supabase.storage
    .from("crlv-pdfs")
    .download(`${userId}/${normalizada}.pdf`);

  if (error || !pdf) {
    await registrarAuditoria(supabase, {
      userId,
      veiculoId: veiculo.id,
      acao: "download_crlv",
      resultado: "erro",
    });
    return NextResponse.json({ error: "CRLV não encontrado" }, { status: 404 });
  }

  await registrarAuditoria(supabase, {
    userId,
    veiculoId: veiculo.id,
    acao: "download_crlv",
    resultado: "sucesso",
  });

  return new NextResponse(await pdf.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${visualizar ? "inline" : "attachment"}; filename="CRLV-${normalizada}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
