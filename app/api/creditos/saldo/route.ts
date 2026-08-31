import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPlanoPorPriceId } from "@/lib/plans";
import { contarUsoSimplesNoPeriodo } from "@/lib/uso-simples";
import { getSaldoCreditos } from "@/lib/creditos";

function inicioDoPeriodo(currentPeriodStart: string | null) {
  if (currentPeriodStart) return currentPeriodStart;
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);
  return inicioDoMes.toISOString();
}

/** Usado pelo card "Seu saldo" de /dashboard/creditos pra atualizar em
 * tempo real (polling) sem recarregar a página inteira. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("price_id, current_period_start")
    .eq("user_id", user.id)
    .maybeSingle();

  const plano = getPlanoPorPriceId(subscription?.price_id);
  const desde = inicioDoPeriodo(subscription?.current_period_start ?? null);
  const usoNoPeriodo = plano ? await contarUsoSimplesNoPeriodo(supabase, user.id, desde) : 0;
  const creditos = await getSaldoCreditos(supabase, user.id);

  return NextResponse.json({
    usoNoPeriodo,
    cotaSimples: plano?.cotaSimples ?? null,
    creditos,
  });
}
