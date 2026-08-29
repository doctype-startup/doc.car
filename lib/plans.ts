export type Plano = {
  id: string;
  nome: string;
  /** Consultas avançadas incluídas por período de cobrança. */
  cota: number;
  /** Preço mensal, em centavos. */
  precoCentavos: number;
  priceId: string;
};

/** Preço da consulta avançada avulsa, cobrada quando o usuário estoura a
 * cota do plano no período. Em centavos. */
export const PRECO_AVULSO_CENTAVOS = 1680;

export const PLANOS: Plano[] = [
  {
    id: "essencial",
    nome: "Essencial",
    cota: 20,
    precoCentavos: 21700,
    priceId: process.env.STRIPE_PRICE_ESSENCIAL || "",
  },
  {
    id: "profissional",
    nome: "Profissional",
    cota: 50,
    precoCentavos: 44700,
    priceId: process.env.STRIPE_PRICE_PROFISSIONAL || "",
  },
  {
    id: "escritorio",
    nome: "Escritório",
    cota: 120,
    precoCentavos: 86760,
    priceId: process.env.STRIPE_PRICE_ESCRITORIO || "",
  },
];

export function getPlanoPorPriceId(priceId: string | null | undefined): Plano | undefined {
  if (!priceId) return undefined;
  return PLANOS.find((plano) => plano.priceId === priceId);
}

export function getPlanoPorId(id: string | null | undefined): Plano | undefined {
  if (!id) return undefined;
  return PLANOS.find((plano) => plano.id === id);
}
