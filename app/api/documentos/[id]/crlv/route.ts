import { NextRequest, NextResponse } from "next/server";
import { exigirAcessoAtivo } from "@/lib/api-acesso";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const visualizar = request.nextUrl.searchParams.get("visualizar") === "1";
  const acesso = await exigirAcessoAtivo();
  if ("erro" in acesso) return acesso.erro;
  const { supabase, userId } = acesso;

  const { data: documento } = await supabase
    .from("documentos_crlv")
    .select("placa, status, pdf_storage_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!documento || documento.status !== "emitido" || !documento.pdf_storage_path) {
    return NextResponse.json({ error: "CRLV-e não encontrado" }, { status: 404 });
  }

  const { data: pdf, error } = await supabase.storage
    .from("crlv-pdfs")
    .download(documento.pdf_storage_path);

  if (error || !pdf) {
    return NextResponse.json({ error: "CRLV-e não encontrado" }, { status: 404 });
  }

  return new NextResponse(await pdf.arrayBuffer(), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${visualizar ? "inline" : "attachment"}; filename="CRLV-e-${documento.placa}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
