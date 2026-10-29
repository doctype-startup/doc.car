/** Cliente dedicado pro endpoint "Contatos por Placa" (tipo
 * "endereco-telefone-por-placa") da API Brasil. Diferente do resto de
 * lib/consultas-avulsas.ts — que trata ~30 serviços de forma genérica —,
 * este arquivo encapsula as armadilhas específicas desse endpoint
 * (erro no corpo com HTTP 200, balance/tax em string BR, 402 terminal,
 * retry só em falha repetível) num cliente isolado e testável.
 *
 * Referência: https://gateway.apibrasil.io/api/v2/consulta/veiculos/credits
 */

const URL_CONSULTA = "https://gateway.apibrasil.io/api/v2/consulta/veiculos/credits";

// ---------------------------------------------------------------------------
// Tipos do corpo da requisição
// ---------------------------------------------------------------------------

export type ContatosPorPlacaRequisicao = {
  placa: string;
  /** Se omitido, usa o padrão configurado no cliente (ver
   * ContatosPorPlacaClienteConfig.homologPadrao). */
  homolog?: boolean;
};

type ContatosPorPlacaCorpoRequisicao = {
  tipo: "endereco-telefone-por-placa";
  placa: string;
  homolog: boolean;
};

// ---------------------------------------------------------------------------
// Tipos da resposta — gerados a partir do exemplo real publicado no catálogo
// ---------------------------------------------------------------------------

type StatusRetorno = {
  codigo: string;
  descricao: string;
};

type EnderecoRegistro = {
  bairro: string;
  cep: string;
  cidade: string;
  cod_identificacao_endereco: string;
  complemento: string;
  documento: string;
  endereco: string;
  latitude: string;
  longitude: string;
  numero: string;
  pontuacao: string;
  tipo_pessoa: string;
  uf: string;
};

type TelefoneRegistro = {
  bairro: string;
  cep: string;
  cidade: string;
  complemento: string;
  ddd: string;
  documento: string;
  endereco: string;
  nascimento: string;
  nome: string;
  nome_mae: string;
  num_telefone: string;
  numero: string;
  obito: string;
  sexo: string;
  tipo_pessoa: string;
  uf: string;
};

type DadosReceitaFederal = {
  atividade_economica_principal: string;
  data_atualizacao: string;
  data_nascimento_fundacao: string;
  email: string;
  natureza_juridica: string;
  nome: string;
  nome_mae: string;
  razao_social: string;
  sexo: string;
  situacao_receita: string;
  status_retorno: StatusRetorno;
  tipo_pessoa: string;
};

type CredCadastral = {
  dados_receita_federal: DadosReceitaFederal;
  emails: {
    registro_localizado: string;
    status_retorno: StatusRetorno;
  };
  somente_endereco: {
    dados: EnderecoRegistro[];
    registro_localizado: string;
    status_retorno: StatusRetorno;
  };
  telefone_celular: {
    registro_localizado: string;
    status_retorno: StatusRetorno;
    telefones: TelefoneRegistro[];
  };
  telefone_fixo: {
    registro_localizado: string;
    status_retorno: StatusRetorno;
    telefones: TelefoneRegistro[];
  };
};

type ProprietarioAtualVeiculo = {
  ano_fabricacao: string;
  ano_modelo: string;
  chassi: string;
  combustivel: string;
  cor_veiculo: string;
  crlv: string;
  data_atualizacao: string;
  marca_modelo: string;
  motor: string;
  municipio: string;
  placa: string;
  proprietario_documento: string;
  proprietario_nome: string;
  renavam: string;
  status_retorno: StatusRetorno;
  uf: string;
};

export type ContatosPorPlacaDados = {
  credcadastral: CredCadastral;
  tipo: "endereco-telefone-por-placa";
  veicular: {
    proprietario_atual_veiculo: ProprietarioAtualVeiculo;
  };
};

type ApiBrasilUsuario = {
  first_name: string;
  email: string;
  cellphone: string;
  notification: string;
};

/** Cobrança de serviço adicional pedido no corpo — a especificação só
 * descreve isso em texto ("cada um com o preço e um total que não está
 * incluso no valor base"), sem exemplo de JSON. Modelado da forma mais
 * conservadora possível: ajuste se a forma real divergir. */
export type ContatosPorPlacaCobrancaExtra = {
  nome: string;
  preco: string;
};

