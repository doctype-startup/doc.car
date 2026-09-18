"use client";

import { useState, FormEvent } from "react";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** Deixa a chave da API (snake_case) mais legível pra exibição genérica —
 * cada serviço tem um formato de resposta diferente, então a ficha não tem
 * como ter um label específico por campo (ao contrário das consultas
 * já sanitizadas de lib/dados-veiculo.ts e lib/proprietario.ts). */
function formatarLabel(chave: string) {
  return chave
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
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

export default function ConsultarAvulsaForm({
  servicoId,
  precoCentavos,
}: {
  servicoId: string;
  precoCentavos: number;
}) {
  const [placa, setPlaca] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null);
  const [saldo, setSaldo] = useState<number | null>(null);

  async function consultar(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResultado(null);
    try {
      const response = await fetch(
        `/api/consultas-avulsas?servico=${encodeURIComponent(servicoId)}&placa=${encodeURIComponent(placa)}`
      );
      const payload = await response.json();
      if (response.ok) {
        setResultado(payload.data);
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
            {loading ? "Consultando..." : `Consultar (${currency.format(precoCentavos / 100)})`}
          </button>
        </form>
      </div>

      {error && (
        <p className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>
          {error}
        </p>
      )}

      {resultado && (
        <div className="card" style={{ maxWidth: 560 }}>
          <span className="label">Resultado</span>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(resultado).map(([chave, valor]) => (
              <div key={chave} className="kv">
                <span className="label">{formatarLabel(chave)}</span>
                <span className="value">{formatarValor(valor)}</span>
              </div>
            ))}
          </div>
          {saldo !== null && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
              Saldo restante: {currency.format(saldo / 100)}
            </p>
          )}
        </div>
      )}
    </>
  );
}
