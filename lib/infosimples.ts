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

export async function consultarMultasAntt(
  placa: string,
  renavam?: string
): Promise<InfosimplesResponse> {
  if (!token) {
    return {
      ok: false,
      data: null,
      errorMessage: "INFOSIMPLES_TOKEN não configurado",
    };
  }

  const params: Record<string, string> = { token, placa };
  if (renavam) params.renavam = renavam;

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
