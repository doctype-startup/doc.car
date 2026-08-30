const token = process.env.PLACA_API_TOKEN || "";

export const isPlacaApiConfigured = Boolean(token);

const BASE_URL = "https://uriahahahaplaca.processalead.site/public/proxy.php";

export type LeituraQuilometragem = {
  km: number;
  data?: string;
  origem?: string;
  municipio?: string;
  uf?: string;
};

export type VeiculoReal = {
  placa: string;
  placaAnterior?: string;
  placaMercosul?: string;
  chassi?: string;
  renavam?: string;
  marca?: string;
  modelo?: string;
  anoFabricacao?: number;
  anoModelo?: number;
  cor?: string;
  combustivel?: string;
  municipio?: string;
  uf?: string;
  situacaoVeiculo?: string;
  tipoVeiculo?: string;
  especie?: string;
  carroceria?: string;
  categoria?: string;
  nacionalidade?: string;
  tipoMontagem?: string;
  motor?: string;
  potencia?: string;
  cilindradas?: string;
  eixos?: string;
  lotacao?: string;
  pesoBrutoTotal?: string;
  capacidadeCarga?: string;
  capMaximaTracao?: string;
  /** Ano do último licenciamento registrado no provedor. */
  anoUltimoLicenciamento?: string;
  dataEmplacamento?: string;
  dataUltimaAtualizacao?: string;
  /** Histórico de leituras de odômetro (ex: anúncios em portais de venda) —
   * dado do veículo, não de pessoa. */
  quilometragem: LeituraQuilometragem[];
  /** Só o nome do proprietário atual — CPF, nome da mãe, endereço, telefone,
   * e-mail e qualquer outro dado pessoal do bloco `dados_credfy` do provedor
   * são descartados aqui e nunca saem desta função. O histórico de
   * proprietários anteriores (`historico_proprietario`) também nunca é lido:
   * traria o mesmo dossiê pessoal completo de terceiros que já não têm
   * nenhuma relação com a consulta atual. */
  proprietarioNome?: string;
  /** CNPJ do proprietário, só quando ele é pessoa jurídica (frota, locadora,
   * concessionária). CNPJ é registro público de empresa, não dado pessoal
   * protegido pela LGPD como o CPF — por isso, ao contrário do CPF, este
   * campo é liberado. Nunca populado quando o proprietário é pessoa física. */
  proprietarioCnpj?: string;
  /** CNPJ de quem faturou o veículo originalmente (concessionária/locadora),
   * só quando esse documento é de pessoa jurídica — mesma regra do CNPJ do
   * proprietário acima. */
  cnpjFaturado?: string;
  /** Número sequencial interno do documento no sistema do provedor — NÃO é
   * necessariamente o número impresso no formulário físico do CRV/CRLV
   * (esse provedor não devolve um "número tipográfico" separado; se
   * precisar do número exatamente como está no papel, prefira o de
   * ConsultaAvancada quando disponível). */
  numeroSequencialDocumento?: string;
  /** Código de segurança do CRV/CRLV. */
  codigoSegurancaCrv?: string;
  /** Situação do chassi (código do provedor, ex: "N" = normal). */
  situacaoChassi?: string;
  fipe: { codigo?: string; descricao?: string; anoModelo?: number; valor: number } | null;
  restricoes: string[];
  indicadores: {
    rouboFurto: boolean;
    restricaoJudicial: boolean;
    multa: boolean;
  };
};

