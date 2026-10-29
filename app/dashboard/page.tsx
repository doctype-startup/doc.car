"use client";

import { useEffect, useMemo, useRef, useState, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  isValidPlaca,
  lookupVehicle,
  normalizePlaca,
  VehicleQuery,
} from "@/lib/vehicle";
import { addHistory, countHistoryHoje, getHistory } from "@/lib/history";
import { VeiculoReal, formatCnpj, formatCpf } from "@/lib/dados-veiculo";
import { PRECO_PROPRIETARIO_AVULSO_CENTAVOS } from "@/lib/plans";
import { getConsultaAvulsaPorId, formatarLabelAvulsa, formatarValorAvulsa } from "@/lib/consultas-avulsas";
import { extrairCamposAvulsa } from "@/lib/consultas-avulsas-extratores";
import Guardiao from "@/components/Guardiao";
import { useGuardiaoResumo } from "@/components/guardiao-context";

type ResultadoAvulsa =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "error"; errorMessage: string };

const PRECO_RENAJUD_CENTAVOS = getConsultaAvulsaPorId("renajud")?.precoCentavos ?? 0;

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

/** Monta o resumo inteligente que o Guardião mostra no widget flutuante:
 * só o que realmente importa da ficha consultada, sem precisar abrir cada
 * card. Usa os indicadores (sinais, não detalhe) já vindos da consulta
 * básica — o detalhe completo (multas, roubo/furto, Renajud) agora mora
 * na aba "Consulta Avançada", separada desta tela. */
