"use client";

import { useEffect, useState, FormEvent, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  isValidPlaca,
  lookupVehicle,
  normalizePlaca,
  VehicleQuery,
} from "@/lib/vehicle";
import { addHistory } from "@/lib/history";
import Guardiao from "@/components/Guardiao";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const PLACAS_EXEMPLO = ["ABC1D23", "QRS4567", "JKL8M90"];

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
  const [realData, setRealData] = useState<unknown>(null);
  const [realError, setRealError] = useState("");

  async function runSearch(value: string) {
    setError("");
    setRealData(null);
    setRealError("");

    if (!isValidPlaca(value)) {
      setError("Informe uma placa válida, ex: ABC1D23 ou ABC1234.");
      setResult(null);
      return;
    }

    setLoading(true);

    const data = lookupVehicle(value);
    setResult(data);
    void addHistory(data.placa);

    try {
      const response = await fetch(`/api/veiculo?placa=${encodeURIComponent(data.placa)}`);
      const payload = await response.json();
      if (response.ok) {
        setRealData(payload.data);
      } else {
        setRealError(payload.error || "Consulta real indisponível.");
      }
    } catch {
      setRealError("Não foi possível contatar o provedor de dados.");
    }

    setLoading(false);
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

  return (
    <>
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
        Débitos e multas abaixo ainda são simulados — só a ficha do veículo,
        FIPE e restrições já vêm do provedor de dados real. O retorno da
        consulta real fica disponível no painel de depuração logo abaixo,
        quando houver.
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
          <Guardiao pose="aguardando" />
          Nenhuma consulta realizada ainda. Digite uma placa acima para
          começar.
        </div>
      )}

      {(realData !== null || realError) && (
        <details className="debug-details">
          <summary>Retorno da consulta real (modo depuração)</summary>
          {realError ? (
            <p style={{ fontSize: 13, color: "var(--danger)", marginTop: 12 }}>{realError}</p>
          ) : (
            <pre>{JSON.stringify(realData, null, 2)}</pre>
          )}
        </details>
      )}

      {result && (
        <>
          <div className="card">
            <div className="result-title">
              <h2>{result.placa}</h2>
              <span className={`badge ${result.licenciamentoEmDia ? "ok" : "warn"}`}>
                {result.licenciamentoEmDia ? "Licenciamento em dia" : "Licenciamento atrasado"}
              </span>
              <span className="badge neutral">Dados simulados</span>
            </div>

            <div className="grid-3">
              <div className="kv">
                <span className="label">Marca/Modelo</span>
                <span className="value">
                  {result.marca} {result.modelo}
                </span>
              </div>
              <div className="kv">
                <span className="label">Ano modelo/fabricação</span>
                <span className="value">
                  {result.anoModelo}/{result.anoFabricacao}
                </span>
              </div>
              <div className="kv">
                <span className="label">Cor</span>
                <span className="value">{result.cor}</span>
              </div>

              <div className="kv">
                <span className="label">Combustível</span>
                <span className="value">{result.combustivel}</span>
              </div>
              <div className="kv">
                <span className="label">Município/UF</span>
                <span className="value">
                  {result.municipio}/{result.uf}
                </span>
              </div>
              <div className="kv">
                <span className="label">Renavam</span>
                <span className="value">{result.renavam}</span>
              </div>

              <div className="kv">
                <span className="label">Chassi</span>
                <span className="value">{result.chassi}</span>
              </div>
              <div className="kv">
                <span className="label">Vencimento do licenciamento</span>
                <span className="value">{result.vencimentoLicenciamento}</span>
              </div>
              <div className="kv">
                <span className="label">Valor FIPE</span>
                <span className="value">
                  {result.fipe ? currency.format(result.fipe.valor) : "Não disponível"}
                </span>
              </div>
            </div>
          </div>

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
              Multas <span className="badge neutral">Dados simulados</span>
            </h3>
            {result.multas.length === 0 ? (
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

          <div className="card">
            <h3>
              Restrições <span className="badge neutral">Dados simulados</span>
            </h3>
            {result.restricoes.length === 0 ? (
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
        </>
      )}
    </>
  );
}
