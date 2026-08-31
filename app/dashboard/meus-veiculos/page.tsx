"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MeuVeiculo } from "@/lib/meus-veiculos";
import Guardiao from "@/components/Guardiao";

export default function MeusVeiculosPage() {
  const [veiculos, setVeiculos] = useState<MeuVeiculo[] | null>(null);
  const [error, setError] = useState("");
  const [excluindo, setExcluindo] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/meus-veiculos");
        const payload = await response.json();
        if (response.ok) {
          setVeiculos(payload.veiculos);
        } else {
          setError(payload.error || "Não foi possível carregar seus veículos.");
        }
      } catch {
        setError("Não foi possível carregar seus veículos.");
      }
    })();
  }, []);

  async function excluir(placa: string) {
    if (!window.confirm(`Excluir o veículo ${placa} e o CRLV associado? Essa ação não pode ser desfeita.`)) {
      return;
    }
    setExcluindo(placa);
    try {
      const response = await fetch(`/api/meus-veiculos/${placa}`, { method: "DELETE" });
      if (response.ok) {
        setVeiculos((prev) => (prev || []).filter((v) => v.placa !== placa));
      } else {
        const payload = await response.json();
        setError(payload.error || "Não foi possível excluir o veículo.");
      }
    } catch {
      setError("Não foi possível excluir o veículo.");
    }
    setExcluindo(null);
  }

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Meus Veículos</h1>
          <p>
            Veículos que você mesma cadastrou ou importou da sua sessão SENATRAN — visível só
            pra sua conta.
          </p>
        </div>
        <Link href="/dashboard/meus-veiculos/novo" className="primary">
          Cadastrar veículo
        </Link>
      </div>

      <p className="hint" style={{ marginBottom: 16 }}>
        🔒 Dados pessoais — acesso restrito à sua conta.
      </p>

      {error && <div className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>{error}</div>}

      {veiculos === null && !error && (
        <div className="loading-state">
          <Guardiao pose="verificando" />
          <span>Carregando seus veículos...</span>
        </div>
      )}

      {veiculos && veiculos.length === 0 && (
        <div className="empty-state">
          <Guardiao
            pose="aguardando"
            mensagem="Você ainda não cadastrou nenhum veículo. Clique em “Cadastrar veículo” pra começar."
          />
        </div>
      )}

      {veiculos && veiculos.length > 0 && (
        <div className="card">
          {veiculos.map((veiculo) => (
            <div
              key={veiculo.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <Link href={`/dashboard/meus-veiculos/${veiculo.placa}`} style={{ fontWeight: 700 }}>
                  {veiculo.placa}
                </Link>
                <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>
                  {veiculo.marcaModelo || "—"}
                  {veiculo.proprietarioNome ? ` · ${veiculo.proprietarioNome}` : ""}
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {veiculo.crlvDisponivel && <span className="badge ok">CRLV disponível</span>}
                <Link href={`/dashboard/meus-veiculos/${veiculo.placa}`} className="secondary-button">
                  Ver detalhes
                </Link>
                <Link
                  href={`/dashboard/meus-veiculos/${veiculo.placa}/editar`}
                  className="secondary-button"
                >
                  Editar
                </Link>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => excluir(veiculo.placa)}
                  disabled={excluindo === veiculo.placa}
                >
                  {excluindo === veiculo.placa ? "Excluindo..." : "Excluir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
