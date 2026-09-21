import { isApiBrasilConfigured, mensagemSeguraApiBrasil, URL_CONSULTA_VEICULOS } from "@/lib/crlv";
import { PRECO_AVULSO_SIMPLES_CENTAVOS } from "@/lib/plans";

export const isPlacaApiConfigured = isApiBrasilConfigured;

const token = process.env.APIBRASIL_TOKEN || "";

/** Fornecedor alternativo (wdapi2.com.br, revendido também como
 * placas.com.br/apiplacas.com.br) — só entra em ação quando a API Brasil
 * falha de verdade (motivo "http": fora do ar, sem saldo etc), nunca
 * quando ela só responde "essa placa não existe" (motivo "nao_encontrado",
 * que já é uma resposta válida). Token opcional: sem ele, o fallback é
 * simplesmente pulado e o comportamento fica igual ao de antes. */
const wdapi2Token = process.env.WDAPI2_TOKEN || "";
const URL_WDAPI2 = "https://wdapi2.com.br/consulta";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Mensagem de saldo insuficiente mostrada ao cliente quando a API Brasil
 * recusa a consulta por saldo — usa o preço avulso real cobrado do
 * cliente (não o custo interno de fornecedor, que mensagemSeguraApiBrasil
 * já filtra da resposta crua). */
const MENSAGEM_SALDO_INSUFICIENTE_SIMPLES = `Saldo insuficiente para realizar a consulta! Valor da consulta: ${currency.format(
  PRECO_AVULSO_SIMPLES_CENTAVOS / 100
)}!`;

export type LeituraQuilometragem = {
  km: number;
  data?: string;
  origem?: string;
  municipio?: string;
  uf?: string;
};

