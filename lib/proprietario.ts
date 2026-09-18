import { isApiBrasilConfigured, mensagemSeguraApiBrasil, URL_CONSULTA_VEICULOS } from "@/lib/crlv";
import { PRECO_CRM_AVULSO_CENTAVOS } from "@/lib/plans";

export { isApiBrasilConfigured };

const token = process.env.APIBRASIL_TOKEN || "";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const MENSAGEM_SALDO_INSUFICIENTE = `Saldo insuficiente para realizar a consulta! Valor da consulta: ${currency.format(
  PRECO_CRM_AVULSO_CENTAVOS / 100
)}!`;

export type ProprietarioAtual = {
  placa: string;
  chassi?: string;
  renavam?: string;
  marcaModelo?: string;
  anoFabricacao?: string;
  anoModelo?: string;
  cor?: string;
  municipioEmplacamento?: string;
  ufJurisdicao?: string;
  tipoSituacaoVeiculo?: string;
  /** Nome completo do proprietário atual. Recurso à parte (aba CRM),
   * liberado deliberadamente com dado pessoal completo (nome + CPF/CNPJ)
   * pra profissional veicular, atrás de reconfirmação do próprio CPF/CNPJ
   * do despachante a cada consulta (ver app/api/crm/proprietario) — a
   * consulta simples (lib/dados-veiculo.ts) também traz dado pessoal
   * completo do proprietário, mas sem essa reconfirmação nem auditoria. */
  nomeProprietario?: string;
  documentoProprietario?: string;
  tipoDocumentoProprietario?: string;
  dataUltimaAtualizacao?: string;
};

export type ConsultaProprietarioResult =
  | { ok: true; data: ProprietarioAtual }
  | { ok: false; errorMessage: string };

export async function consultarProprietarioAtual(
  placa: string
): Promise<ConsultaProprietarioResult> {
  if (!token) {
    return { ok: false, errorMessage: "APIBRASIL_TOKEN não configurado" };
  }

  const response = await fetch(URL_CONSULTA_VEICULOS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tipo: "proprietario-atual-v2", placa, homolog: false }),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.error) {
    console.error(
      `[proprietario] falha ao consultar (placa=${placa}, http=${response.status}): ${JSON.stringify(json)}`
    );
    return {
      ok: false,
      errorMessage: mensagemSeguraApiBrasil(
        json?.data?.detail || json?.message || `Consulta falhou (HTTP ${response.status}).`,
        MENSAGEM_SALDO_INSUFICIENTE
      ),
    };
  }

  const registro = json?.data?.proprietarioAtual;
  if (!registro) {
    return { ok: false, errorMessage: "Nenhum dado de proprietário encontrado pra essa placa." };
  }

  return {
    ok: true,
    data: {
      placa: registro.placa || placa,
      chassi: registro.chassi || undefined,
      renavam: registro.renavam || undefined,
      marcaModelo: registro.marcaModelo || undefined,
      anoFabricacao: registro.anoFabricacao || undefined,
      anoModelo: registro.anoModelo || undefined,
      cor: registro.cor || undefined,
      municipioEmplacamento: registro.municipioEmplacamento || undefined,
      ufJurisdicao: registro.ufJurisdicao || undefined,
      tipoSituacaoVeiculo: registro.tipoSituacaoVeiculo || undefined,
      nomeProprietario: registro.nomeProprietario || undefined,
      documentoProprietario: registro.docProprietario || undefined,
      tipoDocumentoProprietario: registro.tipoDocProprietario || undefined,
      dataUltimaAtualizacao: registro.dataUltimaAtualizacao || undefined,
    },
  };
}
