import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consultarVeiculoPorPlaca, isPlacaApiConfigured } from "@/lib/dados-veiculo";

export async function GET(request: NextRequest) {
  const placa = request.nextUrl.searchParams.get("placa") || "";
  if (!placa) {
    return NextResponse.json({ error: "placa é obrigatória" }, { status: 400 });
  }

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

  if (!isPlacaApiConfigured) {
    return NextResponse.json(
      { error: "PLACA_API_TOKEN não configurado" },
      { status: 500 }
    );
  }

  const result = await consultarVeiculoPorPlaca(placa);

  console.log(`[dados-veiculo] placa=${placa} ok=${result.ok}`);

  if (!result.ok) {
    return NextResponse.json({ error: result.errorMessage }, { status: 502 });
  }

  return NextResponse.json({ data: result.data });
}
