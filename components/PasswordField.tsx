"use client";

import { useId, useState, type InputHTMLAttributes, type CSSProperties } from "react";

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  wrapperStyle?: CSSProperties;
};

/** Campo de senha com botão de mostrar/ocultar — usado em qualquer lugar do
 * app que peça senha (login, cadastro, senha provisória no admin). Fica
 * oculta por padrão, como um campo de senha normal; o botão só alterna a
 * visibilidade, sem mudar o valor digitado. */
export default function PasswordField({
  wrapperStyle,
  style,
  id,
  ...inputProps
}: PasswordFieldProps) {
  const [visivel, setVisivel] = useState(false);
  const gerarId = useId();
  const inputId = id ?? gerarId;

  return (
    <div style={{ position: "relative", ...wrapperStyle }}>
      <input
        {...inputProps}
        id={inputId}
        type={visivel ? "text" : "password"}
        style={{ ...style, width: "100%", paddingRight: 34, boxSizing: "border-box" }}
      />
      <button
        type="button"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visivel}
        tabIndex={-1}
        style={{
          position: "absolute",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "transparent",
          padding: 4,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          color: "var(--muted)",
        }}
      >
        {visivel ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a13.16 13.16 0 0 1-1.67 2.68" />
            <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 8 10 8a9.74 9.74 0 0 0 5.39-1.61" />
            <path d="M2 2l20 20" />
            <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}
