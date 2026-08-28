import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  consultarMultasAntt,
  isAnttMultasConfigured,
  TipoFiscalizacaoAntt,
} from "@/lib/infosimples";

export async function GET(request: NextRequest) {
  const placa = request.nextUrl.searchParams.get("placa") || undefined;
  const tipoFiscalizacao = (request.nextUrl.searchParams.get("tipo_fiscalizacao") ||
    "3") as TipoFiscalizacaoAntt;

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

  if (!isAnttMultasConfigured) {
    return NextResponse.json(
      { error: "Consulta de multas ANTT não configurada (falta login do SIFAMA)." },
      { status: 501 }
    );
  }

  const result = await consultarMultasAntt(tipoFiscalizacao, placa);

  console.log(
    `[infosimples-antt-multas] placa=${placa} ok=${result.ok} resposta=${JSON.stringify(result.data).slice(0, 2000)}`
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.errorMessage }, { status: 502 });
  }

  return NextResponse.json({ data: result.data });
}
