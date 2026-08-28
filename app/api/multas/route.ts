import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { consultarMultasAntt, isInfosimplesConfigured } from "@/lib/infosimples";

export async function GET(request: NextRequest) {
  const placa = request.nextUrl.searchParams.get("placa") || "";
  const renavam = request.nextUrl.searchParams.get("renavam") || undefined;
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

  if (!isInfosimplesConfigured) {
    return NextResponse.json(
      { error: "INFOSIMPLES_TOKEN não configurado" },
      { status: 500 }
    );
  }

  const result = await consultarMultasAntt(placa, renavam);

  console.log(
    `[infosimples-antt-multas] placa=${placa} ok=${result.ok} resposta=${JSON.stringify(result.data).slice(0, 2000)}`
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.errorMessage }, { status: 502 });
  }

  return NextResponse.json({ data: result.data });
}
