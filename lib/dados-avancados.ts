const token = process.env.PLACA_DEBITOS_API_TOKEN || "";

export const isDebitosApiConfigured = Boolean(token);

const BASE_URL = "https://consultaplacadebitos.processalead.site/public/proxy.php";

export type OcorrenciaRouboFurto = {
  tipo?: string;
  data?: string;
  municipio?: string;
  descricao?: string;
  numeroBoletim?: string;
  orgaoSeguranca?: string;
  quantidade?: number;
};

export type Multa = {
  codigo?: string;
  descricao?: string;
  quantidade: number;
  amparoLegal?: string;
  /** Só o papel de quem responde pela multa ("Proprietário" ou "Condutor")
   * — o provedor não devolve nome de pessoa nesse campo, é uma categoria. */
  infrator?: string;
  gravidade?: string;
  orgaoCompetente?: string;
  valorUnitario: number;
  valorTotal: number;
  multiplicador: number;
  pontosUnitario: number;
  pontosTotal: number;
  tipoMulta?: string;
};

export type RestricaoRenajud = {
  tribunal?: string;
  ramo?: string;
  orgaoJudiciario?: string;
  /** Número do processo judicial — registro público do processo, não dado
   * pessoal de alguém. */
  processo?: string;
  restricoes: string[];
};

export type ConsultaAvancada = {
  placa: string;
  totalMultas: number;
  valorTotalMultas: number;
  pontosTotal: number;
  possuiMulta: boolean;
  /** Itens individuais de multa. O provedor não devolve data nem local da
   * infração por item — só o que está listado no tipo `Multa` existe. */
  multas: Multa[];
  rouboFurto: OcorrenciaRouboFurto | null;
  possuiRestricaoJudicial: boolean;
  restricoesJudiciais: RestricaoRenajud[];
  /** Restrição extrajudicial (ex: alienação fiduciária, arrendamento
   * mercantil, reserva de domínio) — o provedor só confirmou o formato
   * desse indicador; os itens de `processosExtrajud` ainda não foram
   * mapeados em detalhe por falta de um exemplo preenchido. */
  possuiRestricaoExtrajudicial: boolean;
  /** Ano do último licenciamento — pode não bater com o mesmo campo em
   * VeiculoReal (provedores diferentes); prefira o de VeiculoReal quando
   * os dois estiverem disponíveis. */
  anoUltimoLicenciamento?: string;
  /** Número sequencial interno do documento no sistema do DETRAN — NÃO é o
   * número impresso no formulário físico do CRV/CRLV. Ver `numeroCrv`. */
  numeroSequencialDocumento?: string;
  /** Número tipográfico — esse sim é o número impresso no formulário físico
   * do CRV/CRLV, o que bate com o documento em mãos do despachante. */
  numeroCrv?: string;
  /** Código de segurança do CRV/CRLV. */
  codigoSegurancaCrv?: string;
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

  // O provedor já devolveu isso ora como objeto único, ora como array
  // (às vezes vazio) — normaliza pros dois formatos.
  const ocorrenciaRaw = Array.isArray(d?.ocorrencias_roubo_furto)
    ? d.ocorrencias_roubo_furto[0]
    : d?.ocorrencias_roubo_furto;
  const rouboFurto: OcorrenciaRouboFurto | null =
    veiculo?.possuiOcorrenciaRouboFurto && ocorrenciaRaw
      ? {
          tipo: ocorrenciaRaw?.tipo || undefined,
          data: ocorrenciaRaw?.data || undefined,
          municipio: ocorrenciaRaw?.municipio || undefined,
          descricao: ocorrenciaRaw?.descricao || undefined,
          numeroBoletim: ocorrenciaRaw?.numeroBoletimAno || undefined,
          orgaoSeguranca: ocorrenciaRaw?.orgaoSegurancaUf || undefined,
          quantidade: ocorrenciaRaw?.quantidade ? Number(ocorrenciaRaw.quantidade) : undefined,
        }
      : null;

  const multas: Multa[] = Array.isArray(d?.multas)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      d.multas.map((m: any) => ({
        codigo: m?.codigo || undefined,
        descricao: m?.descricao || undefined,
        quantidade: Number(m?.quantidade ?? 1),
        amparoLegal: m?.amparo_legal || undefined,
        infrator: m?.infrator || undefined,
        gravidade: m?.gravidade || undefined,
        orgaoCompetente: m?.orgao_competente || undefined,
        valorUnitario: Number(m?.valor_unitario ?? 0),
        valorTotal: Number(m?.valor_total ?? 0),
        multiplicador: Number(m?.multiplicador ?? 1),
        pontosUnitario: Number(m?.pontos_unitario ?? 0),
        pontosTotal: Number(m?.pontos_total ?? 0),
        tipoMulta: m?.tipo_multa || undefined,
      }))
    : [];

  const restricoesJudiciais: RestricaoRenajud[] = Array.isArray(d?.renajud)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      d.renajud.map((r: any) => ({
        tribunal: r?.tribunal || undefined,
        ramo: r?.ramo || undefined,
        orgaoJudiciario: r?.orgaoJudiciario || undefined,
        processo: r?.processo || undefined,
        restricoes: Array.isArray(r?.restricoes)
          ? r.restricoes
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((x: any) => x?.descricao)
              .filter((x: unknown): x is string => Boolean(x))
          : [],
      }))
    : [];

  return {
    placa: veiculo?.placa || d?.documento || "",
    totalMultas: Number(d?.total_multas ?? 0),
    valorTotalMultas: Number(d?.valor_total ?? 0),
    pontosTotal: Number(d?.pontos_total ?? 0),
    possuiMulta: Boolean(veiculo?.possuiMulta),
    multas,
    rouboFurto,
    possuiRestricaoJudicial: Boolean(veiculo?.possuiRestricaoJudicial),
    restricoesJudiciais,
    possuiRestricaoExtrajudicial: Boolean(veiculo?.possuiRestricaoExtrajud),
    anoUltimoLicenciamento: veiculo?.anoUltimoLicenciamento
      ? String(veiculo.anoUltimoLicenciamento)
      : undefined,
    numeroSequencialDocumento: veiculo?.sequencialDocumento || undefined,
    numeroCrv: veiculo?.numeroTipografico || undefined,
    codigoSegurancaCrv: veiculo?.codigoSegurancaCrv || undefined,
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
