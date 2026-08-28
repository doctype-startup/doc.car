"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Tab = "login" | "signup";

function translateAuthError(message: string) {
  if (message.includes("Invalid login credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (message.includes("User already registered")) {
    return "Já existe uma conta com este e-mail.";
  }
  if (message.includes("Password should be at least")) {
    return "A senha deve ter pelo menos 6 caracteres.";
  }
  return message;
}

export default function LoginSignupForm() {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("login");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);

    if (signInError) {
      setError(translateAuthError(signInError.message));
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setInfo("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "");
    const email = String(form.get("email") || "");
    const password = String(form.get("password") || "");
    const confirm = String(form.get("confirm") || "");

    if (password !== confirm) {
      setError("As senhas informadas não coincidem.");
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    setLoading(false);

    if (signUpError) {
      setError(translateAuthError(signUpError.message));
      return;
    }

    if (data.session) {
      router.push("/dashboard");
      router.refresh();
      return;
    }

    setInfo("Conta criada! Verifique seu e-mail para confirmar o cadastro antes de entrar.");
    setTab("login");
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
            {info && <div className="form-success">{info}</div>}
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
