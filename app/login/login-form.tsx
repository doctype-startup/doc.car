"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { saveSession } from "@/lib/auth";

type Tab = "login" | "signup";

export default function LoginSignupForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    if (!email || !password) {
      setError("Informe e-mail e senha para continuar.");
      return;
    }

    setLoading(true);
    saveSession({ email, name: email.split("@")[0] });
    router.push("/dashboard");
  }

  function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "");
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (!name || !email || !password) {
      setError("Preencha todos os campos para criar sua conta.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    setLoading(true);
    saveSession({ email, name });
    router.push("/dashboard");
  }

  return (
    <>
      <div className="login-tabs">
        <button
          type="button"
          className={tab === "login" ? "active" : ""}
          onClick={() => {
            setTab("login");
            setError("");
          }}
        >
          Entrar
        </button>
        <button
          type="button"
          className={tab === "signup" ? "active" : ""}
          onClick={() => {
            setTab("signup");
            setError("");
          }}
        >
          Cadastrar despachante
        </button>
      </div>

      {tab === "login" ? (
        <>
          <h2>Acesse sua conta</h2>
          <p>Entre com o e-mail e senha do seu despachante.</p>
          <form className="login-form" onSubmit={handleLogin}>
            {error && <div className="form-error">{error}</div>}
            <label className="field">
              <span>E-mail</span>
              <input
                type="email"
                name="email"
                placeholder="voce@despachante.com.br"
                required
              />
            </label>
            <label className="field">
              <span>Senha</span>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                minLength={1}
              />
            </label>
            <div style={{ textAlign: "right", marginTop: "-6px" }}>
              <a
                style={{
                  fontSize: "11px",
                  color: "var(--muted)",
                  textDecoration: "none",
                }}
                href="/forgot-password"
              >
                Esqueceu a senha?
              </a>
            </div>
            <button className="primary wide" type="submit" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </>
      ) : (
        <>
          <h2>Criar conta de despachante</h2>
          <p>Cadastre-se para começar a consultar veículos.</p>
          <form className="login-form" onSubmit={handleSignup}>
            {error && <div className="form-error">{error}</div>}
            <label className="field">
              <span>Nome completo</span>
              <input type="text" name="name" placeholder="Seu nome" required />
            </label>
            <label className="field">
              <span>E-mail</span>
              <input
                type="email"
                name="email"
                placeholder="voce@despachante.com.br"
                required
              />
            </label>
            <label className="field">
              <span>Senha</span>
              <input
                type="password"
                name="password"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </label>
            <label className="field">
              <span>Confirmar senha</span>
              <input
                type="password"
                name="confirm"
                placeholder="••••••••"
                required
                minLength={6}
              />
            </label>
            <button className="primary wide" type="submit" disabled={loading}>
              {loading ? "Criando conta..." : "Cadastrar"}
            </button>
          </form>
        </>
      )}
    </>
  );
}
