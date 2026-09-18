"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function CadastrarCpfCnpjForm() {
  const router = useRouter();
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function salvar(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/perfil/cpf-cnpj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cpfCnpj }),
      });
      if (response.ok) {
        router.refresh();
      } else {
        const payload = await response.json();
        setError(payload.error || "Não foi possível salvar.");
      }
    } catch {
      setError("Não foi possível salvar.");
    }
    setLoading(false);
  }

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <span className="label">Cadastre seu CPF/CNPJ</span>
      <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 8, marginBottom: 12 }}>
        A aba CRM libera dados pessoais completos de proprietários de veículos (nome, CPF/CNPJ).
        Por segurança, exigimos reconfirmar seu próprio CPF/CNPJ a cada consulta — cadastre uma
        vez aqui.
      </p>
      <form onSubmit={salvar}>
        <input
          type="text"
          value={cpfCnpj}
          onChange={(event) => setCpfCnpj(event.target.value)}
          placeholder="Seu CPF ou CNPJ"
          required
          style={{ marginBottom: 12, width: "100%" }}
        />
        <button className="primary wide" type="submit" disabled={loading}>
          {loading ? "Salvando..." : "Salvar"}
        </button>
      </form>
      {error && (
        <p className="form-error" style={{ marginTop: 12 }}>
          {error}
        </p>
      )}
    </div>
  );
}
