const token = process.env.INFOSIMPLES_TOKEN || "";

export const isInfosimplesConfigured = Boolean(token);

const VEICULO_ENDPOINT = "https://api.infosimples.com/api/v2/consultas/sinesp/veiculo";
const ANTT_MULTAS_ENDPOINT =
  "https://api.infosimples.com/api/v2/consultas/antt/sifama/consultar-multas";

export type InfosimplesResponse = {
  ok: boolean;
  data: unknown;
  errorMessage?: string;
};

export async function consultarVeiculoPorPlaca(
  placa: string
): Promise<InfosimplesResponse> {
  if (!token) {
    return {
      ok: false,
      data: null,
      errorMessage: "INFOSIMPLES_TOKEN não configurado",
    };
  }

  const response = await fetch(VEICULO_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token, placa }),
  });

  const json = await response.json();
  const ok = json?.code === 200;

  return {
    ok,
    data: json,
    errorMessage: ok
      ? undefined
      : json?.code_message || `Infosimples retornou HTTP ${response.status}`,
  };
}

// Consulta multas ANTT (SIFAMA). Ao contrário da consulta de veículo, essa
// exige login próprio no portal SIFAMA da ANTT (CPF ou CNPJ + senha) — só
// retorna multas da transportadora dona do login, não de placas de
// terceiros. Pausada até termos essas credenciais configuradas.
const anttLoginCpf = process.env.INFOSIMPLES_ANTT_LOGIN_CPF || "";
const anttLoginCnpj = process.env.INFOSIMPLES_ANTT_LOGIN_CNPJ || "";
const anttLoginSenha = process.env.INFOSIMPLES_ANTT_LOGIN_SENHA || "";

export const isAnttMultasConfigured = Boolean(
  token && anttLoginSenha && (anttLoginCpf || anttLoginCnpj)
);

export type TipoFiscalizacaoAntt =
  | "1" // Excesso de Peso
  | "2" // Pagamento Eletrônico de Frete (PEF)
  | "3" // RNTRC
  | "4" // SAC TRIP
  | "5" // Transporte Rodoviário de Produtos Perigosos (TRPP)
  | "6" // Transporte Rodoviário Interestadual de Passageiros
  | "7" // Vale Pedágio
  | "8"; // Piso Mínimo de Frete

export async function consultarMultasAntt(
  tipoFiscalizacao: TipoFiscalizacaoAntt,
  placa?: string
): Promise<InfosimplesResponse> {
  if (!isAnttMultasConfigured) {
    return {
      ok: false,
      data: null,
      errorMessage:
        "Consulta de multas ANTT não configurada (falta login do SIFAMA).",
    };
  }

  const params: Record<string, string> = {
    token,
    login_senha: anttLoginSenha,
    tipo_fiscalizacao: tipoFiscalizacao,
  };
  if (anttLoginCnpj) params.login_cnpj = anttLoginCnpj;
  else params.login_cpf = anttLoginCpf;
  if (placa) params.placa = placa;

  const response = await fetch(ANTT_MULTAS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const json = await response.json();
  const ok = json?.code === 200;

  return {
    ok,
    data: json,
    errorMessage: ok
      ? undefined
      : json?.code_message || `Infosimples retornou HTTP ${response.status}`,
  };
}
