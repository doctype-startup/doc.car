import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obterCache } from "@/lib/consulta-cache";
import { normalizePlaca } from "@/lib/vehicle";

export async function GET(request: NextRequest) {
  const placaBruta = request.nextUrl.searchParams.get("placa") || "";
  if (!placaBruta) {
    return NextResponse.json({ error: "placa é obrigatória" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const placa = normalizePlaca(placaBruta);
  const cache = await obterCache(supabase, user.id, placa);

  if (!cache) {
    return NextResponse.json({ error: "sem cache pra essa placa" }, { status: 404 });
  }

  return NextResponse.json({
    data: cache.veiculo,
    avancada: cache.avancada,
    atualizadoEm: cache.atualizadoEm,
  });
}
