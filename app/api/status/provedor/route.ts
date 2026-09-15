import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlacaApiConfigured } from "@/lib/dados-veiculo";

// Mesmo caminho usado pela consulta de verdade (lib/dados-veiculo.ts) — sem
// isso, testar só a raiz do domínio pode responder diferente (cache,
// roteamento por path) e mentir sobre o status real desse endpoint
// específico, que foi o que aconteceu: a raiz respondia OK enquanto
// /public/proxy.php continuava caindo com 522.
const ENDPOINT_PROVEDOR = "https://uriahahahaplaca.processalead.site/public/proxy.php";
const TTL_MS = 20_000;

// Cloudflare devolve esse status quando não consegue nem conectar no
// servidor de origem (522 = connection timed out, e a família toda 520-527
// cobre as variações do mesmo problema) — é o sinal de "provedor fora do
// ar" que realmente importa aqui.
function ehErroDeOrigem(status: number) {
  return status >= 520 && status <= 527;
}

type StatusProvedor = { online: boolean; verificadoEm: string };

// Cache em memória do processo — best-effort (zera em cold start), só pra
// não bater na origem do provedor a cada poll de cada despachante logado.
let cache: StatusProvedor | null = null;

async function verificarProvedor(): Promise<StatusProvedor> {
  if (cache && Date.now() - new Date(cache.verificadoEm).getTime() < TTL_MS) {
    return cache;
  }

  let online = false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    // Sem token nem parametro: chega até a mesma origem/Cloudflare que a
    // consulta real usa (por isso reflete o mesmo 522 quando cai), mas o
    // provedor rejeita por parâmetro faltando antes de rodar qualquer
    // lógica cobrada — não gasta token nem cota.
    const response = await fetch(ENDPOINT_PROVEDOR, { signal: controller.signal });
    clearTimeout(timeout);
    online = !ehErroDeOrigem(response.status);
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
