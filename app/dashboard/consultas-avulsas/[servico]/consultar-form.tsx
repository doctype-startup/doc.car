"use client";

import { useState, FormEvent } from "react";
import { formatarLabelAvulsa, formatarValorAvulsa } from "@/lib/consultas-avulsas";
import { extrairCamposAvulsa } from "@/lib/consultas-avulsas-extratores";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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
            {(extrairCamposAvulsa(servicoId, resultado) ??
              Object.entries(resultado).map(([chave, valor]) => ({
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
