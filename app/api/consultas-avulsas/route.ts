import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consultarAvulsa,
  getConsultaAvulsaPorId,
  isApiBrasilConfigured,
} from "@/lib/consultas-avulsas";
import { debitarSaldoAvulsas, estornarSaldoAvulsas, getSaldoAvulsas } from "@/lib/saldo-avulsas";

/** Rota genérica pra qualquer serviço do registro em lib/consultas-avulsas
 * — a UI só manda qual "servico" (id do registro) e o parâmetro (hoje
 * sempre placa). Débito e estorno de saldo seguem o mesmo padrão das
 * outras consultas avulsas do app (app/api/veiculo, app/api/crm/...): só
 * cobra se a consulta realmente devolveu dado. */
export async function GET(request: NextRequest) {
  const servicoId = request.nextUrl.searchParams.get("servico") || "";
  const placa = (request.nextUrl.searchParams.get("placa") || "").trim().toUpperCase();

  const servico = getConsultaAvulsaPorId(servicoId);
  if (!servico) {
    return NextResponse.json({ error: "Serviço inválido." }, { status: 400 });
  }
  if (!placa) {
    return NextResponse.json({ error: "Informe a placa." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  if (!isApiBrasilConfigured) {
    return NextResponse.json({ error: "APIBRASIL_TOKEN não configurado" }, { status: 500 });
  }

  const saldoAntes = await getSaldoAvulsas(supabase, user.id);
  if (saldoAntes < servico.precoCentavos) {
    return NextResponse.json(
      { error: "Saldo insuficiente pra essa consulta — recarregue em Consultas Avulsas." },
      { status: 402 }
    );
  }

  const debitou = await debitarSaldoAvulsas(user.id, servico.precoCentavos);
  if (!debitou) {
    return NextResponse.json(
      { error: "Saldo insuficiente pra essa consulta — recarregue em Consultas Avulsas." },
      { status: 402 }
    );
  }

  const resultado = await consultarAvulsa(servico.tipoApi, placa, servico.precoCentavos);

  console.log(`[consultas-avulsas] servico=${servico.id} placa=${placa} ok=${resultado.ok}`);

  if (!resultado.ok) {
    await estornarSaldoAvulsas(user.id, servico.precoCentavos);
    return NextResponse.json({ error: resultado.errorMessage }, { status: 502 });
  }

  const admin = createAdminClient();
  await admin.from("consultas_avulsas_uso").insert({
    user_id: user.id,
    servico_id: servico.id,
    parametro: placa,
    preco_centavos: servico.precoCentavos,
  });

  return NextResponse.json({
    data: resultado.data,
    saldo: saldoAntes - servico.precoCentavos,
  });
}
