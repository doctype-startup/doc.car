const token = process.env.PLACA_API_TOKEN || "";

export const isPlacaApiConfigured = Boolean(token);

const BASE_URL = "https://uriahahahaplaca.processalead.site/public/proxy.php";

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
  /** Só o nome do proprietário atual — CPF, nome da mãe, endereço, telefone,
   * e-mail e qualquer outro dado pessoal do bloco `dados_credfy` do provedor
   * são descartados aqui e nunca saem desta função. */
  proprietarioNome?: string;
  /** CNPJ do proprietário, só quando ele é pessoa jurídica (frota, locadora,
   * concessionária). CNPJ é registro público de empresa, não dado pessoal
   * protegido pela LGPD como o CPF — por isso, ao contrário do CPF, este
   * campo é liberado. Nunca populado quando o proprietário é pessoa física. */
  proprietarioCnpj?: string;
  fipe: { descricao?: string; valor: number } | null;
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
    proprietarioNome: v.proprietario_atual?.nome || undefined,
    proprietarioCnpj:
      v.proprietario_atual?.tipo === "Juridica"
        ? v.proprietario_atual?.cpf_cnpj || undefined
        : undefined,
    fipe:
      fipeValor !== undefined
        ? { descricao: v.fipe?.descricao || undefined, valor: fipeValor }
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
