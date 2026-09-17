const token = process.env.APIBRASIL_TOKEN || "";

export const isApiBrasilConfigured = Boolean(token);

/** Preço avulso da emissão do CRLV-e, em centavos. */
export const PRECO_CRLV_CENTAVOS = 6500;

/** Mesmo endpoint atende vários tipos de consulta veicular da API Brasil —
 * o campo "tipo" no corpo da requisição escolhe qual (aqui, "crlve" pede a
 * emissão do CRLV-e). Recurso pago à parte (R$65 avulso via Stripe),
 * separado da consulta de dados do veículo feita em lib/dados-veiculo.ts,
 * que usa outro provedor. */
const URL_CRLV = "https://gateway.apibrasil.io/api/v2/consulta/veiculos/credits";

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
      errorMessage:
        json?.data?.detail || json?.message || `Emissão falhou (HTTP ${response.status}).`,
    };
  }

  const pdfBase64 = json?.data?.pdf || "";
  if (!pdfBase64) {
    console.error(
      `[crlv] resposta sem PDF (placa=${placa}, uf=${uf}): ${JSON.stringify(json)}`
    );
    return { ok: false, errorMessage: json?.message || "CRLV-e não retornado pela API." };
  }

  return { ok: true, pdfBase64 };
}
