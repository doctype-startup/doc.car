"use client";

import { useState, FormEvent } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type ResultadoServico = {
  servicoId: string;
  nome: string;
  precoCentavos: number;
} & ({ ok: true; data: Record<string, unknown> } | { ok: false; errorMessage: string });

function formatarLabel(chave: string) {
  return chave.replace(/_/g, " ").replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (Array.isArray(valor)) {
    return valor.length > 0 ? valor.map((item) => formatarValor(item)).join(", ") : "—";
  }
  if (typeof valor === "object") {
    return Object.entries(valor as Record<string, unknown>)
      .map(([chave, item]) => `${formatarLabel(chave)}: ${formatarValor(item)}`)
      .join(" · ");
  }
  return String(valor);
}

export default function ConsultarAvancadaForm() {
  const [placa, setPlaca] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultados, setResultados] = useState<ResultadoServico[] | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);

  async function consultar(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResultados(null);
    try {
      const response = await fetch(
        `/api/consultas-avulsas/avancada?placa=${encodeURIComponent(placa)}`
      );
      const payload = await response.json();
      if (response.ok) {
        setResultados(payload.resultados);
        setSaldo(payload.saldo ?? null);
      } else {
        setError(payload.error || "Não foi possível consultar.");
      }
    } catch {
      setError("Não foi possível consultar.");
    }
    setLoading(false);
  }

  return (
    <>
      <div className="card" style={{ maxWidth: 420, marginBottom: 24 }}>
        <form onSubmit={consultar}>
          <input
            type="text"
            value={placa}
            onChange={(event) => setPlaca(event.target.value.toUpperCase())}
            placeholder="Placa (ex: ABC1D23)"
            required
            style={{ marginBottom: 12, width: "100%" }}
          />
          <button className="primary wide" type="submit" disabled={loading}>
            {loading ? "Consultando todas as APIs..." : "Consultar"}
          </button>
        </form>
      </div>

      {error && (
        <p className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>
          {error}
        </p>
      )}

      {resultados && (
        <>
          {saldo !== null && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              Saldo restante: {currency.format(saldo / 100)}
            </p>
          )}
          {resultados.map((resultado) => (
            <div key={resultado.servicoId} className="card" style={{ maxWidth: 560 }}>
              <span className="label">
                {resultado.nome}{" "}
                <span className={`badge ${resultado.ok ? "ok" : "warn"}`}>
                  {resultado.ok ? "Dados reais" : "Não disponível"}
                </span>
              </span>

              {resultado.ok ? (
                <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(resultado.data).map(([chave, valor]) => (
                    <div key={chave} className="kv">
                      <span className="label">{formatarLabel(chave)}</span>
                      <span className="value">{formatarValor(valor)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8 }}>
                  {resultado.errorMessage}
                </p>
              )}
            </div>
          ))}
        </>
      )}
    </>
  );
}