export type ContatosPorPlacaExtraCharges = {
  itens?: ContatosPorPlacaCobrancaExtra[];
  total: string;
};

export type ContatosPorPlacaResposta = {
  user: ApiBrasilUsuario;
  /** Saldo restante da conta — string em formato BR ("154,380",
   * "497,84"...), nunca number. Use parseValorBr pra converter. */
  balance: string;
  balance_before: string;
  /** O que esta consulta específica custou — mesma ressalva do balance. */
  tax: string;
  status_code: number;
  error: boolean;
  message: string;
  valor_consulta: number;
  api_limit_for: string;
  homolog: boolean;
  data: ContatosPorPlacaDados;
  extra_charges?: ContatosPorPlacaExtraCharges;
};

// ---------------------------------------------------------------------------
// Conversor de número em formato BR — "154,380" / "497,84" / "0.19" etc.
// ---------------------------------------------------------------------------

/** Converte um valor monetário em formato BR (vírgula decimal, ex:
 * "154,380", "0,000") ou já em formato com ponto (ex: "0.19" — o catálogo
 * não é consistente entre produtos) pra number. NaN se não der pra
 * interpretar. Nunca use balance/tax numa decisão financeira sem passar
 * por aqui primeiro. */
export function parseValorBr(valor: string): number {
  const texto = valor.trim();
  if (!texto) return NaN;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isNaN(numero) ? NaN : numero;
}

// ---------------------------------------------------------------------------
// Erros
// ---------------------------------------------------------------------------

/** Erro vindo da API Brasil (ou de falha ao contatá-la) — carrega a
 * mensagem original e o status HTTP (0 quando a falha foi de rede/timeout,
 * sem resposta HTTP nenhuma). Todo erro lançado por
 * ContatosPorPlacaCliente.consultar é instância desta classe (ou de
 * SaldoInsuficienteErro, que a estende). */
export class ApiBrasilErro extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiBrasilErro";
    this.status = status;
  }
}

/** HTTP 402 — saldo insuficiente. Terminal: repetir a chamada não resolve,
 * só recarregar o saldo. Tratado à parte de qualquer outro erro 4xx. */
export class SaldoInsuficienteErro extends ApiBrasilErro {
  constructor(message: string) {
    super(message, 402);
    this.name = "SaldoInsuficienteErro";
  }
}

/** Erro interno de controle de retry — nunca escapa de
 * ContatosPorPlacaCliente.consultar. Carrega o ApiBrasilErro real que deve
 * ser lançado se as tentativas se esgotarem. */
class TentativaRepetivelErro extends Error {
  readonly erroReal: ApiBrasilErro;

