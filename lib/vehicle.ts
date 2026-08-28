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
  renavam: string;
  chassi: string;
  vencimentoLicenciamento: string;
  licenciamentoEmDia: boolean;
  situacao: "Regular" | "Bloqueado" | "Alienado";
  fipe: {
    codigo: string;
    valor: number;
    mesReferencia: string;
  } | null;
  debitos: {
    tipo: string;
    valor: number;
    vencimento: string;
  }[];
  multas: {
    tipo: string;
    valor: number;
    data: string;
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
  { marca: "Ford", modelo: "Ranger" },
];

const CORES = ["Prata", "Preto", "Branco", "Cinza", "Vermelho", "Azul"];
const MUNICIPIOS = [
  { municipio: "São Paulo", uf: "SP" },
  { municipio: "Belo Horizonte", uf: "MG" },
  { municipio: "Curitiba", uf: "PR" },
  { municipio: "Porto Alegre", uf: "RS" },
  { municipio: "Salvador", uf: "BA" },
  { municipio: "Rio de Janeiro", uf: "RJ" },
];

const MULTAS = [
  { tipo: "Excesso de velocidade - Art. 218/§5", valor: 293.47 },
  { tipo: "Estacionamento proibido - Art. 181/XVII", valor: 130.16 },
  { tipo: "Avanço de sinal vermelho - Art. 208", valor: 293.47 },
];

const CHASSI_CHARS = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789"; // sem I, O, Q (padrão VIN)

function seedFromPlate(placa: string) {
  let seed = 0;
  for (const char of placa) seed += char.charCodeAt(0);
  return seed;
}

function pick<T>(items: T[], seed: number, offset = 0): T {
  return items[(seed + offset) % items.length];
}

function chassiFromSeed(seed: number) {
  let x = (seed * 2654435761) % 2147483647;
  let chassi = "";
  for (let i = 0; i < 17; i++) {
    x = (x * 48271 + i) % 2147483647;
    chassi += CHASSI_CHARS[x % CHASSI_CHARS.length];
  }
  return chassi;
}

function renavamFromSeed(seed: number) {
  const value = (seed * 9973 + 1234567) % 100000000000;
  return String(value).padStart(11, "0");
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
  const hasMulta = seed % 3 === 2;
  const fipeDisponivel = seed % 4 !== 0;
  const diaVencimento = (seed % 28) + 1;
  const mesVencimento = (seed % 12) + 1;
  const anoVencimento = 2026 + (seed % 2);

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
    renavam: renavamFromSeed(seed),
    chassi: chassiFromSeed(seed),
    vencimentoLicenciamento: `${String(diaVencimento).padStart(2, "0")}/${String(mesVencimento).padStart(2, "0")}/${anoVencimento}`,
    licenciamentoEmDia: seed % 5 !== 0,
    situacao: hasRestricao ? "Alienado" : "Regular",
    fipe: fipeDisponivel
      ? {
          codigo: `00${(seed % 900) + 100}-${(seed % 9) + 1}`,
          valor: 42000 + (seed % 60) * 950,
          mesReferencia: "Agosto/2026",
        }
      : null,
    debitos: hasDebitos
      ? [
          { tipo: "IPVA 2026", valor: 890 + (seed % 40) * 12, vencimento: "10/04/2026" },
          { tipo: "Licenciamento", valor: 145.9, vencimento: "10/04/2026" },
        ]
      : [],
    multas: hasMulta
      ? [
          {
            ...pick(MULTAS, seed, 7),
            data: `${String((seed % 27) + 1).padStart(2, "0")}/02/2026`,
          },
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
