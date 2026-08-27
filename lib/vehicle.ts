export type VehicleQuery = {
  placa: string;
  marca: string;
  modelo: string;
  anoFabricacao: number;
  anoModelo: number;
  cor: string;
  combustivel: string;
  municipio: string;
  uf: string;
  situacao: "Regular" | "Bloqueado" | "Alienado";
  fipe: {
    codigo: string;
    valor: number;
    mesReferencia: string;
  };
  debitos: {
    tipo: string;
    valor: number;
    vencimento: string;
  }[];
  restricoes: {
    tipo: string;
    descricao: string;
    grave: boolean;
  }[];
};

const MARCAS = [
  { marca: "Volkswagen", modelo: "Gol 1.6" },
  { marca: "Fiat", modelo: "Argo Drive" },
  { marca: "Chevrolet", modelo: "Onix LT" },
  { marca: "Toyota", modelo: "Corolla XEi" },
  { marca: "Honda", modelo: "Civic EXL" },
  { marca: "Hyundai", modelo: "HB20 Comfort" },
];

const CORES = ["Prata", "Preto", "Branco", "Cinza", "Vermelho", "Azul"];
const MUNICIPIOS = [
  { municipio: "São Paulo", uf: "SP" },
  { municipio: "Belo Horizonte", uf: "MG" },
  { municipio: "Curitiba", uf: "PR" },
  { municipio: "Porto Alegre", uf: "RS" },
  { municipio: "Salvador", uf: "BA" },
];

function seedFromPlate(placa: string) {
  let seed = 0;
  for (const char of placa) seed += char.charCodeAt(0);
  return seed;
}

function pick<T>(items: T[], seed: number, offset = 0): T {
  return items[(seed + offset) % items.length];
}

export function isValidPlaca(placa: string) {
  const clean = placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(clean);
}

export function normalizePlaca(placa: string) {
  return placa.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function lookupVehicle(placaInput: string): VehicleQuery {
  const placa = normalizePlaca(placaInput);
  const seed = seedFromPlate(placa);
  const { marca, modelo } = pick(MARCAS, seed);
  const cor = pick(CORES, seed, 3);
  const { municipio, uf } = pick(MUNICIPIOS, seed, 5);
  const anoFabricacao = 2016 + (seed % 9);
  const hasDebitos = seed % 3 !== 0;
  const hasRestricao = seed % 4 === 0;

  return {
    placa,
    marca,
    modelo,
    anoFabricacao,
    anoModelo: anoFabricacao + (seed % 2),
    cor,
    combustivel: seed % 2 === 0 ? "Flex" : "Gasolina",
    municipio,
    uf,
    situacao: hasRestricao ? "Alienado" : "Regular",
    fipe: {
      codigo: `00${(seed % 900) + 100}-${(seed % 9) + 1}`,
      valor: 42000 + (seed % 60) * 950,
      mesReferencia: "Agosto/2026",
    },
    debitos: hasDebitos
      ? [
          { tipo: "IPVA 2026", valor: 890 + (seed % 40) * 12, vencimento: "10/04/2026" },
          { tipo: "Licenciamento", valor: 145.9, vencimento: "10/04/2026" },
        ]
      : [],
    restricoes: hasRestricao
      ? [
          {
            tipo: "Alienação fiduciária",
            descricao: "Restrição financeira ativa junto ao agente financiador.",
            grave: false,
          },
        ]
      : [],
  };
}