  constructor(erroReal: ApiBrasilErro) {
    super(erroReal.message);
    this.name = "TentativaRepetivelErro";
    this.erroReal = erroReal;
  }
}

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 1s, 2s, 4s, teto de 8s — recuo exponencial simples. */
function backoffMs(tentativa: number): number {
  return Math.min(1000 * 2 ** (tentativa - 1), 8000);
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------

export type ContatosPorPlacaClienteConfig = {
  /** Vem de variável de ambiente no ponto de montagem (ver
   * criarContatosPorPlacaClientePadrao) — nunca hardcoded aqui. */
  token: string;
  /** Default do modo de homologação quando a chamada não especifica. Ligue
   * por padrão em desenvolvimento — uma suíte de testes rodando contra
   * produção gasta saldo real a cada execução. */
  homologPadrao: boolean;
  /** Entre 10_000 e 30_000. Default: 20_000. */
  timeoutMs?: number;
  /** Tentativas totais (1 = sem retry). Default: 3. */
  maxTentativas?: number;
  /** Injetável pra teste — default: fetch global. */
  fetchImpl?: typeof fetch;
};

export class ContatosPorPlacaCliente {
  private readonly token: string;
  private readonly homologPadrao: boolean;
  private readonly timeoutMs: number;
  private readonly maxTentativas: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: ContatosPorPlacaClienteConfig) {
    if (!config.token) {
      throw new Error("ContatosPorPlacaClienteConfig.token é obrigatório");
    }

    const timeoutMs = config.timeoutMs ?? 20_000;
    if (timeoutMs < 10_000 || timeoutMs > 30_000) {
      throw new Error("ContatosPorPlacaClienteConfig.timeoutMs deve estar entre 10000 e 30000 ms");
    }

    this.token = config.token;
    this.homologPadrao = config.homologPadrao;
    this.timeoutMs = timeoutMs;
    this.maxTentativas = config.maxTentativas ?? 3;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /** Consulta contatos (e-mail, telefones, endereços) e dados veiculares
   * básicos por placa. Repete automaticamente só timeout/5xx (recuo
   * exponencial, até maxTentativas); 4xx — incluindo 402 — nunca repete. */
  async consultar(requisicao: ContatosPorPlacaRequisicao): Promise<ContatosPorPlacaResposta> {
    const corpo: ContatosPorPlacaCorpoRequisicao = {
      tipo: "endereco-telefone-por-placa",
      placa: requisicao.placa,
      homolog: requisicao.homolog ?? this.homologPadrao,
    };

    for (let tentativa = 1; tentativa <= this.maxTentativas; tentativa++) {
      try {
        return await this.executarUmaTentativa(corpo);
      } catch (err) {
        if (!(err instanceof TentativaRepetivelErro)) throw err;
        if (tentativa === this.maxTentativas) throw err.erroReal;
        await aguardar(backoffMs(tentativa));
      }
    }

    // Inalcançável — o loop acima sempre retorna ou lança antes de sair.
    throw new ApiBrasilErro("Número de tentativas esgotado.", 0);
  }

  private async executarUmaTentativa(
    corpo: ContatosPorPlacaCorpoRequisicao
  ): Promise<ContatosPorPlacaResposta> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(URL_CONSULTA, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify(corpo),
        signal: controller.signal,
      });
    } catch (err) {
      const timeoutExcedido = err instanceof Error && err.name === "AbortError";
      const mensagem = timeoutExcedido
        ? `Tempo-limite de ${this.timeoutMs}ms excedido.`
        : err instanceof Error
          ? err.message
          : "Falha de rede desconhecida.";
      // Status 0: não houve resposta HTTP nenhuma. Sempre repetível.
      throw new TentativaRepetivelErro(new ApiBrasilErro(mensagem, 0));
    } finally {
      clearTimeout(timeout);
    }

    // Etapa 1: status HTTP.
    if (response.status === 402) {
      const payload = await response.json().catch(() => null);
      throw new SaldoInsuficienteErro(payload?.message || "Saldo insuficiente.");
    }

    if (response.status >= 500) {
      const payload = await response.json().catch(() => null);
      throw new TentativaRepetivelErro(
        new ApiBrasilErro(
          payload?.message || `Erro do servidor (HTTP ${response.status}).`,
          response.status
        )
      );
    }

    if (!response.ok) {
      // 4xx que não é 402 — nunca repete.
      const payload = await response.json().catch(() => null);
      throw new ApiBrasilErro(payload?.message || `HTTP ${response.status}.`, response.status);
    }

    let payload: ContatosPorPlacaResposta;
    try {
      payload = (await response.json()) as ContatosPorPlacaResposta;
    } catch {
      throw new ApiBrasilErro("Resposta da API Brasil não é um JSON válido.", response.status);
    }

    // Etapa 2: HTTP 200 não garante sucesso — o erro real vem no corpo.
    if (payload.error) {
      throw new ApiBrasilErro(payload.message || "Consulta falhou.", response.status);
    }

    return payload;
  }
}

// ---------------------------------------------------------------------------
// Fábrica padrão — único lugar que lê variáveis de ambiente
// ---------------------------------------------------------------------------

function resolverHomologPadrao(): boolean {
  const flag = process.env.APIBRASIL_HOMOLOG;
  if (flag === "true") return true;
  if (flag === "false") return false;
  // Sem flag explícita: liga em qualquer ambiente que não seja produção.
  return process.env.NODE_ENV !== "production";
}

/** Monta o cliente lendo token e flag de homologação das variáveis de
 * ambiente — mesmo APIBRASIL_TOKEN usado no resto do app (lib/crlv.ts,
 * lib/consultas-avulsas.ts etc.). */
export function criarContatosPorPlacaClientePadrao(): ContatosPorPlacaCliente {
  return new ContatosPorPlacaCliente({
    token: process.env.APIBRASIL_TOKEN || "",
    homologPadrao: resolverHomologPadrao(),
  });
}
