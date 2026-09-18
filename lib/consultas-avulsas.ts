import { isApiBrasilConfigured, URL_CONSULTA_VEICULOS } from "@/lib/crlv";

export { isApiBrasilConfigured };

const token = process.env.APIBRASIL_TOKEN || "";

export type GrupoConsultaAvulsa = "simples" | "avancada";

export type ConsultaAvulsaServico = {
  id: string;
  nome: string;
  grupo: GrupoConsultaAvulsa;
  /** Valor do campo "tipo" no corpo da requisição pra API Brasil — mesmo
   * gateway de lib/crlv.ts, lib/proprietario.ts e lib/rntrc.ts, cada
   * serviço só muda esse campo. */
  tipoApi: string;
  precoCentavos: number;
};

/** Registro central dos serviços do menu "Consultas Avulsas" — cada um
 * bate no mesmo endpoint da API Brasil, só o campo "tipo" muda. Adicionar
 * um serviço novo é só acrescentar uma linha aqui; a rota
 * (app/api/consultas-avulsas) e a página (app/dashboard/consultas-avulsas)
 * são genéricas e servem qualquer item dessa lista. */
export const CONSULTAS_AVULSAS: ConsultaAvulsaServico[] = [
  {
    id: "agregados-basica",
    nome: "Agregados Básica",
    grupo: "simples",
    tipoApi: "agregados-basica",
    precoCentavos: 120,
  },
  {
    id: "agregados-renavam",
    nome: "Agregados Renavam",
    grupo: "avancada",
    tipoApi: "agregados-renavam",
    precoCentavos: 420,
  },
  {
    id: "agregados-simples",
    nome: "Agregados Simples",
    grupo: "simples",
    tipoApi: "agregados-simples",
    precoCentavos: 190,
  },
];

export function getConsultaAvulsaPorId(id: string | null | undefined) {
  if (!id) return undefined;
  return CONSULTAS_AVULSAS.find((servico) => servico.id === id);
}

export function getConsultasAvulsasPorGrupo(grupo: GrupoConsultaAvulsa) {
  return CONSULTAS_AVULSAS.filter((servico) => servico.grupo === grupo);
}

/** Deixa a chave da API (snake_case) mais legível pra exibição genérica —
 * cada serviço tem um formato de resposta diferente, então a ficha não tem
 * como ter um label específico por campo (ao contrário das consultas já
 * sanitizadas de lib/dados-veiculo.ts e lib/proprietario.ts). */
export function formatarLabelAvulsa(chave: string) {
  return chave.replace(/_/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

export function formatarValorAvulsa(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (Array.isArray(valor)) {
    return valor.length > 0 ? valor.map((item) => formatarValorAvulsa(item)).join(", ") : "—";
  }
  if (typeof valor === "object") {
    return Object.entries(valor as Record<string, unknown>)
      .map(([chave, item]) => `${formatarLabelAvulsa(chave)}: ${formatarValorAvulsa(item)}`)
      .join(" · ");
  }
  return String(valor);
}

export type ResultadoConsultaAvulsa =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errorMessage: string };

/** Chama a API Brasil pro tipo de consulta avulsa pedido. Cada serviço
 * devolve um formato de resposta diferente — ao contrário de
 * lib/dados-veiculo.ts e lib/proprietario.ts, não há sanitização/tipagem
 * individual por serviço aqui (inviável pra ~30 serviços), então a ficha
 * exibida é genérica (ver app/dashboard/consultas-avulsas/[servico]). */
export async function consultarAvulsa(
  tipoApi: string,
  placa: string
): Promise<ResultadoConsultaAvulsa> {
  if (!token) {
    return { ok: false, errorMessage: "APIBRASIL_TOKEN não configurado" };
  }

  const response = await fetch(URL_CONSULTA_VEICULOS, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tipo: tipoApi, placa, homolog: false }),
  });

  const json = await response.json().catch(() => null);

  if (!response.ok || json?.error) {
    console.error(
      `[consultas-avulsas] falha (tipo=${tipoApi}, placa=${placa}, http=${response.status}): ${JSON.stringify(json)}`
    );
    return {
      ok: false,
      errorMessage:
        json?.data?.detail || json?.message || `Consulta falhou (HTTP ${response.status}).`,
    };
  }

  return { ok: true, data: json?.data ?? {} };
}
