/** Extratores dedicados de campos por serviço de "Consultas Avulsas" — cada
 * um sabe o formato de resposta específico daquele serviço na API Brasil
 * (bem diferentes entre si) e devolve uma lista plana de {label, valor}
 * pronta pra exibir. Sem extrator dedicado ainda (serviço novo, sem
 * exemplo de resposta conferido), a ficha cai no formatador genérico
 * (formatarLabelAvulsa/formatarValorAvulsa em lib/consultas-avulsas.ts). */

export type CampoAvulsa = { label: string; valor: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Obj = Record<string, any>;

function campo(label: string, valor: unknown): CampoAvulsa | null {
  if (valor === null || valor === undefined) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  return { label, valor: texto };
}

function campos(...itens: (CampoAvulsa | null)[]): CampoAvulsa[] {
  return itens.filter((item): item is CampoAvulsa => item !== null);
}

function extrairAgregadosSimples(data: Obj): CampoAvulsa[] {
  const marca = data.marca as Obj | undefined;
  const ano = data.ano as Obj | undefined;
  const estado = data.estado as Obj | undefined;
  return campos(
    campo("Tipo", data.tipo),
    campo("Fabricante", marca?.fabricante),
    campo("Modelo", marca?.modelo),
    campo("Ano de fabricação", ano?.fabricacao),
    campo("Ano do modelo", ano?.modelo),
    campo("Cor", data.cor),
    campo("Chassi", data.chassi),
    campo("Placa", data.placa),
    campo("Município", estado?.municipio),
    campo("UF", estado?.uf)
  );
}

function extrairAgregadosRenavam(data: Obj): CampoAvulsa[] {
  return campos(
    campo("Placa", data.placa),
    campo("Marca/Modelo", data.marcaModelo),
    campo("Ano de fabricação", data.anoFabricacao),
    campo("Ano do modelo", data.anoModelo),
    campo("Cor", data.corVeiculo),
    campo("Combustível", data.combustivel),
    campo("Categoria", data.categoria),
    campo("Chassi", data.chassi),
    campo("Renavam", data.renavam),
    campo("Câmbio", data.caixaCambio),
    campo("Cilindradas", data.cilindradas),
    campo("Potência", data.potencia),
    campo("Município", data.municipio),
    campo("UF", data.uf),
    campo("Carroceria", data.tipoCarroceria),
    campo("Nº de carroceria", data.numCarroceria),
    campo("PBT", data.pbt)
  );
}

function textoRestricaoFinanceira(bloco: Obj | undefined, rotulo: string): CampoAvulsa | null {
  if (!bloco || bloco.existe_pendencia !== "1") return null;
  const valor = bloco.valor_pendencia ? ` — ${bloco.valor_pendencia}` : "";
  return campo(rotulo, `Pendente${valor}`);
}

function extrairBaseEstadual(data: Obj): CampoAvulsa[] {
  const bin = data.bin_estadual as Obj | undefined;
  if (!bin) return [];
  const proprietario = bin.proprietario as Obj | undefined;
  const restricoes = bin.restricoes as Obj | undefined;

  return campos(
    campo("Placa", bin.placa),
    campo("Marca/Modelo", bin.marca_modelo),
    campo("Ano de fabricação", bin.ano_fabricacao),
    campo("Ano do modelo", bin.ano_modelo),
    campo("Cor", bin.cor_veiculo),
    campo("Combustível", bin.combustivel),
    campo("Categoria", bin.categoria_veiculo),
    campo("Espécie", bin.especie_veiculo),
    campo("Potência", bin.potencia_veiculo),
    campo("Cilindrada", bin.cilindrada),
    campo("Procedência", bin.procedencia),
    campo("Chassi", bin.chassi),
    campo("Situação do chassi", bin.situacao_chassi),
    campo("Renavam", bin.renavam),
    campo("Situação", bin.situacao),
    campo(
      "Município/UF",
      bin.municipio && bin.uf ? `${bin.municipio}/${bin.uf}` : bin.municipio || bin.uf
    ),
    campo("Proprietário", proprietario?.nome),
    campo("Documento do proprietário", proprietario?.documento),
    campo("Data de emplacamento", bin.data_emplacamento),
    campo("Emissão do CRLV", bin.data_emissao_crlv),
    campo("Número do CRV", bin.numero_crv),
    campo("Código de segurança CRV", bin.codigo_seguranca_crv),
    campo("Restrição geral", restricoes?.existe_restricao_geral === "1" ? "Sim" : undefined),
    campo(
      "Restrição Renajud",
      restricoes?.existe_restricao_renajud === "1" ? "Sim" : undefined
    ),
    campo(
      "Restrição roubo/furto",
      restricoes?.existe_restricao_roubo_furto === "1" ? "Sim" : undefined
    ),
    campo("Veículo baixado", restricoes?.veiculo_baixado === "1" ? "Sim" : undefined),
    textoRestricaoFinanceira(restricoes?.dpvat, "DPVAT"),
    textoRestricaoFinanceira(restricoes?.ipva, "IPVA"),
    textoRestricaoFinanceira(restricoes?.licenciamento, "Licenciamento"),
    textoRestricaoFinanceira(restricoes?.multas, "Multas")
  );
}

function extrairBaseNacional(data: Obj): CampoAvulsa[] {
  const proprietario = data.proprietario as Obj | undefined;
  const restricoes = data.restricoes as Obj | undefined;
  return campos(
    campo("Placa", data.placa),
    campo("Marca/Modelo", data.marca_modelo),
    campo("Ano de fabricação", data.ano_fabricacao),
    campo("Ano do modelo", data.ano_modelo),
    campo("Cor", data.cor_veiculo),
    campo("Combustível", data.combustivel),
    campo("Categoria", data.categoria_veiculo),
    campo("Espécie", data.especie_veiculo),
    campo("Potência", data.potencia_veiculo),
    campo("Cilindrada", data.cilindrada),
    campo("Procedência", data.procedencia),
    campo("Chassi", data.chassi),
    campo("Situação do chassi", data.situacao_chassi),
    campo("Renavam", data.renavam),
    campo("Situação", data.situacao),
    campo(
      "Município/UF",
      data.municipio && data.uf ? `${data.municipio}/${data.uf}` : data.municipio || data.uf
    ),
    campo("Passageiros", data.quantidade_passageiros),
    campo("Proprietário", proprietario?.nome),
    campo("Documento do proprietário", proprietario?.documento),
    campo("Emissão do CRLV", data.data_emissao_crlv),
    campo("Restrição geral", restricoes?.existe_restricao_geral === "1" ? "Sim" : undefined),
    campo(
      "Restrição Renajud",
      restricoes?.existe_restricao_renajud === "1" ? "Sim" : undefined
    ),
    campo(
      "Restrição roubo/furto",
      restricoes?.existe_restricao_roubo_furto === "1" ? "Sim" : undefined
    ),
    campo("Veículo baixado", restricoes?.veiculo_baixado === "1" ? "Sim" : undefined),
    campo("PDF", data.pdf)
  );
}

function listaTelefonesAvulsa(bloco: Obj | undefined): string {
  if (!Array.isArray(bloco?.telefones)) return "";
  return bloco.telefones
    .map((t: Obj) => [t?.ddd, t?.num_telefone].filter(Boolean).join(" "))
    .filter((s: string) => s.trim().length > 0)
    .join(", ");
}

function listaEnderecosAvulsa(bloco: Obj | undefined): string {
  if (!Array.isArray(bloco?.dados)) return "";
  return bloco.dados
    .map((e: Obj) =>
      [
        e?.endereco,
        e?.numero,
        e?.bairro,
        e?.cidade && e?.uf ? `${e.cidade}/${e.uf}` : e?.cidade || e?.uf,
        e?.cep,
      ]
        .filter(Boolean)
        .join(", ")
    )
    .join(" | ");
}

function extrairEnderecoTelefone(data: Obj): CampoAvulsa[] {
  const veicular = (data.veicular as Obj | undefined)?.proprietario_atual_veiculo as
    | Obj
    | undefined;
  const cred = data.credcadastral as Obj | undefined;
  const receita = cred?.dados_receita_federal as Obj | undefined;

  return campos(
    campo("Placa", veicular?.placa),
    campo("Marca/Modelo", veicular?.marca_modelo),
    campo("Ano de fabricação", veicular?.ano_fabricacao),
    campo("Ano do modelo", veicular?.ano_modelo),
    campo("Cor", veicular?.cor_veiculo),
    campo("Chassi", veicular?.chassi),
    campo("Renavam", veicular?.renavam),
    campo(
      "Município/UF",
      veicular?.municipio && veicular?.uf
        ? `${veicular.municipio}/${veicular.uf}`
        : veicular?.municipio || veicular?.uf
    ),
    campo("Proprietário", receita?.nome),
    campo("Documento", veicular?.proprietario_documento),
    campo("Nome da mãe", receita?.nome_mae),
    campo("Data de nascimento/fundação", receita?.data_nascimento_fundacao),
    campo("Sexo", receita?.sexo),
    campo("Situação na Receita", receita?.situacao_receita),
    campo("Tipo de pessoa", receita?.tipo_pessoa),
    campo("Telefone(s) celular", listaTelefonesAvulsa(cred?.telefone_celular)),
    campo("Telefone(s) fixo", listaTelefonesAvulsa(cred?.telefone_fixo)),
    campo("Endereço(s)", listaEnderecosAvulsa(cred?.somente_endereco))
  );
}

function extrairFichaTecnica(data: Obj): CampoAvulsa[] {
  const ficha = (data.veicular as Obj | undefined)?.ficha_tecnica_veicular as Obj | undefined;
  if (!ficha) return [];
  const medidas = ficha.medidas as Obj | undefined;
  const medicoes: Obj[] = Array.isArray(ficha.medicao_combustivel) ? ficha.medicao_combustivel : [];
  const equipamentos: Obj[] = Array.isArray(ficha.equipamentos) ? ficha.equipamentos : [];
  const equipamentosDisponiveis = equipamentos
    .filter((e) => e?.disponibilidade === "DISPONIVEL")
    .map((e) => e?.descricao)
    .filter(Boolean)
    .join(", ");
  const equipamentosOpcionais = equipamentos
    .filter((e) => e?.disponibilidade === "OPCIONAL")
    .map((e) => e?.descricao)
    .filter(Boolean)
    .join(", ");

  const camposMedicao = medicoes.flatMap((m, idx) =>
    campos(
      campo(`Combustível ${medicoes.length > 1 ? idx + 1 : ""}`.trim(), m.combustivel),
      campo(
        "Consumo cidade/estrada",
        m.consumo_cidade && m.consumo_estrada
          ? `${m.consumo_cidade} km/l / ${m.consumo_estrada} km/l`
          : undefined
      ),
      campo(
        "Potência/Torque",
        m.potencia && m.torque ? `${m.potencia} cv / ${m.torque} kgfm` : m.potencia ? `${m.potencia} cv` : undefined
      ),
      campo("0 a 100 km/h", m.tempo_zero_a_cem ? `${m.tempo_zero_a_cem}s` : undefined),
      campo("Velocidade máxima", m.velocidade_maxima ? `${m.velocidade_maxima} km/h` : undefined)
    )
  );

  return campos(
    campo("Motor", ficha.motor),
    campo("Câmbio", ficha.cambio),
    campo("Direção", ficha.direcao),
    campo("Tração", ficha.tipo_tracao),
    campo("Suspensão dianteira", ficha.suspensao_dianteira),
    campo("Suspensão traseira", ficha.suspensao_traseira),
    campo("Freio dianteiro", ficha.freio_dianteiro),
    campo("Freio traseiro", ficha.freio_traseiro),
    campo("Passageiros", ficha.quantidade_passageiros),
    campo("Portas", ficha.quantidade_portas),
    campo(
      "Medidas (C×L×A)",
      medidas?.comprimento && medidas?.largura && medidas?.altura
        ? `${medidas.comprimento} × ${medidas.largura} × ${medidas.altura} mm`
        : undefined
    ),
    campo("Entre-eixos", medidas?.entre_eixos ? `${medidas.entre_eixos} mm` : undefined),
    campo("Peso", medidas?.peso ? `${medidas.peso} kg` : undefined),
    campo("Porta-malas", medidas?.porta_malas ? `${medidas.porta_malas} l` : undefined),
    campo("Tanque de combustível", medidas?.tanque_combustivel ? `${medidas.tanque_combustivel} l` : undefined),
    ...camposMedicao,
    campo("Equipamentos disponíveis", equipamentosDisponiveis),
    campo("Equipamentos opcionais", equipamentosOpcionais),
    campo("PDF da ficha", data.pdf)
  );
}

const EXTRATORES: Record<string, (data: Obj) => CampoAvulsa[]> = {
  "agregados-simples": extrairAgregadosSimples,
  "agregados-renavam": extrairAgregadosRenavam,
  estadual: extrairBaseEstadual,
  nacional: extrairBaseNacional,
  "endereco-telefone-por-placa": extrairEnderecoTelefone,
  "ficha-tecnica": extrairFichaTecnica,
};

/** Extrai campos legíveis do retorno de uma consulta avulsa, usando o
 * parser dedicado desse serviço. Devolve null quando ainda não existe um
 * parser pra esse id (ex: serviço novo sem exemplo de resposta conferido
 * ainda) — quem chama deve cair pro formatador genérico nesse caso. */
export function extrairCamposAvulsa(
  servicoId: string,
  data: Record<string, unknown>
): CampoAvulsa[] | null {
  const extrator = EXTRATORES[servicoId];
  return extrator ? extrator(data) : null;
}
