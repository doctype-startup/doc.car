const token = process.env.APIBRASIL_TOKEN || "";

export const isApiBrasilConfigured = Boolean(token);

/** Preço avulso da emissão do CRLV-e, em centavos. */
export const PRECO_CRLV_CENTAVOS = 6500;

/** Mesmo endpoint atende vários tipos de consulta veicular da API Brasil —
 * o campo "tipo" no corpo da requisição escolhe qual (aqui, "crlve" pede a
 * emissão do CRLV-e; lib/proprietario.ts reaproveita essa mesma URL com
 * outro "tipo"). Recurso pago à parte (R$65 avulso via Stripe), separado da
 * consulta de dados do veículo feita em lib/dados-veiculo.ts, que usa outro
 * provedor. */
export const URL_CONSULTA_VEICULOS = "https://gateway.apibrasil.io/api/v2/consulta/veiculos/credits";
const URL_CRLV = URL_CONSULTA_VEICULOS;

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MENSAGEM_SALDO_INSUFICIENTE_CRLV = `Saldo insuficiente para realizar a consulta! Valor da consulta: ${currency.format(
  PRECO_CRLV_CENTAVOS / 100
)}!`;

/** Alguns erros da API Brasil (json.message/json.data.detail) expõem
 * detalhes da nossa própria conta com o fornecedor — saldo da carteira
 * DOC.CAR, valor de custo pago por consulta ("Saldo insuficiente para
 * realizar a consulta! Valor da consulta: R$X,XX!") — que nunca devem
 * chegar ao cliente final: revelam nosso custo/margem e, pior, parecem
 * dizer que o saldo do CLIENTE está baixo quando na verdade é a conta da
 * DOC.CAR no fornecedor que precisa de recarga. Quem chama já loga o JSON
 * bruto completo pro time interno diagnosticar; isso só filtra o texto
 * exibido na tela. */
// Casa a palavra inteira ("saldo", "tarifa", "cobrado"/"cobrada",
// "cobrança"/"cobranças") e não um pedaço dela — sem \b aqui, "tarifa"
// também batia dentro de "tarifado" ("você não foi tarifado", o oposto de
// um problema de saldo) e escondia erros de validação legítimos (ex: placa
// em formato errado) atrás da mensagem genérica de saldo insuficiente.
const PADRAO_REVELA_CONTA_INTERNA = /\b(saldos?|tarifas?|cobrad[oa]s?|cobranças?)\b/;

export function mensagemSeguraApiBrasil(
  raw: string | undefined | null,
  fallback = "Não foi possível completar a consulta no momento. Tente novamente em instantes."
): string {
  if (!raw) return fallback;
  const normalizado = raw.toLowerCase();
  const revelaContaInterna = PADRAO_REVELA_CONTA_INTERNA.test(normalizado);
  return revelaContaInterna ? fallback : raw;
}

export type EmissaoCrlvResult =
  | { ok: true; pdfBase64: string }
  | { ok: false; errorMessage: string };

export async function emitirCrlv(placa: string, uf: string): Promise<EmissaoCrlvResult> {
  if (!token) {
    return { ok: false, errorMessage: "APIBRASIL_TOKEN não configurado" };
  }

  const response = await fetch(URL_CRLV, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tipo: "crlve", placa, uf, homolog: false }),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.error) {
    console.error(
      `[crlv] falha ao emitir (placa=${placa}, uf=${uf}, http=${response.status}): ${JSON.stringify(json)}`
    );
    // json.data.detail costuma ser bem mais específico que json.message (ex:
    // "uf SC não suportada para consulta CRLV." vs a mensagem genérica de
    // "não foi possível obter resposta válida do fornecedor") — prioriza ele
    // quando existir.
    return {
      ok: false,
      errorMessage: mensagemSeguraApiBrasil(
        json?.data?.detail || json?.message || `Emissão falhou (HTTP ${response.status}).`,
        MENSAGEM_SALDO_INSUFICIENTE_CRLV
      ),
    };
  }

  const pdfBase64 = json?.data?.pdf || "";
  if (!pdfBase64) {
    console.error(
      `[crlv] resposta sem PDF (placa=${placa}, uf=${uf}): ${JSON.stringify(json)}`
    );
    return {
      ok: false,
      errorMessage: mensagemSeguraApiBrasil(json?.message, "CRLV-e não retornado pela API."),
    };
  }

  return { ok: true, pdfBase64 };
}
