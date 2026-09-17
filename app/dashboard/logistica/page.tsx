"use client";

import { useState, FormEvent } from "react";
import { Transportador } from "@/lib/rntrc";

type TipoBusca = "cpf_cnpj" | "rntrc" | "placa";

const PLACEHOLDERS: Record<TipoBusca, string> = {
  cpf_cnpj: "CPF ou CNPJ do transportador",
  rntrc: "Número do RNTRC",
  placa: "Placa do caminhão (ex: ABC1D23)",
};

export default function LogisticaPage() {
  const [tipo, setTipo] = useState<TipoBusca>("cpf_cnpj");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<Transportador | null>(null);

  async function consultar(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResultado(null);
    try {
      const response = await fetch(
        `/api/logistica/rntrc?tipo=${tipo}&valor=${encodeURIComponent(valor)}`
      );
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
            Transportadores Rodoviários de Cargas, da ANTT) — útil na inspeção de frotas e
            caminhões.
          </p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 420, marginBottom: 24 }}>
        <span className="label">Consultar RNTRC</span>
        <form onSubmit={consultar} style={{ marginTop: 12 }}>
          <select
            value={tipo}
            onChange={(event) => {
              setTipo(event.target.value as TipoBusca);
              setValor("");
            }}
            style={{ marginBottom: 8, width: "100%" }}
          >
            <option value="cpf_cnpj">Buscar por CPF/CNPJ</option>
            <option value="rntrc">Buscar por número do RNTRC</option>
            <option value="placa">Buscar por placa do caminhão</option>
          </select>
          <input
            type="text"
            value={valor}
            onChange={(event) => setValor(event.target.value)}
            placeholder={PLACEHOLDERS[tipo]}
            required
            style={{ marginBottom: 12, width: "100%" }}
          />
          {tipo === "placa" && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: -8, marginBottom: 12 }}>
              Só funciona quando o proprietário do caminhão é pessoa jurídica (CNPJ) — a busca
              primeiro identifica o dono da placa, depois consulta o RNTRC dele.
            </p>
          )}
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
