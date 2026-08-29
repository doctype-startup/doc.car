"use client";

import { useEffect, useRef, useState, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  isValidPlaca,
  lookupVehicle,
  normalizePlaca,
  VehicleQuery,
} from "@/lib/vehicle";
import { addHistory, countHistoryHoje } from "@/lib/history";
import { VeiculoReal, formatCnpj } from "@/lib/dados-veiculo";
import { ConsultaAvancada } from "@/lib/dados-avancados";
import Guardiao from "@/components/Guardiao";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const PLACAS_EXEMPLO = ["ABC1D23", "QRS4567", "JKL8M90"];

/** Protocolo interno da consulta — gerado por nós na hora, sem nenhuma
 * relação com dados do provedor (placa, veículo ou proprietário). Serve
 * só pra o despachante referenciar essa consulta específica depois. */
function gerarChamadoId() {
  const carimbo = Date.now().toString(36).toUpperCase();
  const sufixo = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DC-${carimbo}-${sufixo}`;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const [placa, setPlaca] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VehicleQuery | null>(null);
  const [veiculoReal, setVeiculoReal] = useState<VeiculoReal | null>(null);
  const [realError, setRealError] = useState("");
  const [cpfCnpjCliente, setCpfCnpjCliente] = useState("");
  const [chamadoId, setChamadoId] = useState("");
  const [avancada, setAvancada] = useState<ConsultaAvancada | null>(null);
  const [avancadaError, setAvancadaError] = useState("");
  const [avancadaLoading, setAvancadaLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [consultasHoje, setConsultasHoje] = useState<number | null>(null);

  useEffect(() => {
    void countHistoryHoje().then(setConsultasHoje);
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  async function runSearch(value: string) {
    setError("");
    setVeiculoReal(null);
    setRealError("");
    setCpfCnpjCliente("");
    setAvancada(null);
    setAvancadaError("");
    setShowToast(false);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);

    if (!isValidPlaca(value)) {
      setError("Informe uma placa válida, ex: ABC1D23 ou ABC1234.");
      setResult(null);
      return;
    }

    setLoading(true);

    const data = lookupVehicle(value);
    setResult(data);
    setChamadoId(gerarChamadoId());
    void addHistory(data.placa);
    setConsultasHoje((prev) => (prev ?? 0) + 1);

    try {
      const response = await fetch(`/api/veiculo?placa=${encodeURIComponent(data.placa)}`);
      const payload = await response.json();
      if (response.ok) {
        setVeiculoReal(payload.data);
        setShowToast(true);
        toastTimeout.current = setTimeout(() => setShowToast(false), 4500);
      } else {
        setRealError(payload.error || "Consulta real indisponível.");
      }
    } catch {
      setRealError("Não foi possível contatar o provedor de dados.");
    }

    setLoading(false);
  }

  async function runAvancada() {
    const placaAlvo = veiculoReal?.placa || result?.placa;
    if (!placaAlvo) return;

    setAvancadaLoading(true);
    setAvancadaError("");

    try {
      const response = await fetch(
        `/api/consulta-avancada?placa=${encodeURIComponent(placaAlvo)}`
      );
      const payload = await response.json();
      if (response.ok) {
        setAvancada(payload.data);
      } else {
        setAvancadaError(payload.error || "Consulta avançada indisponível.");
      }
    } catch {
      setAvancadaError("Não foi possível contatar o provedor de dados avançados.");
    }

    setAvancadaLoading(false);
  }

  useEffect(() => {
    const fromQuery = searchParams.get("placa");
    if (fromQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- triggers a search when arriving via a ?placa= link
      setPlaca(normalizePlaca(fromQuery));
      void runSearch(fromQuery);
    }
  }, [searchParams]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(placa);
  }

  function handleExampleClick(exemplo: string) {
    setPlaca(exemplo);
    void runSearch(exemplo);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <>
      {consultasHoje !== null && (
        <div className="no-print" style={{ marginBottom: 20 }}>
          <Guardiao
            pose="aguardando"
            size={56}
            mensagem={
              consultasHoje === 0
                ? "Você ainda não fez nenhuma consulta hoje."
                : consultasHoje === 1
                  ? "Você já fez 1 consulta hoje."
                  : `Você já fez ${consultasHoje} consultas hoje.`
            }
          />
        </div>
      )}

      <div className="search-card">
        <h2>Consultar veículo por placa</h2>
        <p className="hint">Formato antigo (ABC1D34) ou Mercosul (ABC1D23).</p>

        <form className="search-bar" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="ABC1D23"
            maxLength={7}
            value={placa}
            onChange={(e) => setPlaca(normalizePlaca(e.target.value))}
          />
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
        </form>

        <div className="search-examples">
          <span>Experimente:</span>
          {PLACAS_EXEMPLO.map((exemplo) => (
            <button
              key={exemplo}
              type="button"
              className="chip"
              onClick={() => handleExampleClick(exemplo)}
            >
              {exemplo}
            </button>
          ))}
          <span>— ou digite qualquer placa, o protótipo gera uma ficha na hora.</span>
        </div>
      </div>

      <div className="info-banner">
        Ficha do veículo, FIPE e restrições vêm do provedor de dados real
        quando a consulta funciona. Débitos (IPVA/licenciamento) continuam
        simulados. Multas, roubo/furto e Renajud têm consulta avançada real,
        sob demanda — veja o botão no card de Multas abaixo (custo por
        consulta).
      </div>

      {error && <div className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>{error}</div>}

      {loading && (
        <div className="loading-state">
          <Guardiao pose="verificando" />
          <span>Já estamos verificando os dados da placa...</span>
        </div>
      )}

      {!result && !error && !loading && (
        <div className="empty-state">
          <Guardiao
            pose="aguardando"
            mensagem="Nenhuma consulta realizada ainda. Digite uma placa acima que eu já trago a ficha completa."
          />
        </div>
      )}

      {showToast && (
        <div className="guardiao-toast no-print">
          <Guardiao pose="sucesso" />
          <p>Consulta encontrada com sucesso!</p>
        </div>
      )}

      {(veiculoReal !== null || realError) && (
        <details className="debug-details">
          <summary>Retorno da consulta real (modo depuração)</summary>
          {realError ? (
            <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 12 }}>{realError}</p>
          ) : (
            <pre>{JSON.stringify(veiculoReal, null, 2)}</pre>
          )}
        </details>
      )}

      {(avancada !== null || avancadaError) && (
        <details className="debug-details">
          <summary>Retorno da consulta avançada (modo depuração)</summary>
          {avancadaError ? (
            <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 12 }}>{avancadaError}</p>
          ) : (
            <pre>{JSON.stringify(avancada, null, 2)}</pre>
          )}
        </details>
      )}

      {result && (
        <div className="printable-report">
          <div className="print-header">
            <div className="brand">
              DOC<span>.CAR</span>
            </div>
            <p>
              Ficha de consulta veicular — placa {veiculoReal?.placa || result.placa} — emitida em{" "}
              {new Date().toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="card">
            <div className="result-title">
              <h2>{veiculoReal?.placa || result.placa}</h2>
              {veiculoReal ? (
                <>
                  <span className="badge ok">Dados reais</span>
                  {veiculoReal.situacaoVeiculo && (
                    <span className="badge neutral">{veiculoReal.situacaoVeiculo}</span>
                  )}
                  {veiculoReal.indicadores.rouboFurto && (
                    <span className="badge warn">Roubo/furto</span>
                  )}
                  {veiculoReal.indicadores.restricaoJudicial && (
                    <span className="badge warn">Restrição judicial</span>
                  )}
                  {veiculoReal.indicadores.multa && (
                    <span className="badge warn">Multa</span>
                  )}
                </>
              ) : (
                <>
                  <span className={`badge ${result.licenciamentoEmDia ? "ok" : "warn"}`}>
                    {result.licenciamentoEmDia ? "Licenciamento em dia" : "Licenciamento atrasado"}
                  </span>
                  <span className="badge neutral">Dados simulados</span>
                </>
              )}
              <button type="button" className="print-button no-print" onClick={handlePrint}>
                Imprimir
              </button>
            </div>

            <div className="grid-3">
              <div className="kv">
                <span className="label">Chamado ID</span>
                <span className="value">{chamadoId}</span>
              </div>
              <div className="kv">
                <span className="label">Marca/Modelo</span>
                <span className="value">
                  {veiculoReal ? `${veiculoReal.marca || ""} ${veiculoReal.modelo || ""}`.trim() : `${result.marca} ${result.modelo}`}
                </span>
              </div>
              <div className="kv">
                <span className="label">Ano modelo/fabricação</span>
                <span className="value">
                  {veiculoReal
                    ? `${veiculoReal.anoModelo ?? "—"}/${veiculoReal.anoFabricacao ?? "—"}`
                    : `${result.anoModelo}/${result.anoFabricacao}`}
                </span>
              </div>
              <div className="kv">
                <span className="label">Cor</span>
                <span className="value">{veiculoReal ? veiculoReal.cor || "—" : result.cor}</span>
              </div>

              <div className="kv">
                <span className="label">Combustível</span>
                <span className="value">
                  {veiculoReal ? veiculoReal.combustivel || "—" : result.combustivel}
                </span>
              </div>
              <div className="kv">
                <span className="label">Município/UF</span>
                <span className="value">
                  {veiculoReal
                    ? `${veiculoReal.municipio || "—"}/${veiculoReal.uf || "—"}`
                    : `${result.municipio}/${result.uf}`}
                </span>
              </div>
              <div className="kv">
                <span className="label">Renavam</span>
                <span className="value">{veiculoReal ? veiculoReal.renavam || "—" : result.renavam}</span>
              </div>

              <div className="kv">
                <span className="label">Chassi</span>
                <span className="value">{veiculoReal ? veiculoReal.chassi || "—" : result.chassi}</span>
              </div>
              {veiculoReal?.placaMercosul && (
                <div className="kv">
                  <span className="label">Placa Mercosul</span>
                  <span className="value">{veiculoReal.placaMercosul}</span>
                </div>
              )}
              {veiculoReal?.placaAnterior && (
                <div className="kv">
                  <span className="label">Placa anterior</span>
                  <span className="value">{veiculoReal.placaAnterior}</span>
                </div>
              )}
              {veiculoReal ? (
                <div className="kv">
                  <span className="label">Proprietário</span>
                  <span className="value">{veiculoReal.proprietarioNome || "—"}</span>
                </div>
              ) : (
                <div className="kv">
                  <span className="label">Vencimento do licenciamento</span>
                  <span className="value">{result.vencimentoLicenciamento}</span>
                </div>
              )}
              {veiculoReal?.proprietarioCnpj && (
                <div className="kv">
                  <span className="label">CNPJ do proprietário</span>
                  <span className="value">{formatCnpj(veiculoReal.proprietarioCnpj)}</span>
                </div>
              )}
              {veiculoReal?.cnpjFaturado && (
                <div className="kv">
                  <span className="label">CNPJ da fatura original</span>
                  <span className="value">{formatCnpj(veiculoReal.cnpjFaturado)}</span>
                </div>
              )}
              {veiculoReal?.anoUltimoLicenciamento && (
                <div className="kv">
                  <span className="label">Ano do último licenciamento</span>
                  <span className="value">{veiculoReal.anoUltimoLicenciamento}</span>
                </div>
              )}
              {veiculoReal?.dataEmplacamento && (
                <div className="kv">
                  <span className="label">Emplacamento</span>
                  <span className="value">{veiculoReal.dataEmplacamento}</span>
                </div>
              )}
              {veiculoReal?.dataUltimaAtualizacao && (
                <div className="kv">
                  <span className="label">Dados atualizados em</span>
                  <span className="value">{veiculoReal.dataUltimaAtualizacao}</span>
                </div>
              )}
              {veiculoReal?.numeroSequencialDocumento && (
                <div className="kv">
                  <span className="label">Número sequencial do documento</span>
                  <span className="value">{veiculoReal.numeroSequencialDocumento}</span>
                </div>
              )}
              {veiculoReal?.codigoSegurancaCrv && (
                <div className="kv">
                  <span className="label">Código de segurança do CRV</span>
                  <span className="value">{veiculoReal.codigoSegurancaCrv}</span>
                </div>
              )}
              {veiculoReal?.situacaoChassi && (
                <div className="kv">
                  <span className="label">Situação do chassi</span>
                  <span className="value">{veiculoReal.situacaoChassi}</span>
                </div>
              )}
              <div className="kv">
                <span className="label">Valor FIPE</span>
                <span className="value">
                  {veiculoReal
                    ? veiculoReal.fipe
                      ? currency.format(veiculoReal.fipe.valor)
                      : "Não disponível"
                    : result.fipe
                      ? currency.format(result.fipe.valor)
                      : "Não disponível"}
                </span>
              </div>
              {veiculoReal?.fipe?.descricao && (
                <div className="kv">
                  <span className="label">Descrição FIPE</span>
                  <span className="value">{veiculoReal.fipe.descricao}</span>
                </div>
              )}
              {veiculoReal?.fipe?.codigo && (
                <div className="kv">
                  <span className="label">Código FIPE</span>
                  <span className="value">{veiculoReal.fipe.codigo}</span>
                </div>
              )}
              {veiculoReal?.fipe?.anoModelo && (
                <div className="kv">
                  <span className="label">Ano-modelo de referência FIPE</span>
                  <span className="value">{veiculoReal.fipe.anoModelo}</span>
                </div>
              )}
              <div className="kv">
                <span className="label">CPF/CNPJ do cliente (informado por você)</span>
                <input
                  type="text"
                  className="inline-input no-print"
                  placeholder="Preencha na hora, se precisar"
                  value={cpfCnpjCliente}
                  onChange={(e) => setCpfCnpjCliente(e.target.value)}
                />
                <span className="value print-only">{cpfCnpjCliente || "—"}</span>
              </div>
            </div>
          </div>

          {veiculoReal && (
            <div className="card">
              <h3>
                Especificações técnicas <span className="badge ok">Dados reais</span>
              </h3>
              <div className="grid-3">
                {veiculoReal.tipoVeiculo && (
                  <div className="kv">
                    <span className="label">Tipo</span>
                    <span className="value">{veiculoReal.tipoVeiculo}</span>
                  </div>
                )}
                {veiculoReal.especie && (
                  <div className="kv">
                    <span className="label">Espécie</span>
                    <span className="value">{veiculoReal.especie}</span>
                  </div>
                )}
                {veiculoReal.carroceria && (
                  <div className="kv">
                    <span className="label">Carroceria</span>
                    <span className="value">{veiculoReal.carroceria}</span>
                  </div>
                )}
                {veiculoReal.categoria && (
                  <div className="kv">
                    <span className="label">Categoria</span>
                    <span className="value">{veiculoReal.categoria}</span>
                  </div>
                )}
                {veiculoReal.nacionalidade && (
                  <div className="kv">
                    <span className="label">Nacionalidade</span>
                    <span className="value">{veiculoReal.nacionalidade}</span>
                  </div>
                )}
                {veiculoReal.tipoMontagem && (
                  <div className="kv">
                    <span className="label">Montagem</span>
                    <span className="value">{veiculoReal.tipoMontagem}</span>
                  </div>
                )}
                {veiculoReal.motor && (
                  <div className="kv">
                    <span className="label">Motor</span>
                    <span className="value">{veiculoReal.motor}</span>
                  </div>
                )}
                {veiculoReal.potencia && (
                  <div className="kv">
                    <span className="label">Potência</span>
                    <span className="value">{veiculoReal.potencia} cv</span>
                  </div>
                )}
                {veiculoReal.cilindradas && (
                  <div className="kv">
                    <span className="label">Cilindradas</span>
                    <span className="value">{veiculoReal.cilindradas}</span>
                  </div>
                )}
                {veiculoReal.eixos && (
                  <div className="kv">
                    <span className="label">Eixos</span>
                    <span className="value">{veiculoReal.eixos}</span>
                  </div>
                )}
                {veiculoReal.lotacao && (
                  <div className="kv">
                    <span className="label">Lotação</span>
                    <span className="value">{veiculoReal.lotacao}</span>
                  </div>
                )}
                {veiculoReal.pesoBrutoTotal && (
                  <div className="kv">
                    <span className="label">Peso bruto total</span>
                    <span className="value">{veiculoReal.pesoBrutoTotal}</span>
                  </div>
                )}
                {veiculoReal.capacidadeCarga && (
                  <div className="kv">
                    <span className="label">Capacidade de carga</span>
                    <span className="value">{veiculoReal.capacidadeCarga}</span>
                  </div>
                )}
                {veiculoReal.capMaximaTracao && (
                  <div className="kv">
                    <span className="label">Capacidade máx. de tração</span>
                    <span className="value">{veiculoReal.capMaximaTracao}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {veiculoReal && veiculoReal.quilometragem.length > 0 && (
            <div className="card">
              <h3>
                Histórico de quilometragem <span className="badge ok">Dados reais</span>
              </h3>
              <div className="grid-2">
                {veiculoReal.quilometragem.map((leitura, idx) => (
                  <div className="kv" key={idx}>
                    <span className="label">
                      {leitura.data || "Data não informada"}
                      {leitura.origem && ` · ${leitura.origem}`}
                    </span>
                    <span className="value">
                      {leitura.km.toLocaleString("pt-BR")} km
                      {leitura.municipio && ` · ${leitura.municipio}${leitura.uf ? `/${leitura.uf}` : ""}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3>
              Débitos <span className="badge neutral">Dados simulados</span>
            </h3>
            {result.debitos.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                Nenhum débito encontrado para este veículo.
              </p>
            ) : (
              <div className="grid-2">
                {result.debitos.map((debito) => (
                  <div className="kv" key={debito.tipo}>
                    <span className="label">
                      {debito.tipo} · vence em {debito.vencimento}
                    </span>
                    <span className="value">{currency.format(debito.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>
              Multas{" "}
              <span className={`badge ${avancada ? "ok" : "neutral"}`}>
                {avancada ? "Dados reais" : "Dados simulados"}
              </span>
            </h3>

            {!avancada && (
              <button
                type="button"
                className="secondary-button no-print"
                onClick={runAvancada}
                disabled={avancadaLoading}
                style={{ marginBottom: 12 }}
              >
                {avancadaLoading
                  ? "Consultando..."
                  : "Consultar multas, roubo/furto e Renajud reais (R$ 3,00)"}
              </button>
            )}
            {avancadaError && (
              <p className="form-error" style={{ marginBottom: 12 }}>
                {avancadaError}
              </p>
            )}

            {(avancada?.anoUltimoLicenciamento ||
              avancada?.numeroCrv ||
              avancada?.numeroSequencialDocumento ||
              avancada?.codigoSegurancaCrv) && (
              <div className="grid-2" style={{ marginBottom: 12 }}>
                {avancada.anoUltimoLicenciamento && (
                  <div className="kv">
                    <span className="label">Ano do último licenciamento</span>
                    <span className="value">{avancada.anoUltimoLicenciamento}</span>
                  </div>
                )}
                {avancada.numeroCrv && (
                  <div className="kv">
                    <span className="label">Número do CRV (impresso no documento)</span>
                    <span className="value">{avancada.numeroCrv}</span>
                  </div>
                )}
                {avancada.numeroSequencialDocumento && (
                  <div className="kv">
                    <span className="label">Número sequencial do documento</span>
                    <span className="value">{avancada.numeroSequencialDocumento}</span>
                  </div>
                )}
                {avancada.codigoSegurancaCrv && (
                  <div className="kv">
                    <span className="label">Código de segurança do CRV</span>
                    <span className="value">{avancada.codigoSegurancaCrv}</span>
                  </div>
                )}
                {avancada.identificacaoUnica && (
                  <div className="kv">
                    <span className="label">Identificação única</span>
                    <span className="value">{avancada.identificacaoUnica}</span>
                  </div>
                )}
                {avancada.situacaoChassi && (
                  <div className="kv">
                    <span className="label">Situação do chassi</span>
                    <span className="value">{avancada.situacaoChassi}</span>
                  </div>
                )}
              </div>
            )}

            {avancada &&
              (avancada.foiEmplacado !== undefined ||
                avancada.ostentaPiv !== undefined ||
                avancada.placaFormatoAntigo !== undefined ||
                avancada.placaInutilizada !== undefined) && (
                <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {avancada.foiEmplacado !== undefined && (
                    <span className={`badge ${avancada.foiEmplacado ? "ok" : "neutral"}`}>
                      {avancada.foiEmplacado ? "Emplacado" : "Não emplacado"}
                    </span>
                  )}
                  {avancada.ostentaPiv !== undefined && (
                    <span className={`badge ${avancada.ostentaPiv ? "ok" : "neutral"}`}>
                      {avancada.ostentaPiv ? "Ostenta PIV" : "Sem PIV"}
                    </span>
                  )}
                  {avancada.placaFormatoAntigo && (
                    <span className="badge neutral">Placa formato pré-Mercosul</span>
                  )}
                  {avancada.placaInutilizada && (
                    <span className="badge warn">Placa inutilizada</span>
                  )}
                </div>
              )}

            {avancada && avancada.observacoes.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <span className="label">Observações do documento</span>
                {avancada.observacoes.map((obs, idx) => (
                  <p key={idx} style={{ fontSize: 13, marginTop: 4 }}>
                    {obs}
                  </p>
                ))}
              </div>
            )}

            {avancada ? (
              avancada.totalMultas === 0 ? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Nada consta.</p>
              ) : (
                <>
                  {avancada.multas.map((multa, idx) => (
                    <div
                      key={idx}
                      style={{
                        borderTop: idx === 0 ? "none" : "1px solid var(--border)",
                        padding: "10px 0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>
                          {multa.descricao || "Infração"}
                        </span>
                        <span className="value" style={{ whiteSpace: "nowrap" }}>
                          {currency.format(multa.valorTotal)}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                        {[
                          multa.codigo && `Código ${multa.codigo}`,
                          multa.tipoMulta,
                          multa.gravidade && `Gravidade: ${multa.gravidade}`,
                          multa.infrator && `Responsável: ${multa.infrator}`,
                          multa.orgaoCompetente && `Órgão: ${multa.orgaoCompetente}`,
                          multa.amparoLegal && `Art. ${multa.amparoLegal}`,
                          multa.quantidade > 1 && `${multa.quantidade}x`,
                          `${currency.format(multa.valorUnitario)} unit.`,
                          multa.multiplicador !== 1 && `Multiplicador ${multa.multiplicador}x`,
                          `${multa.pontosUnitario} pts unit.`,
                          `${multa.pontosTotal} pontos`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                  ))}
                  <div className="grid-2" style={{ marginTop: 12 }}>
                    <div className="kv">
                      <span className="label">Total de multas</span>
                      <span className="value">{avancada.totalMultas}</span>
                    </div>
                    <div className="kv">
                      <span className="label">Valor total</span>
                      <span className="value">{currency.format(avancada.valorTotalMultas)}</span>
                    </div>
                    <div className="kv">
                      <span className="label">Pontos na CNH</span>
                      <span className="value">{avancada.pontosTotal}</span>
                    </div>
                  </div>
                </>
              )
            ) : result.multas.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                Nenhuma multa encontrada para este veículo.
              </p>
            ) : (
              <div className="grid-2">
                {result.multas.map((multa) => (
                  <div className="kv" key={multa.tipo}>
                    <span className="label">
                      {multa.tipo} · {multa.data}
                    </span>
                    <span className="value">{currency.format(multa.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {avancada && (
            <div className="card">
              <h3>
                Roubo/furto <span className="badge ok">Dados reais</span>
              </h3>
              {avancada.rouboFurto ? (
                <div className="grid-2">
                  <div className="kv">
                    <span className="label">Tipo</span>
                    <span className="value">{avancada.rouboFurto.tipo || "—"}</span>
                  </div>
                  <div className="kv">
                    <span className="label">Data</span>
                    <span className="value">{avancada.rouboFurto.data || "—"}</span>
                  </div>
                  <div className="kv">
                    <span className="label">Município</span>
                    <span className="value">{avancada.rouboFurto.municipio || "—"}</span>
                  </div>
                  <div className="kv">
                    <span className="label">Observação</span>
                    <span className="value">{avancada.rouboFurto.descricao || "—"}</span>
                  </div>
                  {avancada.rouboFurto.numeroBoletim && (
                    <div className="kv">
                      <span className="label">Boletim</span>
                      <span className="value">{avancada.rouboFurto.numeroBoletim}</span>
                    </div>
                  )}
                  {avancada.rouboFurto.orgaoSeguranca && (
                    <div className="kv">
                      <span className="label">Órgão de segurança</span>
                      <span className="value">{avancada.rouboFurto.orgaoSeguranca}</span>
                    </div>
                  )}
                  {avancada.rouboFurto.quantidade !== undefined && (
                    <div className="kv">
                      <span className="label">Ocorrências</span>
                      <span className="value">{avancada.rouboFurto.quantidade}</span>
                    </div>
                  )}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Nada consta.</p>
              )}
            </div>
          )}

          {avancada && (
            <div className="card">
              <h3>
                Restrições judiciais (Renajud) <span className="badge ok">Dados reais</span>
              </h3>
              {avancada.possuiRestricaoExtrajudicial && (
                <span className="badge warn" style={{ marginBottom: 12 }}>
                  Restrição extrajudicial (ex: alienação fiduciária)
                </span>
              )}
              {avancada.possuiRestricaoJudicial ? (
                avancada.restricoesJudiciais.map((restricao, idx) => (
                  <div key={idx} style={{ marginBottom: 10 }}>
                    {restricao.restricoes.length > 0 ? (
                      restricao.restricoes.map((desc) => (
                        <span
                          key={desc}
                          className="badge warn"
                          style={{ marginRight: 8, marginBottom: 8 }}
                        >
                          {desc}
                        </span>
                      ))
                    ) : (
                      <span className="badge warn">Restrição judicial</span>
                    )}
                    <p style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}>
                      {[
                        restricao.tribunal,
                        restricao.orgaoJudiciario,
                        restricao.ramo && `Ramo: ${restricao.ramo}`,
                        restricao.processo && `Processo ${restricao.processo}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Nada consta.</p>
              )}
              {(avancada.proprietarioNome || avancada.proprietarioCnpj) && (
                <div className="grid-2" style={{ marginTop: 12 }}>
                  {avancada.proprietarioNome && (
                    <div className="kv">
                      <span className="label">Proprietário</span>
                      <span className="value">{avancada.proprietarioNome}</span>
                    </div>
                  )}
                  {avancada.proprietarioCnpj && (
                    <div className="kv">
                      <span className="label">CNPJ do proprietário</span>
                      <span className="value">{formatCnpj(avancada.proprietarioCnpj)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h3>
              Restrições{" "}
              <span className={`badge ${veiculoReal ? "ok" : "neutral"}`}>
                {veiculoReal ? "Dados reais" : "Dados simulados"}
              </span>
            </h3>
            {veiculoReal ? (
              veiculoReal.restricoes.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--muted)" }}>Nada consta.</p>
              ) : (
                veiculoReal.restricoes.map((restricao) => (
                  <span key={restricao} className="badge warn" style={{ marginRight: 8, marginBottom: 8 }}>
                    {restricao}
                  </span>
                ))
              )
            ) : result.restricoes.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                Nenhuma restrição encontrada para este veículo.
              </p>
            ) : (
              result.restricoes.map((restricao) => (
                <div key={restricao.tipo} style={{ marginBottom: 10 }}>
                  <span className={`badge ${restricao.grave ? "warn" : "ok"}`}>
                    {restricao.tipo}
                  </span>
                  <p style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}>
                    {restricao.descricao}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
