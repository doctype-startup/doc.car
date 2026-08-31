export type Plano = {
  id: string;
  nome: string;
  /** Consultas avançadas incluídas por período de cobrança. */
  cota: number;
  /** Consultas simples incluídas por período de cobrança. */
  cotaSimples: number;
  /** Preço mensal, em centavos. */
  precoCentavos: number;
  priceId: string;
};

/** Preço da consulta avançada avulsa, cobrada quando o usuário estoura a
 * cota do plano no período. Em centavos. */
export const PRECO_AVULSO_CENTAVOS = 1690;

/** Preço da consulta simples avulsa, cobrada quando o usuário estoura a
 * cota do plano no período e não tem crédito de recarga disponível. Em
 * centavos. */
export const PRECO_AVULSO_SIMPLES_CENTAVOS = 620;

export const PLANOS: Plano[] = [
  {
    id: "essencial",
    nome: "Essencial",
    cota: 20,
    cotaSimples: 100,
    precoCentavos: 21700,
    priceId: process.env.STRIPE_PRICE_ESSENCIAL || "",
  },
  {
    id: "profissional",
    nome: "Profissional",
    cota: 50,
    cotaSimples: 250,
    precoCentavos: 44700,
    priceId: process.env.STRIPE_PRICE_PROFISSIONAL || "",
  },
  {
    id: "escritorio",
    nome: "Escritório",
    cota: 120,
    cotaSimples: 600,
    precoCentavos: 86760,
    priceId: process.env.STRIPE_PRICE_ESCRITORIO || "",
  },
];

export type PacoteRecarga = {
  id: string;
  /** Créditos de consulta simples concedidos pelo pacote. */
  creditos: number;
  /** Preço do pacote, em centavos. */
  precoCentavos: number;
};

/** Créditos comprados em pacote de recarga ficam disponíveis por esse
 * número de meses a partir da compra (o que vier primeiro entre esse
 * prazo e o cancelamento da assinatura). */
export const CREDITOS_VALIDADE_MESES = 6;

export const PACOTES_RECARGA: PacoteRecarga[] = [
  { id: "recarga-50", creditos: 50, precoCentavos: 26500 },
  { id: "recarga-100", creditos: 100, precoCentavos: 41000 },
];

export function getPacotePorId(id: string | null | undefined): PacoteRecarga | undefined {
  if (!id) return undefined;
  return PACOTES_RECARGA.find((pacote) => pacote.id === id);
}

export function getPlanoPorPriceId(priceId: string | null | undefined): Plano | undefined {
  if (!priceId) return undefined;
  return PLANOS.find((plano) => plano.priceId === priceId);
}

export function getPlanoPorId(id: string | null | undefined): Plano | undefined {
  if (!id) return undefined;
  return PLANOS.find((plano) => plano.id === id);
}
