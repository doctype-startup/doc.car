"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { MeuVeiculo, formatarDocumento } from "@/lib/meus-veiculos";
import Guardiao from "@/components/Guardiao";

const INDICADOR_LABEL: Record<keyof MeuVeiculo["indicadores"], string> = {
  alarme: "Alarme",
  rouboFurto: "Roubo/furto",
  comunicacaoVenda: "Comunicação de venda",
  leilao: "Leilão",
  multaRenainf: "Multa (Renainf)",
  pendenciaEmissao: "Pendência de emissão",
  recallMontadora: "Recall da montadora",
  restricaoRenajud: "Restrição judicial (Renajud)",
  restricaoPgfn: "Restrição PGFN",
};

export default function DetalheVeiculoPage({ params }: { params: Promise<{ placa: string }> }) {
  const { placa } = use(params);
  const [veiculo, setVeiculo] = useState<MeuVeiculo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/meus-veiculos/${placa}`);
        const payload = await response.json();
        if (response.ok) {
          setVeiculo(payload.veiculo);
        } else {
          setError(payload.error || "Veículo não encontrado.");
        }
      } catch {
        setError("Não foi possível carregar o veículo.");
      }
    })();
  }, [placa]);

  const indicadoresAtivos = veiculo
    ? (Object.keys(veiculo.indicadores) as (keyof MeuVeiculo["indicadores"])[]).filter(
        (chave) => veiculo.indicadores[chave]
      )
    : [];

  return (
    <>
      <div className="app-header">
        <div>
          <h1>{placa}</h1>
          <p>Dados completos — visível só pra sua conta.</p>
        </div>
        <Link href="/dashboard/meus-veiculos" className="secondary-button" style={{ textDecoration: "none" }}>
          Voltar
        </Link>
      </div>

      <p className="hint" style={{ marginBottom: 16 }}>
        🔒 Dados pessoais — acesso restrito à sua conta.
      </p>

      {error && <div className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>{error}</div>}

      {!veiculo && !error && (
        <div className="loading-state">
          <Guardiao pose="verificando" />
          <span>Carregando...</span>
        </div>
      )}

      {veiculo && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="result-title">
              <h2>{veiculo.placa}</h2>
              {veiculo.crlvDisponivel && <span className="badge ok">CRLV disponível</span>}
            </div>
            <div className="grid-3">
              <div className="kv">
                <span className="label">Renavam</span>
                <span className="value">{veiculo.renavam || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Chassi</span>
                <span className="value">{veiculo.chassi || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Marca/Modelo</span>
                <span className="value">{veiculo.marcaModelo || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Ano fabricação/modelo</span>
                <span className="value">
                  {veiculo.anoFabricacao ?? "—"}/{veiculo.anoModelo ?? "—"}
                </span>
              </div>
              <div className="kv">
                <span className="label">Cor</span>
                <span className="value">{veiculo.cor || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Exercício</span>
                <span className="value">{veiculo.exercicio ?? "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Categoria</span>
                <span className="value">{veiculo.categoria || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Espécie</span>
                <span className="value">{veiculo.especie || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Tipo</span>
                <span className="value">{veiculo.tipoVeiculo || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Combustível</span>
                <span className="value">{veiculo.combustivel || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Cilindradas</span>
                <span className="value">{veiculo.cilindradas || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Município/UF de emplacamento</span>
                <span className="value">
                  {veiculo.municipioEmplacamento || "—"}/{veiculo.ufJurisdicao || "—"}
                </span>
              </div>
              <div className="kv">
                <span className="label">Situação</span>
                <span className="value">{veiculo.situacao || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Procedência</span>
                <span className="value">{veiculo.procedencia || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">Emissão do CRV</span>
                <span className="value">{veiculo.dataEmissaoCrv || "—"}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Proprietário</h3>
            <div className="grid-3">
              <div className="kv">
                <span className="label">Nome</span>
                <span className="value">{veiculo.proprietarioNome || "—"}</span>
              </div>
              <div className="kv">
                <span className="label">{veiculo.proprietarioTipo === "Juridica" ? "CNPJ" : "CPF/CNPJ"}</span>
                <span className="value">
                  {veiculo.proprietarioDocumento
                    ? formatarDocumento(veiculo.proprietarioDocumento)
                    : "—"}
                </span>
              </div>
              <div className="kv">
                <span className="label">Tipo</span>
                <span className="value">{veiculo.proprietarioTipo || "—"}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3>Indicadores</h3>
            {indicadoresAtivos.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nada consta.</p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {indicadoresAtivos.map((chave) => (
                  <span key={chave} className="badge warn">
                    {INDICADOR_LABEL[chave]}
                  </span>
                ))}
              </div>
            )}
          </div>

          {veiculo.restricoes.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3>Restrições</h3>
              {veiculo.restricoes.map((restricao, idx) => (
                <span key={idx} className="badge warn" style={{ marginRight: 8, marginBottom: 8 }}>
                  {restricao.descricao}
                </span>
              ))}
            </div>
          )}

          <div className="card">
            <h3>CRLV</h3>
            {veiculo.crlvDisponivel ? (
              <div style={{ display: "flex", gap: 10 }}>
                <a
                  className="secondary-button"
                  href={`/api/meus-veiculos/${veiculo.placa}/crlv?visualizar=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Visualizar CRLV
                </a>
                <a className="primary" href={`/api/meus-veiculos/${veiculo.placa}/crlv`}>
                  Baixar CRLV
                </a>
              </div>
            ) : (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>
                Nenhum PDF de CRLV cadastrado pra esse veículo ainda.
              </p>
            )}
          </div>
        </>
      )}
    </>
  );
}
