"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Modo = "manual" | "importar";

export default function NovoVeiculoPage() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("manual");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [avisoCrlv, setAvisoCrlv] = useState("");
  const [placaCriada, setPlacaCriada] = useState("");

  const [placa, setPlaca] = useState("");
  const [renavam, setRenavam] = useState("");
  const [chassi, setChassi] = useState("");
  const [marcaModelo, setMarcaModelo] = useState("");
  const [anoFabricacao, setAnoFabricacao] = useState("");
  const [anoModelo, setAnoModelo] = useState("");
  const [cor, setCor] = useState("");
  const [nomeProprietario, setNomeProprietario] = useState("");
  const [documentoProprietario, setDocumentoProprietario] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [jsonSenatran, setJsonSenatran] = useState("");

  async function arquivoParaBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    return Buffer.from(buffer).toString("base64");
  }

  async function handleCadastroManual(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const body: Record<string, unknown> = {
        placa,
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

      const response = await fetch("/api/meus-veiculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (response.ok) {
        if (payload.avisoCrlv) {
          setAvisoCrlv(payload.avisoCrlv);
          setPlacaCriada(payload.veiculo.placa);
        } else {
          router.push(`/dashboard/meus-veiculos/${payload.veiculo.placa}`);
        }
      } else {
        setError(payload.error || "Não foi possível cadastrar o veículo.");
      }
    } catch {
      setError("Não foi possível cadastrar o veículo.");
    }

    setLoading(false);
  }

  async function handleImportar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const parsed = JSON.parse(jsonSenatran);
      const response = await fetch("/api/meus-veiculos/importar-senatran", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const payload = await response.json();
      if (response.ok) {
        router.push("/dashboard/meus-veiculos");
      } else {
        setError(payload.error || "Não foi possível importar.");
      }
    } catch {
      setError("JSON inválido — confira se colou o objeto certo.");
    }

    setLoading(false);
  }

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Cadastrar veículo</h1>
          <p>Manualmente ou importando o JSON obtido na sua sessão SENATRAN.</p>
        </div>
        <Link href="/dashboard/meus-veiculos" className="secondary-button" style={{ textDecoration: "none" }}>
          Voltar
        </Link>
      </div>

      <div className="login-tabs" style={{ marginBottom: 20 }}>
        <button type="button" className={modo === "manual" ? "active" : ""} onClick={() => setModo("manual")}>
          Cadastro manual
        </button>
        <button type="button" className={modo === "importar" ? "active" : ""} onClick={() => setModo("importar")}>
          Importar da SENATRAN
        </button>
      </div>

      {error && <div className="form-error" style={{ maxWidth: 480, marginBottom: 20 }}>{error}</div>}

      {avisoCrlv && (
        <div className="info-banner" style={{ maxWidth: 480, marginBottom: 20 }}>
          {avisoCrlv}{" "}
          <Link href={`/dashboard/meus-veiculos/${placaCriada}`}>Ver veículo cadastrado</Link>
        </div>
      )}

      {modo === "manual" ? (
        <form className="card" onSubmit={handleCadastroManual} style={{ maxWidth: 560 }}>
          <div className="login-form">
            <label className="field">
              Placa *
              <input
                type="text"
                value={placa}
                onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                maxLength={7}
                required
              />
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
              PDF do CRLV
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button className="primary wide" type="submit" disabled={loading}>
              {loading ? "Salvando..." : "Cadastrar veículo"}
            </button>
          </div>
        </form>
      ) : (
        <form className="card" onSubmit={handleImportar} style={{ maxWidth: 560 }}>
          <div className="login-form">
            <p className="hint">
              Cole abaixo o JSON obtido diretamente na sua sessão autenticada do Portal SENATRAN —
              nunca envie token, cookie ou CAPTCHA, só o objeto de dados do veículo.
            </p>
            <label className="field">
              JSON da SENATRAN
              <textarea
                value={jsonSenatran}
                onChange={(e) => setJsonSenatran(e.target.value)}
                rows={12}
                required
                style={{
                  fontFamily: "monospace",
                  fontSize: 12,
                  padding: 10,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                }}
              />
            </label>
            <button className="primary wide" type="submit" disabled={loading}>
              {loading ? "Importando..." : "Importar"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
