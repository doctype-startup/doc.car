"use client";

import { useEffect, useState, use, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MeuVeiculo } from "@/lib/meus-veiculos";
import Guardiao from "@/components/Guardiao";

export default function EditarVeiculoPage({ params }: { params: Promise<{ placa: string }> }) {
  const { placa } = use(params);
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [avisoCrlv, setAvisoCrlv] = useState("");

  const [renavam, setRenavam] = useState("");
  const [chassi, setChassi] = useState("");
  const [marcaModelo, setMarcaModelo] = useState("");
  const [anoFabricacao, setAnoFabricacao] = useState("");
  const [anoModelo, setAnoModelo] = useState("");
  const [cor, setCor] = useState("");
  const [nomeProprietario, setNomeProprietario] = useState("");
  const [documentoProprietario, setDocumentoProprietario] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [crlvDisponivel, setCrlvDisponivel] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/meus-veiculos/${placa}`);
        const payload = await response.json();
        if (response.ok) {
          const veiculo: MeuVeiculo = payload.veiculo;
          setRenavam(veiculo.renavam || "");
          setChassi(veiculo.chassi || "");
          setMarcaModelo(veiculo.marcaModelo || "");
          setAnoFabricacao(veiculo.anoFabricacao ? String(veiculo.anoFabricacao) : "");
          setAnoModelo(veiculo.anoModelo ? String(veiculo.anoModelo) : "");
          setCor(veiculo.cor || "");
          setNomeProprietario(veiculo.proprietarioNome || "");
          setDocumentoProprietario(veiculo.proprietarioDocumento || "");
          setCrlvDisponivel(veiculo.crlvDisponivel);
        } else {
          setError(payload.error || "Veículo não encontrado.");
        }
      } catch {
        setError("Não foi possível carregar o veículo.");
      }
      setCarregando(false);
    })();
  }, [placa]);

  async function arquivoParaBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  }

  async function handleSalvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        renavam: renavam || undefined,
        chassi: chassi || undefined,
        marcaModelo: marcaModelo || undefined,
        anoFabricacao: anoFabricacao ? Number(anoFabricacao) : undefined,
        anoModelo: anoModelo ? Number(anoModelo) : undefined,
        cor: cor || undefined,
        nomeProprietario: nomeProprietario || undefined,
        numeroIdentificacaoProprietario: documentoProprietario || undefined,
      };
      if (pdfFile) {
        body.pdfBase64 = await arquivoParaBase64(pdfFile);
      }

      const response = await fetch(`/api/meus-veiculos/${placa}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (response.ok) {
        if (payload.avisoCrlv) {
          setAvisoCrlv(payload.avisoCrlv);
        } else {
          router.push(`/dashboard/meus-veiculos/${placa}`);
        }
      } else {
        setError(payload.error || "Não foi possível salvar as alterações.");
      }
    } catch {
      setError("Não foi possível salvar as alterações.");
    }

    setLoading(false);
  }

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Editar {placa}</h1>
          <p>Alterar os dados cadastrados por você pra esse veículo.</p>
        </div>
        <Link
          href={`/dashboard/meus-veiculos/${placa}`}
          className="secondary-button"
          style={{ textDecoration: "none" }}
        >
          Voltar
        </Link>
      </div>

      {error && <div className="form-error" style={{ maxWidth: 480, marginBottom: 20 }}>{error}</div>}

      {avisoCrlv && (
        <div className="info-banner" style={{ maxWidth: 480, marginBottom: 20 }}>
          {avisoCrlv}{" "}
          <Link href={`/dashboard/meus-veiculos/${placa}`}>Ver veículo</Link>
        </div>
      )}

      {carregando ? (
        <div className="loading-state">
          <Guardiao pose="verificando" />
          <span>Carregando...</span>
        </div>
      ) : (
        <form className="card" onSubmit={handleSalvar} style={{ maxWidth: 560 }}>
          <div className="login-form">
            <label className="field">
              Placa
              <input type="text" value={placa} disabled />
            </label>
            <label className="field">
              Renavam
              <input type="text" value={renavam} onChange={(e) => setRenavam(e.target.value)} />
            </label>
            <label className="field">
              Chassi
              <input type="text" value={chassi} onChange={(e) => setChassi(e.target.value)} />
            </label>
            <label className="field">
              Marca/Modelo
              <input type="text" value={marcaModelo} onChange={(e) => setMarcaModelo(e.target.value)} />
            </label>
            <div className="grid-2">
              <label className="field">
                Ano de fabricação
                <input
                  type="number"
                  value={anoFabricacao}
                  onChange={(e) => setAnoFabricacao(e.target.value)}
                />
              </label>
              <label className="field">
                Ano/modelo
                <input type="number" value={anoModelo} onChange={(e) => setAnoModelo(e.target.value)} />
              </label>
            </div>
            <label className="field">
              Cor
              <input type="text" value={cor} onChange={(e) => setCor(e.target.value)} />
            </label>
            <label className="field">
              Nome do proprietário
              <input
                type="text"
                value={nomeProprietario}
                onChange={(e) => setNomeProprietario(e.target.value)}
              />
            </label>
            <label className="field">
              CPF/CNPJ do proprietário
              <input
                type="text"
                value={documentoProprietario}
                onChange={(e) => setDocumentoProprietario(e.target.value)}
              />
            </label>
            <label className="field">
              PDF do CRLV{crlvDisponivel ? " (substituir)" : ""}
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {crlvDisponivel && !pdfFile && (
              <p className="hint">Já existe um PDF cadastrado — deixe em branco pra mantê-lo.</p>
            )}
            <button className="primary wide" type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
