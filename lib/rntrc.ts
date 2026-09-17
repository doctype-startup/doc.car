import { isApiBrasilConfigured } from "@/lib/crlv";

export { isApiBrasilConfigured as isRntrcApiConfigured };

const token = process.env.APIBRASIL_TOKEN || "";

/** Mesmo gateway/token da API Brasil já usado pro CRLV-e (lib/crlv.ts) — só
 * a rota muda. Consulta o RNTRC (Registro Nacional de Transportadores
 * Rodoviários de Cargas/ANTT) por CPF/CNPJ do transportador. */
const URL_RNTRC = "https://gateway.apibrasil.io/api/v2/consulta/api-rntrc/credits";

export type Transportador = {
  rntrc: string;
  tipoTransportador?: string;
  cpfCnpj: string;
  nomeRazaoSocial?: string;
  situacaoCadastral?: string;
  dataCadastro?: string;
  dataValidade?: string;
  municipio?: string;
  uf?: string;
};

export type ConsultaRntrcResult =
  | { ok: true; data: Transportador }
  | { ok: false; errorMessage: string };

export async function consultarRntrcPorDocumento(cpfCnpj: string): Promise<ConsultaRntrcResult> {
  if (!token) {
    return { ok: false, errorMessage: "APIBRASIL_TOKEN não configurado" };
  }

  const documento = cpfCnpj.replace(/\D/g, "");

  const response = await fetch(URL_RNTRC, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tipo: "search",
      homolog: false,
      filters: { cpf_cnpj: documento },
      pagination: { page: 1, page_size: 1 },
    }),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.error) {
    console.error(
      `[rntrc] falha ao consultar (documento=${documento}, http=${response.status}): ${JSON.stringify(json)}`
    );
    return {
      ok: false,
      errorMessage:
        json?.data?.detail || json?.message || `Consulta falhou (HTTP ${response.status}).`,
    };
  }

  const registro = json?.data?.data?.[0];
  if (!registro) {
    return { ok: false, errorMessage: "Nenhum transportador encontrado com esse CPF/CNPJ no RNTRC." };
  }

  return {
    ok: true,
    data: {
      rntrc: registro.rntrc,
      tipoTransportador: registro.tipo_transportador || undefined,
      cpfCnpj: registro.cpf_cnpj || documento,
      nomeRazaoSocial: registro.nome_razao_social || undefined,
      situacaoCadastral: registro.situacao_cadastral || undefined,
      dataCadastro: registro.data_cadastro || undefined,
      dataValidade: registro.data_validade || undefined,
      municipio: registro.municipio || undefined,
      uf: registro.uf || undefined,
    },
  };
}