function buildResumoGuardiao(
  veiculo: VeiculoReal | null
): { texto: string; alerta: boolean } | null {
  if (!veiculo) return null;

  const alertas: string[] = [];

  if (veiculo.restricoes.length > 0) {
    alertas.push(
      `${veiculo.restricoes.length} restrição${veiculo.restricoes.length > 1 ? "ões" : ""} no documento`
    );
  }

  if (veiculo.indicadores.rouboFurto) alertas.push("indício de roubo/furto");
  if (veiculo.indicadores.restricaoJudicial) alertas.push("indício de restrição judicial");
  if (veiculo.indicadores.multa) alertas.push("indício de multa");

  if (alertas.length === 0) {
    return {
      alerta: false,
      texto: `Placa ${veiculo.placa}: sem restrições no documento. Consulte multas/roubo-furto na aba Consulta Avançada pra um resumo completo.`,
    };
  }

  return { alerta: true, texto: `Placa ${veiculo.placa}: atenção — ${alertas.join(", ")}.` };
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
  /** Dossiê completo do proprietário (CPF/CNPJ, nome da mãe, telefones,
   * endereços) — plus separado da consulta avançada principal, com botão
   * próprio: desconta da mesma cota mensal quando disponível, senão cobra
   * avulso (ver app/api/consulta-avancada/proprietario). O dado em si já
   * está em veiculoReal (buscado de graça na consulta simples) — só falta
   * liberar a exibição depois da cota/cobrança confirmada. */
  const [proprietarioLiberado, setProprietarioLiberado] = useState(false);
  const [proprietarioLoading, setProprietarioLoading] = useState(false);
  const [proprietarioError, setProprietarioError] = useState("");
  const [proprietarioSaldo, setProprietarioSaldo] = useState<{
    cota: number;
    usado: number;
    origem: "cota" | "credito" | "avulso";
    creditos: number;
  } | null>(null);
  /** Renajud (restrição judicial) — igual ao padrão de "Dados do
   * proprietário": card próprio nesta tela, chamada avulsa sob demanda (só
   * dispara no clique do botão), debitada do saldo de Consultas Avulsas
   * (ver app/api/consultas-avulsas). */
  const [renajud, setRenajud] = useState<ResultadoAvulsa>({ status: "idle" });
  const [showToast, setShowToast] = useState(false);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Incrementado a cada nova busca (runSearch/runFromCache) — uma resposta
   * só é aplicada se ainda for da busca mais recente. Evita que uma
   * requisição antiga e mais lenta (ex: duplo clique, clique num chip
   * enquanto a busca anterior ainda carrega) sobrescreva o resultado de uma
   * busca mais nova que já terminou, deixando erro e dado bom juntos na
   * tela. */
  const requestIdRef = useRef(0);
  const [consultasHoje, setConsultasHoje] = useState<number | null>(null);
  const [placasRecentes, setPlacasRecentes] = useState<string[]>([]);
  const [saldoSimples, setSaldoSimples] = useState<{
    cota: number;
    usado: number;
    origem: "cota" | "credito" | "avulso";
    creditos: number;
  } | null>(null);
  const [fromCache, setFromCache] = useState(false);

  useEffect(() => {
    void countHistoryHoje().then(setConsultasHoje);
    void getHistory().then((items) => {
      const vistas = new Set<string>();
      const unicas: string[] = [];
      for (const item of items) {
        if (!vistas.has(item.placa)) {
          vistas.add(item.placa);
          unicas.push(item.placa);
        }
        if (unicas.length === 4) break;
      }
      setPlacasRecentes(unicas);
    });
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  const resumoGuardiao = useMemo(() => buildResumoGuardiao(veiculoReal), [veiculoReal]);
  useGuardiaoResumo(resumoGuardiao);

  async function runSearch(value: string) {
    const requestId = ++requestIdRef.current;

    setError("");
    setVeiculoReal(null);
    setRealError("");
    setCpfCnpjCliente("");
    setProprietarioLiberado(false);
    setProprietarioError("");
    setProprietarioSaldo(null);
    setRenajud({ status: "idle" });
    setSaldoSimples(null);
    setFromCache(false);
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
    setPlacasRecentes((prev) => [data.placa, ...prev.filter((p) => p !== data.placa)].slice(0, 4));

    try {
      const response = await fetch(`/api/veiculo?placa=${encodeURIComponent(data.placa)}`);
      const payload = await response.json();
      if (requestIdRef.current !== requestId) return;
      if (response.ok) {
        setVeiculoReal(payload.data);
        setSaldoSimples(payload.saldo ?? null);
        setShowToast(true);
        toastTimeout.current = setTimeout(() => setShowToast(false), 4500);
      } else {
        setRealError(payload.error || "Consulta real indisponível.");
      }
    } catch {
      if (requestIdRef.current !== requestId) return;
      setRealError("Não foi possível contatar o provedor de dados.");
    }

    if (requestIdRef.current !== requestId) return;
    setLoading(false);
  }

  /** Libera o card "Dados do proprietário" — o dado em si já está em
   * veiculoReal (a consulta simples já buscou de graça), essa chamada só
   * confirma cota/cobrança (ver app/api/consulta-avancada/proprietario). */
  async function liberarProprietario() {
    const placaAlvo = veiculoReal?.placa || result?.placa;
    if (!placaAlvo) return;

    setProprietarioLoading(true);
    setProprietarioError("");

    try {
      const response = await fetch("/api/consulta-avancada/proprietario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placa: placaAlvo }),
      });
      const payload = await response.json();
      if (response.ok) {
        setProprietarioLiberado(true);
        setProprietarioSaldo(payload.saldo ?? null);
      } else {
        setProprietarioError(payload.error || "Não foi possível liberar os dados do proprietário.");
      }
    } catch {
      setProprietarioError("Não foi possível contatar o servidor.");
    }

    setProprietarioLoading(false);
  }

  /** Dispara a consulta avulsa de Renajud só no clique do botão — não é
   * chamada automaticamente junto da busca da placa. */
  async function consultarRenajud() {
    const placaAlvo = veiculoReal?.placa || result?.placa;
    if (!placaAlvo) return;

    setRenajud({ status: "loading" });

    try {
      const response = await fetch(
        `/api/consultas-avulsas?servico=renajud&placa=${encodeURIComponent(placaAlvo)}`
      );
      const payload = await response.json();
      if (response.ok) {
        setRenajud({ status: "ok", data: payload.data });
      } else {
        setRenajud({ status: "error", errorMessage: payload.error || "Não foi possível consultar." });
      }
    } catch {
      setRenajud({ status: "error", errorMessage: "Não foi possível contatar o servidor." });
    }
  }

  async function runFromCache(value: string) {
    const requestId = ++requestIdRef.current;

    if (!isValidPlaca(value)) {
      void runSearch(value);
      return;
    }

    const placaNormalizada = normalizePlaca(value);

    try {
      const response = await fetch(
        `/api/veiculo-cache?placa=${encodeURIComponent(placaNormalizada)}`
      );
      if (!response.ok) {
        void runSearch(value);
        return;
      }
      const payload = await response.json();
      if (requestIdRef.current !== requestId) return;

      setError("");
      setRealError("");
      setProprietarioLiberado(false);
      setProprietarioError("");
      setProprietarioSaldo(null);
      setRenajud({ status: "idle" });
      setCpfCnpjCliente("");
      setSaldoSimples(null);
      setShowToast(false);
      if (toastTimeout.current) clearTimeout(toastTimeout.current);

      const data = lookupVehicle(placaNormalizada);
      setResult(data);
      setChamadoId(gerarChamadoId());
      setVeiculoReal(payload.data);
      setFromCache(true);

      void addHistory(data.placa);
      setConsultasHoje((prev) => (prev ?? 0) + 1);
      setPlacasRecentes((prev) =>
        [data.placa, ...prev.filter((p) => p !== data.placa)].slice(0, 4)
      );
    } catch {
      void runSearch(value);
    }
  }

  useEffect(() => {
    const fromQuery = searchParams.get("placa");
    if (fromQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- triggers a search when arriving via a ?placa= link
      setPlaca(normalizePlaca(fromQuery));
      void runFromCache(fromQuery);
    }
  }, [searchParams]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(placa);
  }

  function handleExampleClick(exemplo: string) {
    setPlaca(exemplo);
    void runFromCache(exemplo);
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
          <div className={`placa-input${error ? " invalid" : ""}`}>
            <div className="placa-input-top">
              <span className="placa-input-mercosul">MERCOSUL</span>
              <span className="placa-input-brasil">BRASIL</span>
              <span className="placa-input-flag" aria-hidden="true">
                🇧🇷
              </span>
            </div>
            <input
              type="text"
              placeholder="ABC1D23"
              maxLength={7}
              value={placa}
              onChange={(e) => setPlaca(normalizePlaca(e.target.value))}
            />
          </div>
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
        </form>

        <div className="search-examples">
          {placasRecentes.length > 0 ? (
            <>
              <span>Últimas consultas:</span>
              {placasRecentes.map((placaRecente) => (
                <button
                  key={placaRecente}
                  type="button"
                  className="chip"
                  disabled={loading}
                  onClick={() => handleExampleClick(placaRecente)}
                >
                  {placaRecente}
                </button>
              ))}
            </>
          ) : (
            <>
              <span>Experimente:</span>
              {PLACAS_EXEMPLO.map((exemplo) => (
                <button
                  key={exemplo}
                  type="button"
                  className="chip"
                  disabled={loading}
                  onClick={() => handleExampleClick(exemplo)}
                >
                  {exemplo}
                </button>
              ))}
              <span>— ou digite qualquer placa, o protótipo gera uma ficha na hora.</span>
            </>
          )}
        </div>
      </div>

      <div className="info-banner">
        Ficha do veículo e o nome do proprietário vêm do provedor de dados
        real — só aparece quando a consulta funciona. Débitos de
        IPVA/licenciamento e FIPE ainda não têm fonte de dados disponível
        nessa consulta. Renajud (restrição judicial) tem consulta avançada
        real, sob demanda — veja o botão no card abaixo (custo por
        consulta). Multas, roubo/furto e outros serviços de consulta
        avançada estão na aba &quot;Consulta Avançada&quot;. O dossiê
        completo do proprietário (CPF/CNPJ, telefones, e-mails, endereços) é
        liberado à parte, no botão do próprio card Dados do proprietário.
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

      {realError && (
        <p className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>
          {realError}
        </p>
      )}

      {saldoSimples && saldoSimples.origem !== "cota" && (
        <div className="info-banner no-print" style={{ marginBottom: 20 }}>
          {saldoSimples.origem === "credito"
            ? `Cota de consultas simples do mês esgotada — essa consulta usou 1 crédito de recarga (restam ${saldoSimples.creditos}).`
            : `Cota de consultas simples do mês esgotada e sem crédito de recarga disponível — essa consulta foi cobrada avulsa.`}{" "}
          <a href="/dashboard/creditos">Ver créditos</a>
        </div>
      )}

      {veiculoReal && (
        <div className="printable-report">
          <div className="print-header">
            <div className="brand">
              DOC<span>.CAR</span>
            </div>
            <p>
              Ficha de consulta veicular — placa {veiculoReal.placa} — emitida em{" "}
              {new Date().toLocaleString("pt-BR")}
            </p>
          </div>

          <div className="card">
            <div className="result-title">
              <h2>{veiculoReal.placa}</h2>
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
              {fromCache && (
                <button
                  type="button"
                  className="print-button no-print"
                  disabled={loading}
                  onClick={() => void runSearch(veiculoReal.placa)}
                >
                  Consultar novamente (gasta cota)
                </button>
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
                  {`${veiculoReal.marca || ""} ${veiculoReal.modelo || ""}`.trim() || "—"}
                </span>
              </div>
              <div className="kv">
                <span className="label">Ano modelo/fabricação</span>
                <span className="value">
                  {veiculoReal.anoModelo ?? "—"}/{veiculoReal.anoFabricacao ?? "—"}
                </span>
              </div>
              <div className="kv">
                <span className="label">Cor</span>
                <span className="value">{veiculoReal.cor || "—"}</span>
              </div>

              <div className="kv">
                <span className="label">Combustível</span>
                <span className="value">{veiculoReal.combustivel || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Município/UF</span>
                <span className="value">
                  {veiculoReal.municipio || "—"}/{veiculoReal.uf || "—"}
                </span>
              </div>
              {veiculoReal.placaMercosul && (
                <div className="kv">
                  <span className="label">Placa Mercosul</span>
                  <span className="value">{veiculoReal.placaMercosul}</span>
                </div>
              )}
              {veiculoReal.placaAnterior && (
                <div className="kv">
                  <span className="label">Placa anterior</span>
                  <span className="value">{veiculoReal.placaAnterior}</span>
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
              <div className="kv">
                <span className="label">Valor FIPE</span>
                <span className="value">
                  {veiculoReal.fipe ? currency.format(veiculoReal.fipe.valor) : "Não disponível"}
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
              {veiculoReal.proprietarioNome && (
                <div className="kv">
                  <span className="label">Proprietário</span>
                  <span className="value">{veiculoReal.proprietarioNome}</span>
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

          {!proprietarioLiberado &&
            (veiculoReal.proprietarioNome || veiculoReal.proprietarioDocumento) && (
              <div className="card">
                <h3>
                  Dados do proprietário <span className="badge neutral">Plus</span>
                </h3>
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                  CPF/CNPJ, nome da mãe, telefones e endereços do proprietário — consulta
                  avançada, dentro da cota do seu plano (ou{" "}
                  {currency.format(PRECO_PROPRIETARIO_AVULSO_CENTAVOS / 100)} avulso se a cota do
                  mês já acabou).
                </p>
                {proprietarioError && (
                  <p className="form-error" style={{ marginBottom: 12 }}>
                    {proprietarioError}
                  </p>
                )}
                <button
                  type="button"
                  className="secondary-button destaque"
                  onClick={liberarProprietario}
                  disabled={proprietarioLoading}
                >
                  {proprietarioLoading ? "Liberando..." : "Consulta Avançada — ver dados completos"}
                </button>
              </div>
            )}

          {proprietarioLiberado && (veiculoReal.proprietarioNome || veiculoReal.proprietarioDocumento) && (
            <div className="card">
              <h3>
                Dados do proprietário <span className="badge ok">Dados reais</span>
              </h3>
              {proprietarioSaldo && proprietarioSaldo.origem !== "cota" && (
                <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                  {proprietarioSaldo.origem === "credito"
                    ? `Cota de consulta avançada do mês esgotada — essa liberação usou 1 crédito de recarga (restam ${proprietarioSaldo.creditos}).`
                    : `Cota de consulta avançada do mês esgotada e sem crédito de recarga disponível — essa liberação foi cobrada avulsa (${currency.format(PRECO_PROPRIETARIO_AVULSO_CENTAVOS / 100)}).`}
                </p>
              )}
              <div className="grid-3">
                {veiculoReal.proprietarioNome && (
                  <div className="kv">
                    <span className="label">Nome</span>
                    <span className="value">{veiculoReal.proprietarioNome}</span>
                  </div>
                )}
                {veiculoReal.proprietarioDocumento && (
                  <div className="kv">
                    <span className="label">CPF/CNPJ</span>
                    <span className="value">
                      {veiculoReal.proprietarioCnpj
                        ? formatCnpj(veiculoReal.proprietarioCnpj)
                        : veiculoReal.proprietarioCpf
                          ? formatCpf(veiculoReal.proprietarioCpf)
                          : veiculoReal.proprietarioDocumento}
                    </span>
                  </div>
                )}
                {veiculoReal.proprietarioNomeMae && (
                  <div className="kv">
                    <span className="label">Nome da mãe</span>
                    <span className="value">{veiculoReal.proprietarioNomeMae}</span>
                  </div>
                )}
                {veiculoReal.proprietarioDataNascimentoFundacao && (
                  <div className="kv">
                    <span className="label">Nascimento/Fundação</span>
                    <span className="value">{veiculoReal.proprietarioDataNascimentoFundacao}</span>
                  </div>
                )}
                {veiculoReal.proprietarioSexo && (
                  <div className="kv">
                    <span className="label">Sexo</span>
                    <span className="value">{veiculoReal.proprietarioSexo}</span>
                  </div>
                )}
                {veiculoReal.proprietarioSituacaoReceita && (
                  <div className="kv">
                    <span className="label">Situação na Receita</span>
                    <span className="value">{veiculoReal.proprietarioSituacaoReceita}</span>
                  </div>
                )}
                {veiculoReal.proprietarioTipoPessoa && (
                  <div className="kv">
                    <span className="label">Tipo</span>
                    <span className="value">{veiculoReal.proprietarioTipoPessoa}</span>
                  </div>
                )}
              </div>

              {veiculoReal.proprietarioTelefonesCelular &&
                veiculoReal.proprietarioTelefonesCelular.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <span className="label">Telefone(s) celular</span>
                    <p style={{ fontSize: 13, marginTop: 4 }}>
                      {veiculoReal.proprietarioTelefonesCelular.join(" · ")}
                    </p>
                  </div>
                )}
              {veiculoReal.proprietarioTelefonesFixo &&
                veiculoReal.proprietarioTelefonesFixo.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <span className="label">Telefone(s) fixo</span>
                    <p style={{ fontSize: 13, marginTop: 4 }}>
                      {veiculoReal.proprietarioTelefonesFixo.join(" · ")}
                    </p>
                  </div>
                )}
              {veiculoReal.proprietarioEmails && veiculoReal.proprietarioEmails.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <span className="label">E-mail(s)</span>
                  <p style={{ fontSize: 13, marginTop: 4 }}>
                    {veiculoReal.proprietarioEmails.join(" · ")}
                  </p>
                </div>
              )}
              {veiculoReal.proprietarioEnderecos && veiculoReal.proprietarioEnderecos.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <span className="label">Endereço(s)</span>
                  {veiculoReal.proprietarioEnderecos.map((endereco, idx) => (
                    <p key={idx} style={{ fontSize: 13, marginTop: 4 }}>
                      {[
                        endereco.endereco,
                        endereco.numero,
                        endereco.complemento,
                        endereco.bairro,
                        endereco.cidade && endereco.uf
                          ? `${endereco.cidade}/${endereco.uf}`
                          : endereco.cidade || endereco.uf,
                        endereco.cep,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {veiculoReal && (
            <div className="card">
              <h3>
                Renajud (restrição judicial){" "}
                {renajud.status === "ok" && <span className="badge ok">Dados reais</span>}
              </h3>
              <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
                Consulta avançada real via API Brasil, sob demanda — só consulta (e só cobra)
                quando você clicar.
              </p>
              {renajud.status !== "ok" && (
                <button
                  type="button"
                  className="secondary-button destaque"
                  onClick={() => void consultarRenajud()}
                  disabled={renajud.status === "loading"}
                >
                  {renajud.status === "loading"
                    ? "Consultando..."
                    : `Consultar Renajud (${currency.format(PRECO_RENAJUD_CENTAVOS / 100)})`}
                </button>
              )}
              {renajud.status === "error" && (
                <p className="form-error" style={{ marginTop: 12 }}>
                  {renajud.errorMessage}
                </p>
              )}
              {renajud.status === "ok" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                  {(extrairCamposAvulsa("renajud", renajud.data) ??
                    Object.entries(renajud.data).map(([chave, valor]) => ({
                      label: formatarLabelAvulsa(chave),
                      valor: formatarValorAvulsa(valor),
                    }))
                  ).map((campo) => (
                    <div key={campo.label} className="kv">
                      <span className="label">{campo.label}</span>
                      <span className="value">{campo.valor}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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
            <h3>Débitos</h3>
            <p style={{ fontSize: 13, color: "var(--muted)" }}>
              Nada consta. Consulta de débitos de IPVA e licenciamento ainda não disponível
              nesta versão.
            </p>
          </div>

          <div className="card">
            <h3>
              Restrições <span className="badge ok">Dados reais</span>
            </h3>
            {veiculoReal.restricoes.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nada consta.</p>
            ) : (
              veiculoReal.restricoes.map((restricao) => (
                <span key={restricao} className="badge warn" style={{ marginRight: 8, marginBottom: 8 }}>
                  {restricao}
                </span>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