export type EnderecoProprietario = {
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
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
  crlv?: string;
  /** Histórico de leituras de odômetro (ex: anúncios em portais de venda) —
   * dado do veículo, não de pessoa. */
  quilometragem: LeituraQuilometragem[];
  /** Dossiê pessoal completo do proprietário atual, incluindo CPF, nome da
   * mãe, dados da Receita Federal, telefones, e-mails e endereços —
   * decisão deliberada do produto de trazer tudo que a API Brasil devolve
   * nessa consulta (tipo "endereco-telefone-por-placa"), sem reconfirmação
   * nem auditoria própria (diferente da aba CRM, que expõe dado parecido
   * atrás desses dois controles — ver app/api/crm/proprietario). */
  proprietarioNome?: string;
  /** Documento do proprietário como veio do provedor, já formatado
   * (ex: "012.345.678-90" ou CNPJ). Prefira proprietarioCpf/proprietarioCnpj
   * quando precisar só dos dígitos por tipo de pessoa. */
  proprietarioDocumento?: string;
  proprietarioCpf?: string;
  proprietarioCnpj?: string;
  proprietarioNomeMae?: string;
  proprietarioSexo?: string;
  proprietarioDataNascimentoFundacao?: string;
  proprietarioSituacaoReceita?: string;
  proprietarioTipoPessoa?: string;
  proprietarioEmails?: string[];
  proprietarioTelefonesCelular?: string[];
  proprietarioTelefonesFixo?: string[];
  proprietarioEnderecos?: EnderecoProprietario[];
  /** CNPJ de quem faturou o veículo originalmente (concessionária/locadora)
   * — não devolvido por esse provedor, mantido opcional só pra não quebrar
   * telas que já checam a presença dele. */
  cnpjFaturado?: string;
  /** Número sequencial interno do documento no sistema do provedor — não
   * devolvido por esse provedor. */
  numeroSequencialDocumento?: string;
  /** Código de segurança do CRV/CRLV — não devolvido por esse provedor. */
  codigoSegurancaCrv?: string;
  /** Situação do chassi — não devolvido por esse provedor. */
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

export function formatCpf(cpf: string) {
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export type ConsultaVeiculoResult =
  | { ok: true; data: VeiculoReal }
  | {
      ok: false;
      /** "http" = o provedor não respondeu corretamente (fora do ar,
       * timeout, erro) — sinal real de indisponibilidade. "nao_encontrado"
       * = o provedor respondeu normalmente, só não tem essa placa — não é
       * indisponibilidade, é resultado normal de uma consulta. */
      motivo: "http" | "nao_encontrado";
      errorMessage: string;
    };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function listaTelefones(bloco: any): string[] {
  if (!Array.isArray(bloco?.telefones)) return [];
  return bloco.telefones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((t: any) => [t?.ddd, t?.num_telefone].filter(Boolean).join(" "))
    .filter((numero: string) => numero.trim().length > 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function listaEmails(bloco: any): string[] {
  if (!Array.isArray(bloco?.dados)) return [];
  return bloco.dados
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((registro: any) => registro?.email || registro?.endereco_email)
    .filter(Boolean);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeVeiculo(raw: any, placaConsultada: string): VeiculoReal {
  const v = raw?.veicular?.proprietario_atual_veiculo || {};
  const cred = raw?.credcadastral || {};
  const receita = cred?.dados_receita_federal || {};

  const [marca, ...modeloPartes] = String(v.marca_modelo || "").split("/");
  const modelo = modeloPartes.join("/").trim();

  const documento = String(v.proprietario_documento || "").replace(/\D/g, "");

  const enderecos: EnderecoProprietario[] = Array.isArray(cred?.somente_endereco?.dados)
    ? cred.somente_endereco.dados.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (e: any) => ({
          endereco: e?.endereco || undefined,
          numero: e?.numero || undefined,
          complemento: e?.complemento || undefined,
          bairro: e?.bairro || undefined,
          cidade: e?.cidade || undefined,
          uf: e?.uf || undefined,
          cep: e?.cep || undefined,
        })
      )
    : [];

  return {
    placa: v.placa || placaConsultada,
    chassi: v.chassi || undefined,
    renavam: v.renavam || undefined,
    marca: marca?.trim() || undefined,
    modelo: modelo || undefined,
    anoFabricacao: v.ano_fabricacao ? Number(v.ano_fabricacao) : undefined,
    anoModelo: v.ano_modelo ? Number(v.ano_modelo) : undefined,
    cor: v.cor_veiculo || undefined,
    combustivel: v.combustivel || undefined,
    municipio: v.municipio || undefined,
    uf: v.uf || undefined,
    motor: v.motor || undefined,
    crlv: v.crlv || undefined,
    dataUltimaAtualizacao: v.data_atualizacao || undefined,
    quilometragem: [],
    fipe: null,
    restricoes: [],
    indicadores: { rouboFurto: false, restricaoJudicial: false, multa: false },
    proprietarioNome: v.proprietario_nome || undefined,
    proprietarioDocumento: v.proprietario_documento || undefined,
    proprietarioCpf: documento.length === 11 ? documento : undefined,
    proprietarioCnpj: documento.length === 14 ? documento : undefined,
    proprietarioNomeMae: receita.nome_mae || undefined,
    proprietarioSexo: receita.sexo || undefined,
    proprietarioDataNascimentoFundacao: receita.data_nascimento_fundacao || undefined,
    proprietarioSituacaoReceita: receita.situacao_receita || undefined,
    proprietarioTipoPessoa: receita.tipo_pessoa || undefined,
    proprietarioEmails: listaEmails(cred?.emails),
    proprietarioTelefonesCelular: listaTelefones(cred?.telefone_celular),
    proprietarioTelefonesFixo: listaTelefones(cred?.telefone_fixo),
    proprietarioEnderecos: enderecos,
  };
}

/** "R$ 28.799,00" → 28799 — a WDAPI2 só manda o valor FIPE como texto
 * formatado (o "id_valor" numérico ao lado é um código interno da tabela,
 * não o preço em reais). */
function parseValorFipe(texto: unknown): number {
  if (typeof texto !== "string") return 0;
  const numero = Number(texto.replace(/[^\d,]/g, "").replace(",", "."));
  return Number.isFinite(numero) ? numero : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sanitizeVeiculoWdapi2(raw: any, placaConsultada: string): VeiculoReal {
  const extra = raw?.extra || {};
  const fipeDados = raw?.fipe?.dados?.[0];

  return {
    placa: raw?.placa || placaConsultada,
    // Vem parcialmente mascarado ("*****10137") direto do fornecedor —
    // exibido como o provedor manda, sem tentar completar os dígitos.
    chassi: raw?.chassi || undefined,
    marca: raw?.marca || raw?.MARCA || undefined,
    modelo: raw?.modelo || raw?.MODELO || undefined,
    anoFabricacao: extra.ano_fabricacao ? Number(extra.ano_fabricacao) : undefined,
    anoModelo: raw?.anoModelo ? Number(raw.anoModelo) : undefined,
    cor: raw?.cor || undefined,
    combustivel: extra.combustivel || undefined,
    municipio: raw?.municipio || undefined,
    uf: raw?.uf || undefined,
    situacaoVeiculo: raw?.situacao || undefined,
    tipoVeiculo: extra.tipo_veiculo || undefined,
    especie: extra.especie || undefined,
    carroceria: extra.carroceria || undefined,
    nacionalidade: extra.nacionalidade || undefined,
    tipoMontagem: extra.tipo_montagem || undefined,
    cilindradas: extra.cilindradas || undefined,
    eixos: extra.eixos || undefined,
    lotacao: extra.quantidade_passageiro || undefined,
    pesoBrutoTotal: extra.peso_bruto_total || undefined,
    capMaximaTracao: extra.cap_maxima_tracao || undefined,
    dataUltimaAtualizacao: raw?.data || undefined,
    quilometragem: [],
    restricoes: [],
    indicadores: { rouboFurto: false, restricaoJudicial: false, multa: false },
    fipe: fipeDados
      ? {
          codigo: fipeDados.codigo_fipe || undefined,
          descricao: fipeDados.texto_modelo || undefined,
          anoModelo: fipeDados.ano_modelo ? Number(fipeDados.ano_modelo) : undefined,
          valor: parseValorFipe(fipeDados.texto_valor),
        }
      : null,
    // Esse fornecedor não devolve dado do proprietário (nome, documento,
    // contatos) — só dados do veículo. Os campos proprietario* ficam
    // undefined, igual a uma consulta da API Brasil que não os retornasse.
  };
}

async function buscarWdapi2(placa: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    return await fetch(`${URL_WDAPI2}/${encodeURIComponent(placa)}/${wdapi2Token}`, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/** Só chamado quando a API Brasil falhou de verdade (motivo "http") — ver
 * consultarVeiculoPorPlaca. Não expõe o motivo da falha da WDAPI2 pro
 * cliente (poderia vazar token/saldo, igual ao que mensagemSeguraApiBrasil
 * já filtra da API Brasil); se também falhar, quem chama mantém o erro
 * original da API Brasil, que já é seguro. */
async function tentarFallbackWdapi2(placa: string): Promise<VeiculoReal | null> {
  if (!wdapi2Token) return null;

  try {
    const response = await buscarWdapi2(placa);
    const json = await response.json().catch(() => null);

    if (!response.ok || !json || (!json.marca && !json.MARCA)) {
      console.error(
        `[dados-veiculo] fallback wdapi2 falhou (placa=${placa}, http=${response.status}): ${JSON.stringify(json)}`
      );
      return null;
    }

    return sanitizeVeiculoWdapi2(json, placa);
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[dados-veiculo] fallback wdapi2 indisponível (placa=${placa}): ${message}`);
    return null;
  }
}

export async function consultarVeiculoPorPlaca(
  placa: string
): Promise<ConsultaVeiculoResult> {
  if (!token) {
    return { ok: false, motivo: "http", errorMessage: "APIBRASIL_TOKEN não configurado" };
  }

  const response = await fetch(URL_CONSULTA_VEICULOS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tipo: "endereco-telefone-por-placa", placa, homolog: false }),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.error) {
    console.error(
      `[dados-veiculo] falha ao consultar (placa=${placa}, http=${response.status}): ${JSON.stringify(json)}`
    );
    const resultadoApiBrasil: ConsultaVeiculoResult = {
      ok: false,
      motivo: "http",
      errorMessage: mensagemSeguraApiBrasil(
        json?.data?.detail || json?.message || `Consulta falhou (HTTP ${response.status}).`,
        MENSAGEM_SALDO_INSUFICIENTE_SIMPLES
      ),
    };

    const fallback = await tentarFallbackWdapi2(placa);
    if (fallback) {
      console.log(`[dados-veiculo] placa=${placa} atendida pelo fallback wdapi2`);
      return { ok: true, data: fallback };
    }

    return resultadoApiBrasil;
  }

  const veiculo = json?.data?.veicular?.proprietario_atual_veiculo;
  if (!veiculo || veiculo.status_retorno?.codigo !== "1") {
    return {
      ok: false,
      motivo: "nao_encontrado",
      errorMessage: "Veículo não encontrado para essa placa.",
    };
  }

  return { ok: true, data: sanitizeVeiculo(json.data, placa) };
}
