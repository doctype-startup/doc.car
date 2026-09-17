"use client";

import { useState, FormEvent } from "react";
import { Transportador } from "@/lib/rntrc";

export default function LogisticaPage() {
  const [documento, setDocumento] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<Transportador | null>(null);

  async function consultar(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResultado(null);
    try {
      const response = await fetch(`/api/logistica/rntrc?documento=${encodeURIComponent(documento)}`);
      const payload = await response.json();
      if (response.ok) {
        setResultado(payload.data);
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
      <div className="app-header">
        <div>
          <h1>Logística</h1>
          <p>
            Consulte a situação de um transportador no RNTRC (Registro Nacional de
            Transportadores Rodoviários de Cargas, da ANTT) pelo CPF ou CNPJ — útil na
            inspeção de frotas e caminhões.
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 420, marginBottom: 24 }}>
        <span className="label">Consultar RNTRC</span>
        <form onSubmit={consultar} style={{ marginTop: 12 }}>
          <input
            type="text"
            value={documento}
            onChange={(event) => setDocumento(event.target.value)}
            placeholder="CPF ou CNPJ do transportador"
            required
            style={{ marginBottom: 12, width: "100%" }}
          />
          <button className="primary wide" type="submit" disabled={loading}>
            {loading ? "Consultando..." : "Consultar"}
          </button>
        </form>
      </div>

      {error && (
        <p className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>
          {error}
        </p>
      )}

      {resultado && (
        <div className="card" style={{ maxWidth: 480 }}>
          <span className="label">{resultado.nomeRazaoSocial || "Transportador"}</span>
          <p style={{ marginTop: 8, lineHeight: 1.8 }}>
            <strong>RNTRC:</strong> {resultado.rntrc}
            <br />
            <strong>Tipo:</strong> {resultado.tipoTransportador || "—"}
            <br />
            <strong>CPF/CNPJ:</strong> {resultado.cpfCnpj}
            <br />
            <strong>Situação:</strong>{" "}
            <span
              className={`badge ${resultado.situacaoCadastral === "ATIVO" ? "ok" : "warn"}`}
            >
              {resultado.situacaoCadastral || "desconhecida"}
            </span>
            <br />
            <strong>Validade:</strong> {resultado.dataValidade || "—"}
            <br />
            <strong>Município/UF:</strong> {resultado.municipio || "—"}/{resultado.uf || "—"}
          </p>
        </div>
      )}
    </>
  );
}
