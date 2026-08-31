import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { normalizarPlaca, obterVeiculo, registrarAuditoria } from "@/lib/meus-veiculos";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ placa: string }> }
) {
  const { placa } = await params;
  const visualizar = request.nextUrl.searchParams.get("visualizar") === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  let normalizada: string;
  try {
    normalizada = normalizarPlaca(placa);
  } catch {
    return NextResponse.json({ error: "placa inválida" }, { status: 400 });
  }

  const veiculo = await obterVeiculo(supabase, user.id, normalizada);
  if (!veiculo?.crlvDisponivel) {
    return NextResponse.json({ error: "CRLV não encontrado" }, { status: 404 });
  }

  const { data: pdf, error } = await supabase.storage
    .from("crlv-pdfs")
    .download(`${user.id}/${normalizada}.pdf`);

  if (error || !pdf) {
    await registrarAuditoria(supabase, {
      userId: user.id,
      veiculoId: veiculo.id,
      acao: "download_crlv",
      resultado: "erro",
    });
    return NextResponse.json({ error: "CRLV não encontrado" }, { status: 404 });
  }

  await registrarAuditoria(supabase, {
    userId: user.id,
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
