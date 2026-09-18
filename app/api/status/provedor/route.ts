import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlacaApiConfigured } from "@/lib/dados-veiculo";
import { lerStatusProvedor } from "@/lib/status-provedor";

/** Usado pelo monitor ao vivo (GuardiaoHelper). Não faz nenhuma checagem
 * sintética própria — só lê o último status real, gravado a partir do
 * resultado de cada consulta de verdade feita em /api/veiculo (ver
 * lib/status-provedor.ts). Uma checagem à parte (bater só na raiz do
 * domínio, ou no endpoint sem os parâmetros de uma consulta real) não
 * reproduz o 522 real: ele só acontece quando o provedor processa uma
 * consulta de verdade. Por isso o monitor reflete exatamente o que os
 * despachantes estão vivendo, sem gastar nada extra. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "não autenticado" }, { status: 401 });
  }

  if (!isPlacaApiConfigured) {
    return NextResponse.json({
      online: false,
      verificadoEm: new Date().toISOString(),
      motivo: "APIBRASIL_TOKEN não configurado",
    });
  }

  const status = await lerStatusProvedor(supabase);

  if (!status) {
    // Ainda não houve nenhuma consulta de verdade desde que esse
    // monitoramento passou a existir — não há como saber, então assume no
    // ar até a primeira consulta real atualizar isso.
    return NextResponse.json({ online: true, verificadoEm: new Date().toISOString() });
  }

  return NextResponse.json({ online: status.online, verificadoEm: status.atualizado_em });
}