export function formatCnpj(cnpj: string) {
  const digits = cnpj.replace(/\D/g, "");
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export type ConsultaVeiculoResult =
  | { ok: true; data: VeiculoReal }
  | { ok: false; errorMessage: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeVeiculo(raw: any): VeiculoReal {
  const v = raw?.dados?.veiculo || {};

  const restricoes: string[] = [];
  for (const key of ["restricao_1", "restricao_2", "restricao_3", "restricao_4"]) {
    const r = v?.restricoes?.[key];
    if (r?.codigo && r.codigo !== "0" && r.descricao) restricoes.push(r.descricao);
  }

  const fipeValor = v?.fipe?.valor_medio ? Number(v.fipe.valor_medio) : undefined;

  const quilometragem: LeituraQuilometragem[] = Array.isArray(v?.quilometragem)
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      v.quilometragem.map((k: any) => ({
        km: Number(k?.km ?? 0),
        data: k?.data_registro || undefined,
        origem: k?.origem || undefined,
        municipio: k?.cidade || undefined,
        uf: k?.uf || undefined,
      }))
    : [];

  return {
    placa: v.placa || raw?.dados?.placa_consulta || "",
    placaAnterior: v.placa_anterior || undefined,
    placaMercosul: v.placa_mercosul || undefined,
    chassi: v.chassi || undefined,
    renavam: v.renavam || undefined,
    marca: v.marca_modelo?.marca?.nome || undefined,
    modelo: v.marca_modelo?.modelo || undefined,
    anoFabricacao: v.ano_fabricacao ? Number(v.ano_fabricacao) : undefined,
    anoModelo: v.ano_modelo ? Number(v.ano_modelo) : undefined,
    cor: v.cor?.descricao || undefined,
    combustivel: v.combustivel?.descricao || undefined,
    municipio: v.municipio?.nome || undefined,
    uf: v.municipio?.uf || v.uf_placa || undefined,
    situacaoVeiculo: v.situacao_veiculo?.descricao || undefined,
    tipoVeiculo: v.tipo_veiculo?.descricao || undefined,
    especie: v.especie?.descricao || undefined,
    carroceria: v.carroceria?.descricao || undefined,
    categoria: v.categoria || undefined,
    nacionalidade: v.nacionalidade?.descricao || undefined,
    tipoMontagem: v.tipo_montagem?.descricao || undefined,
    motor: v.motor || undefined,
    potencia: v.potencia || undefined,
    cilindradas: v.cilindradas || undefined,
    eixos: v.eixos || undefined,
    lotacao: v.lotacao || undefined,
    pesoBrutoTotal: v.peso_bruto_total || undefined,
    capacidadeCarga: v.capacidade_carga || undefined,
    capMaximaTracao: v.cap_maxima_tracao || undefined,
    anoUltimoLicenciamento: v.datas?.ano_ultimo_licenciamento || undefined,
    dataEmplacamento: v.datas?.emplacamento || undefined,
    dataUltimaAtualizacao: v.datas?.ultima_atualizacao || undefined,
    quilometragem,
    proprietarioNome: v.proprietario_atual?.nome || undefined,
    // O provedor não é consistente no valor de "tipo" entre os campos da
    // mesma resposta — em proprietario_atual vem "CNPJ"/"CPF", já em
    // doc_faturado vem "Juridica"/"Fisica". Aceita as duas variações, mas
    // sempre confirma pelo tamanho do documento (14 dígitos = CNPJ) antes
    // de liberar — nunca confia só no rótulo "tipo" pra não vazar CPF.
    proprietarioCnpj: (() => {
      const tipo = String(v.proprietario_atual?.tipo || "").toUpperCase();
      const ehJuridica = tipo === "CNPJ" || tipo === "JURIDICA";
      const documento = String(v.proprietario_atual?.cpf_cnpj || "").replace(/\D/g, "");
      return ehJuridica && documento.length === 14 ? documento : undefined;
    })(),
    cnpjFaturado:
      v.doc_faturado?.tipo?.descricao === "Juridica"
        ? v.doc_faturado?.documento || undefined
        : undefined,
    numeroSequencialDocumento: v.indicadores?.sequencial_documento || undefined,
    codigoSegurancaCrv: v.indicadores?.codigo_seguranca_crv || undefined,
    situacaoChassi: v.situacao_chassi || undefined,
    fipe:
      fipeValor !== undefined
        ? {
            codigo: v.fipe?.codigo || undefined,
            descricao: v.fipe?.descricao || undefined,
            anoModelo: v.fipe?.ano_modelo ? Number(v.fipe.ano_modelo) : undefined,
            valor: fipeValor,
          }
        : null,
    restricoes,
    indicadores: {
      rouboFurto: Boolean(v.indicadores?.roubo_furto),
      restricaoJudicial: Boolean(v.indicadores?.restricao_judicial),
      multa: Boolean(v.indicadores?.multa),
    },
  };
}

export async function consultarVeiculoPorPlaca(
  placa: string
): Promise<ConsultaVeiculoResult> {
  if (!token) {
    return { ok: false, errorMessage: "PLACA_API_TOKEN não configurado" };
  }

  const url = new URL(BASE_URL);
  url.searchParams.set("token", token);
  url.searchParams.set("modulo", "veicular_db_serpro");
  url.searchParams.set("parametro", placa);

  const response = await fetch(url.toString());
  const json = await response.json().catch(() => null);

  if (!response.ok) {
    return { ok: false, errorMessage: `Consulta falhou (HTTP ${response.status}).` };
  }
  if (json?.status !== "sucesso" || !json?.dados?.encontrado) {
    return { ok: false, errorMessage: "Veículo não encontrado para essa placa." };
  }

  // A partir daqui só trafega o resultado já filtrado por sanitizeVeiculo —
  // o payload bruto (que inclui CPF, nome da mãe, endereço, telefone,
  // e-mail e dados de birô de crédito do proprietário) não é retornado,
  // logado nem armazenado.
  return { ok: true, data: sanitizeVeiculo(json) };
}
