"use client";

import { useState, FormEvent } from "react";
import { ProprietarioAtual } from "@/lib/proprietario";

export default function ConsultarProprietarioForm() {
  const [placa, setPlaca] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<ProprietarioAtual | null>(null);

  async function consultar(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResultado(null);
    try {
      const response = await fetch(
        `/api/crm/proprietario?placa=${encodeURIComponent(placa)}&confirmacao=${encodeURIComponent(confirmacao)}`
      );
      const payload = await response.json();
      if (response.ok) {
        setResultado(payload.data);
        setConfirmacao("");
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
        <span className="label">Consultar proprietário</span>
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, marginBottom: 12 }}>
          Dado de uso profissional exclusivo, confidencial — cada consulta fica registrada na sua
          conta.
        </p>
        <form onSubmit={consultar}>
          <input
            type="text"
            value={placa}
            onChange={(event) => setPlaca(event.target.value)}
            placeholder="Placa (ex: ABC1D23)"
            required
            style={{ marginBottom: 8, width: "100%", textTransform: "uppercase" }}
          />
          <input
            type="text"
            value={confirmacao}
            onChange={(event) => setConfirmacao(event.target.value)}
            placeholder="Confirme seu CPF/CNPJ pra continuar"
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
          <span className="label">{resultado.nomeProprietario || "Proprietário"}</span>
          <p style={{ marginTop: 8, lineHeight: 1.8 }}>
            <strong>Documento:</strong> {resultado.documentoProprietario || "—"}
            {resultado.tipoDocumentoProprietario ? ` (${resultado.tipoDocumentoProprietario})` : ""}
            <br />
            <strong>Placa:</strong> {resultado.placa}
            <br />
            <strong>Veículo:</strong> {resultado.marcaModelo || "—"}
            <br />
            <strong>Ano:</strong> {resultado.anoFabricacao || "—"}/{resultado.anoModelo || "—"}
            <br />
            <strong>Cor:</strong> {resultado.cor || "—"}
            <br />
            <strong>Chassi:</strong> {resultado.chassi || "—"}
            <br />
            <strong>Renavam:</strong> {resultado.renavam || "—"}
            <br />
            <strong>Situação:</strong> {resultado.tipoSituacaoVeiculo || "—"}
            <br />
            <strong>Emplacamento:</strong> {resultado.municipioEmplacamento || "—"}/
            {resultado.ufJurisdicao || "—"}
          </p>
        </div>
      )}
    </>
  );
}
