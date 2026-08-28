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

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Consulta veicular</h1>
          <p>Digite a placa do veículo para consultar dados completos.</p>
        </div>
      </div>

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
        <div className="card">
          <h3>Dados reais da Infosimples (modo depuração)</h3>
          {realError ? (
            <p style={{ fontSize: 13, color: "var(--danger)" }}>{realError}</p>
          ) : (
            <pre
              style={{
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                maxHeight: 300,
                overflow: "auto",
                background: "#f5f6f8",
                padding: 12,
                borderRadius: 8,
              }}
            >
              {JSON.stringify(realData, null, 2)}
            </pre>
          )}
        </div>
      )}

      {result && (
        <>
          <div className="card">
            <h3>
              Dados do veículo — {result.placa}
              <span className="badge warn">Dados simulados</span>
            </h3>
            <div className="grid-3">
              <div className="kv">
                <span className="label">Marca</span>
                <span className="value">{result.marca}</span>
              </div>
              <div className="kv">
                <span className="label">Modelo</span>
                <span className="value">{result.modelo}</span>
              </div>
              <div className="kv">
                <span className="label">Cor</span>
                <span className="value">{result.cor}</span>
              </div>
              <div className="kv">
                <span className="label">Ano fabricação/modelo</span>
                <span className="value">
                  {result.anoFabricacao}/{result.anoModelo}
                </span>
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
            </div>
          </div>

          <div className="card">
            <h3>
              Tabela FIPE <span className="badge warn">Dados simulados</span>
            </h3>
            <div className="fipe-value">{currency.format(result.fipe.valor)}</div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
              Código FIPE {result.fipe.codigo} · Referência {result.fipe.mesReferencia}
            </p>
          </div>

          <div className="card">
            <h3>
              Débitos <span className="badge warn">Dados simulados</span>
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
              Restrições <span className="badge warn">Dados simulados</span>
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
