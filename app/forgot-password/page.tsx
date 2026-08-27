"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="brand">
          DOC<span>.CAR</span>
        </div>
        <p>
          Consulta veicular completa para despachantes — placa, ficha
          técnica, FIPE, débitos e restrições em um só lugar. Um produto{" "}
          <strong>DOCTYPE</strong>.
        </p>
      </div>
      <div className="login-panel">
        <div className="login-card">
          <div className="orange-line" />
          <div style={{ padding: "20px 32px 32px" }}>
            <h2>Recuperar senha</h2>
            <p style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
              Informe seu e-mail cadastrado e enviaremos as instruções para
              redefinir sua senha.
            </p>

            {sent ? (
              <div className="form-success" style={{ marginTop: 20 }}>
                Se {email} estiver cadastrado, você receberá um e-mail com as
                instruções em instantes.
              </div>
            ) : (
              <form
                className="login-form"
                onSubmit={handleSubmit}
                style={{ padding: 0 }}
              >
                <label className="field">
                  <span>E-mail</span>
                  <input
                    type="email"
                    name="email"
                    placeholder="voce@despachante.com.br"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
                <button className="primary wide" type="submit">
                  Enviar instruções
                </button>
              </form>
            )}

            <p style={{ marginTop: 18, fontSize: 12 }}>
              <Link href="/login" style={{ color: "var(--brand-dark)" }}>
                ← Voltar para o login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
