import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlacaApiConfigured } from "@/lib/dados-veiculo";

const ORIGEM_PROVEDOR = "https://uriahahahaplaca.processalead.site/";
const TTL_MS = 20_000;

type StatusProvedor = { online: boolean; verificadoEm: string };

// Cache em memória do processo — best-effort (zera em cold start), só pra
// não bater na origem do provedor a cada poll de cada despachante logado.
// Testa a raiz do domínio, nunca /public/proxy.php: confirma se a mesma
// infraestrutura que devolveu 522 está de pé, sem rodar a lógica paga da
// consulta nem gastar token.
let cache: StatusProvedor | null = null;

async function verificarProvedor(): Promise<StatusProvedor> {
  if (cache && Date.now() - new Date(cache.verificadoEm).getTime() < TTL_MS) {
    return cache;
  }

  let online = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(ORIGEM_PROVEDOR, { signal: controller.signal });
    clearTimeout(timeout);
    online = response.status < 500;
  } catch {
    online = false;
  }

  cache = { online, verificadoEm: new Date().toISOString() };
  return cache;
}

/** Usado pelo monitor ao vivo (GuardiaoHelper) pra mostrar se o provedor de
 * dados veiculares está no ar, sem precisar gastar cota tentando uma
 * consulta de verdade. */
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
      motivo: "PLACA_API_TOKEN não configurado",
    });
  }

  const status = await verificarProvedor();
  return NextResponse.json(status);
}
