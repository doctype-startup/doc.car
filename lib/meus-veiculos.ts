import type { SupabaseClient } from "@supabase/supabase-js";

/** Formata CPF (11 dígitos) ou CNPJ (14 dígitos) pra exibição. Diferente do
 * resto do app, aqui CPF é esperado e liberado — o dado é auto-fornecido
 * pelo próprio despachante (cadastro manual ou sessão SENATRAN dele), não
 * uma consulta de terceiro sem relação. */
export function formatarDocumento(documento: string) {
  const digitos = documento.replace(/\D/g, "");
  if (digitos.length === 11) {
    return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digitos.length === 14) {
    return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return documento;
}

export function normalizarPlaca(value: string) {
  const placa = String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(placa)) {
    throw new Error("Placa inválida");
  }
  return placa;
}

export type VeiculoIndicadores = {
  alarme: boolean;
  rouboFurto: boolean;
  comunicacaoVenda: boolean;
  leilao: boolean;
  multaRenainf: boolean;
  pendenciaEmissao: boolean;
  recallMontadora: boolean;
  restricaoRenajud: boolean;
  restricaoPgfn: boolean;
};

export type RestricaoVeiculo = { codigo: string; descricao: string };

export type MeuVeiculo = {
  id: string;
  placa: string;
  renavam?: string;
  chassi?: string;
  marcaModelo?: string;
  anoFabricacao?: number;
  anoModelo?: number;
  cor?: string;
  exercicio?: number;
  categoria?: string;
  combustivel?: string;
  especie?: string;
  tipoVeiculo?: string;
  municipioEmplacamento?: string;
  ufJurisdicao?: string;
  cilindradas?: string;
  lotacao?: string;
  situacao?: string;
  procedencia?: string;
  dataEmissaoCrv?: string;
  proprietarioNome?: string;
  proprietarioDocumento?: string;
  proprietarioTipo?: string;
  indicadores: VeiculoIndicadores;
  restricoes: RestricaoVeiculo[];
  crlvDisponivel: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: any): MeuVeiculo {
  return {
    id: row.id,
    placa: row.placa,
    renavam: row.renavam ?? undefined,
    chassi: row.chassi ?? undefined,
    marcaModelo: row.marca_modelo ?? undefined,
    anoFabricacao: row.ano_fabricacao ?? undefined,
    anoModelo: row.ano_modelo ?? undefined,
    cor: row.cor ?? undefined,
    exercicio: row.exercicio ?? undefined,
    categoria: row.categoria ?? undefined,
    combustivel: row.combustivel ?? undefined,
    especie: row.especie ?? undefined,
    tipoVeiculo: row.tipo_veiculo ?? undefined,
    municipioEmplacamento: row.municipio_emplacamento ?? undefined,
    ufJurisdicao: row.uf_jurisdicao ?? undefined,
    cilindradas: row.cilindradas ?? undefined,
    lotacao: row.lotacao ?? undefined,
    situacao: row.situacao ?? undefined,
    procedencia: row.procedencia ?? undefined,
    dataEmissaoCrv: row.data_emissao_crv ?? undefined,
    proprietarioNome: row.proprietario_nome ?? undefined,
    proprietarioDocumento: row.proprietario_documento ?? undefined,
    proprietarioTipo: row.proprietario_tipo ?? undefined,
    indicadores: {
      alarme: Boolean(row.indicadores?.alarme),
      rouboFurto: Boolean(row.indicadores?.rouboFurto),
      comunicacaoVenda: Boolean(row.indicadores?.comunicacaoVenda),
      leilao: Boolean(row.indicadores?.leilao),
      multaRenainf: Boolean(row.indicadores?.multaRenainf),
      pendenciaEmissao: Boolean(row.indicadores?.pendenciaEmissao),
      recallMontadora: Boolean(row.indicadores?.recallMontadora),
      restricaoRenajud: Boolean(row.indicadores?.restricaoRenajud),
      restricaoPgfn: Boolean(row.indicadores?.restricaoPgfn),
    },
    restricoes: Array.isArray(row.restricoes) ? row.restricoes : [],
    crlvDisponivel: Boolean(row.crlv_storage_path),
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

export async function listarVeiculos(
  supabase: SupabaseClient,
  userId: string
): Promise<MeuVeiculo[]> {
  const { data, error } = await supabase
    .from("meus_veiculos")
    .select("*")
    .eq("user_id", userId)
    .order("atualizado_em", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function obterVeiculo(
  supabase: SupabaseClient,
  userId: string,
  placa: string
): Promise<MeuVeiculo | null> {
  const normalizada = normalizarPlaca(placa);
  const { data, error } = await supabase
    .from("meus_veiculos")
    .select("*")
    .eq("user_id", userId)
    .eq("placa", normalizada)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data) : null;
}

export async function excluirVeiculo(
  supabase: SupabaseClient,
  userId: string,
  placa: string
): Promise<void> {
  const normalizada = normalizarPlaca(placa);
  const veiculo = await obterVeiculo(supabase, userId, placa);

  if (veiculo?.crlvDisponivel) {
    await supabase.storage.from("crlv-pdfs").remove([`${userId}/${normalizada}.pdf`]);
  }

  const { error } = await supabase
    .from("meus_veiculos")
    .delete()
    .eq("user_id", userId)
    .eq("placa", normalizada);

  if (error) throw new Error(error.message);
}

/** Formato de entrada tolerante ao objeto retornado pela sessão SENATRAN
 * (campos com sub-objeto `{ codigo, descricao }`) e ao cadastro manual
 * (campos já como string). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DadosVeiculoInput = Record<string, any>;

function textoOuDescricao(valor: unknown): string | undefined {
  if (valor == null) return undefined;
  if (typeof valor === "object" && "descricao" in (valor as Record<string, unknown>)) {
    const descricao = (valor as { descricao?: unknown }).descricao;
    return descricao ? String(descricao).trim() : undefined;
  }
  return String(valor).trim() || undefined;
}

function montarLinha(userId: string, input: DadosVeiculoInput) {
  const placa = normalizarPlaca(input.placa);
  const nomeProprietario = input.nomeProprietario ?? input.possuidor?.nome;
  const documentoProprietario =
    input.numeroIdentificacaoProprietario ?? input.possuidor?.numeroDocumento;

  const restricoes: RestricaoVeiculo[] = [
    input.restricao1,
    input.restricao2,
    input.restricao3,
    input.restricao4,
  ]
    .filter(Boolean)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any) => ({ codigo: String(item.codigo ?? ""), descricao: String(item.descricao ?? "") }));

  return {
    user_id: userId,
    placa,
    renavam: input.renavam ? String(input.renavam).replace(/\D/g, "") : null,
    chassi: input.chassi ? String(input.chassi).trim() : null,
    marca_modelo: textoOuDescricao(input.marcaModelo) ?? input.descricaoMarcaModelo ?? null,
    ano_fabricacao: input.anoFabricacao ?? null,
    ano_modelo: input.anoModelo ?? null,
    cor: textoOuDescricao(input.cor) ?? null,
    exercicio: input.exercicio ?? null,
    categoria: textoOuDescricao(input.categoria) ?? null,
    combustivel: textoOuDescricao(input.combustivel) ?? null,
    especie: textoOuDescricao(input.especie) ?? null,
    tipo_veiculo: textoOuDescricao(input.tipoVeiculo) ?? null,
    municipio_emplacamento: textoOuDescricao(input.municipioEmplacamento) ?? null,
    uf_jurisdicao: input.ufJurisdicao ?? null,
    cilindradas: input.cilindradas ? String(input.cilindradas) : null,
    lotacao: input.lotacao ? String(input.lotacao) : null,
    situacao: input.situacao ? String(input.situacao) : null,
    procedencia: input.procedencia ? String(input.procedencia) : null,
    data_emissao_crv: input.dataEmissaoCrv ?? null,
    proprietario_nome: nomeProprietario ? String(nomeProprietario).trim() : null,
    proprietario_documento: documentoProprietario
      ? String(documentoProprietario).replace(/\D/g, "")
      : null,
    proprietario_tipo: textoOuDescricao(input.tipoProprietario) ?? null,
    indicadores: {
      alarme: Boolean(input.indicadorAlarme),
      rouboFurto: Boolean(input.indicadorRouboFurto),
      comunicacaoVenda: Boolean(input.indicadorComunicacaoVenda),
      leilao: Boolean(input.indicadorLeilao),
      multaRenainf: Boolean(input.indicadorMultaRenainf),
      pendenciaEmissao: Boolean(input.indicadorPendenciaEmissao),
      recallMontadora: Boolean(input.indicadorRecallMontadora),
      restricaoRenajud: Boolean(input.indicadorRestricaoRenajud),
      restricaoPgfn: Boolean(input.indicadorRestricaoPgfn),
    },
    restricoes,
    atualizado_em: new Date().toISOString(),
  };
}

export type CadastroResultado = {
  veiculo: MeuVeiculo;
  /** Presente quando o veículo foi salvo mas o PDF não pôde ser
   * armazenado (ex.: bucket "crlv-pdfs" ainda não criado no Supabase) —
   * o cadastro não fica bloqueado por um problema só do PDF. */
  avisoCrlv?: string;
};

export async function cadastrarVeiculo(
  supabase: SupabaseClient,
  userId: string,
  input: DadosVeiculoInput,
  pdfBuffer?: Buffer
): Promise<CadastroResultado> {
  const linha = montarLinha(userId, input);

  let crlvStoragePath: string | null | undefined = undefined;
  let avisoCrlv: string | undefined;
  if (pdfBuffer) {
    if (pdfBuffer.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error("Arquivo não é um PDF válido");
    }
    const path = `${userId}/${linha.placa}.pdf`;
    const { error: uploadError } = await supabase.storage
      .from("crlv-pdfs")
      .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });
    if (uploadError) {
      avisoCrlv = `Veículo cadastrado, mas o PDF não pôde ser salvo (${uploadError.message}). Tente enviar o PDF de novo depois.`;
    } else {
      crlvStoragePath = path;
    }
  }

  const { data, error } = await supabase
    .from("meus_veiculos")
    .upsert(
      { ...linha, ...(crlvStoragePath !== undefined ? { crlv_storage_path: crlvStoragePath } : {}) },
      { onConflict: "user_id,placa" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { veiculo: mapRow(data), avisoCrlv };
}

/** Aceita tanto `{ veiculos: [...] }` (retorno em lista da SENATRAN) quanto
 * um único objeto de veículo detalhado. */
export async function importarSenatran(
  supabase: SupabaseClient,
  userId: string,
  payload: DadosVeiculoInput
): Promise<MeuVeiculo[]> {
  const veiculos: DadosVeiculoInput[] = Array.isArray(payload.veiculos)
    ? payload.veiculos
    : payload.placa
      ? [payload]
      : [];

  if (veiculos.length === 0) {
    throw new Error("Envie um veículo ou o campo veiculos como lista");
  }

  const importados: MeuVeiculo[] = [];
  for (const veiculo of veiculos) {
    const normalizado = { ...veiculo, renavam: veiculo.renavam ?? veiculo.codigoRenavam };
    const { veiculo: cadastrado } = await cadastrarVeiculo(supabase, userId, normalizado);
    importados.push(cadastrado);
  }
  return importados;
}

export async function registrarAuditoria(
  supabase: SupabaseClient,
  params: {
    userId: string;
    veiculoId?: string;
    acao: "cadastro" | "importacao_senatran" | "visualizacao" | "download_crlv" | "exclusao";
    resultado: "sucesso" | "erro";
  }
) {
  await supabase.from("meus_veiculos_auditoria").insert({
    user_id: params.userId,
    veiculo_id: params.veiculoId ?? null,
    acao: params.acao,
    resultado: params.resultado,
  });
}
