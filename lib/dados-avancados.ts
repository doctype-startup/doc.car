const token = process.env.PLACA_DEBITOS_API_TOKEN || "";

export const isDebitosApiConfigured = Boolean(token);

const BASE_URL = "https://consultaplacadebitos.processalead.site/public/proxy.php";

export type OcorrenciaRouboFurto = {
  tipo?: string;
  data?: string;
  municipio?: string;
  descricao?: string;
};

export type ConsultaAvancada = {
  placa: string;
  totalMultas: number;
  valorTotalMultas: number;
  pontosTotal: number;
  possuiMulta: boolean;
  rouboFurto: OcorrenciaRouboFurto | null;
  possuiRestricaoJudicial: boolean;
  /** Só a contagem — o provedor ainda não nos deu uma amostra com itens
   * preenchidos, então não arriscamos exibir campos não verificados do
   * Renajud (que podem incluir dados pessoais do processo). */
  totalRestricoesJudiciais: number;
  /** Nome do proprietário atual — mesma exceção já aplicada em
   * lib/dados-veiculo.ts: o nome, isoladamente, não é o dado sensível aqui
   * (o despachante tem necessidade legítima de saber de quem é o veículo).
   * CPF, nome da mãe, endereço e demais dados pessoais continuam nunca
   * saindo desta função. */
  proprietarioNome?: string;
  /** CNPJ do proprietário, só quando ele é pessoa jurídica (14 dígitos no
   * documento do provedor). Mesma regra do restante do app: CPF de pessoa
   * física (11 dígitos) nunca sai desta função. */
  proprietarioCnpj?: string;
};

export type ConsultaAvancadaResult =
  | { ok: true; data: ConsultaAvancada }
  | { ok: false; errorMessage: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeAvancada(raw: any): ConsultaAvancada {
  const d = raw?.dados || {};
  const veiculo = Array.isArray(d?.dados) ? d.dados[0] : undefined;

  const documento = veiculo?.niProprietario
    ? String(veiculo.niProprietario).replace(/\D/g, "")
    : "";

  const ocorrenciaRaw = d?.ocorrencias_roubo_furto;
  const rouboFurto: OcorrenciaRouboFurto | null = veiculo?.possuiOcorrenciaRouboFurto
    ? {
        tipo: ocorrenciaRaw?.tipo || undefined,
        data: ocorrenciaRaw?.data || undefined,
        municipio: ocorrenciaRaw?.municipio || undefined,
        descricao: ocorrenciaRaw?.descricao || undefined,
      }
    : null;

  return {
    placa: veiculo?.placa || d?.documento || "",
    totalMultas: Number(d?.total_multas ?? 0),
    valorTotalMultas: Number(d?.valor_total ?? 0),
    pontosTotal: Number(d?.pontos_total ?? 0),
    possuiMulta: Boolean(veiculo?.possuiMulta),
    rouboFurto,
    possuiRestricaoJudicial: Boolean(veiculo?.possuiRestricaoJudicial),
    totalRestricoesJudiciais: Array.isArray(d?.renajud) ? d.renajud.length : 0,
    proprietarioNome: veiculo?.nomeProprietario || undefined,
    proprietarioCnpj: documento.length === 14 ? documento : undefined,
  };
}

export async function consultarAvancadaPorPlaca(
  placa: string
): Promise<ConsultaAvancadaResult> {
  if (!token) {
    return { ok: false, errorMessage: "PLACA_DEBITOS_API_TOKEN não configurado" };
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("placa", placa);

  const response = await fetch(url.toString());
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    return { ok: false, errorMessage: `Consulta avançada falhou (HTTP ${response.status}).` };
  }
  if (json?.status !== "sucesso") {
    return { ok: false, errorMessage: "Não foi possível consultar débitos/multas para essa placa." };
  }

  // A partir daqui só trafega o resultado já filtrado por sanitizeAvancada —
  // o payload bruto (que inclui nome e documento do proprietário) não é
  // retornado, logado nem armazenado.
  return { ok: true, data: sanitizeAvancada(json) };
}
