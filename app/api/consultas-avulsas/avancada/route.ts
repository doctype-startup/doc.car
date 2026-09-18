import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  consultarAvulsa,
  getConsultasAvulsasPorGrupo,
  isApiBrasilConfigured,
} from "@/lib/consultas-avulsas";
import { debitarSaldoAvulsas, estornarSaldoAvulsas, getSaldoAvulsas } from "@/lib/saldo-avulsas";

export type ResultadoServicoAvancada = {
  servicoId: string;
  nome: string;
  precoCentavos: number;
} & (
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errorMessage: string }
);

/** Dispara todos os serviços cadastrados como "avançada" em
 * lib/consultas-avulsas.ts em paralelo, pra uma mesma placa — o
 * despachante paga só pelos que realmente retornaram dado (cada um debita
 * o próprio preço do saldo, individualmente; um serviço que falhar não é
 * cobrado, os outros continuam normalmente). */
export async function GET(request: NextRequest) {
  const placa = (request.nextUrl.searchParams.get("placa") || "").trim().toUpperCase();
  if (!placa) {
    return NextResponse.json({ error: "Informe a placa." }, { status: 400 });
  }

  const servicos = getConsultasAvulsasPorGrupo("avancada");
  if (servicos.length === 0) {
    return NextResponse.json(
      { error: "Nenhum serviço de consulta avançada cadastrado ainda." },
      { status: 400 }
    );
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

  const admin = createAdminClient();

  const resultados: ResultadoServicoAvancada[] = await Promise.all(
    servicos.map(async (servico) => {
      const saldoAtual = await getSaldoAvulsas(supabase, user.id);
      if (saldoAtual < servico.precoCentavos) {
        return {
          servicoId: servico.id,
          nome: servico.nome,
          precoCentavos: servico.precoCentavos,
          ok: false,
          errorMessage: "Saldo insuficiente.",
        };
      }

      const debitou = await debitarSaldoAvulsas(user.id, servico.precoCentavos);
      if (!debitou) {
        return {
          servicoId: servico.id,
          nome: servico.nome,
          precoCentavos: servico.precoCentavos,
          ok: false,
          errorMessage: "Saldo insuficiente.",
        };
      }

      const resultado = await consultarAvulsa(servico.tipoApi, placa);

      if (!resultado.ok) {
        await estornarSaldoAvulsas(user.id, servico.precoCentavos);
        return {
          servicoId: servico.id,
          nome: servico.nome,
          precoCentavos: servico.precoCentavos,
          ok: false,
          errorMessage: resultado.errorMessage,
        };
      }

      await admin.from("consultas_avulsas_uso").insert({
        user_id: user.id,
        servico_id: servico.id,
        parametro: placa,
        preco_centavos: servico.precoCentavos,
      });

      return {
        servicoId: servico.id,
        nome: servico.nome,
        precoCentavos: servico.precoCentavos,
        ok: true,
        data: resultado.data,
      };
    })
  );

  console.log(
    `[consultas-avulsas-avancada] placa=${placa} servicos=${servicos.length} ok=${resultados.filter((r) => r.ok).length}`
  );

  const saldo = await getSaldoAvulsas(supabase, user.id);

  return NextResponse.json({ resultados, saldo });
}
