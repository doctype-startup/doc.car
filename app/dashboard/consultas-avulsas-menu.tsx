"use client";

import { useEffect, useRef, useState } from "react";

/** Grupos do menu — ainda sem serviços cadastrados, cada um vai ganhar seus
 * próprios itens (com API própria) conforme forem sendo implementados. */
const GRUPOS = ["Consulta simples", "Consulta avançada"];

export default function ConsultasAvulsasMenu() {
  const [aberto, setAberto] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClickFora(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAberto(false);
      }
    }
    function handleEsc(event: KeyboardEvent) {
      if (event.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", handleClickFora);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleClickFora);
      document.removeEventListener("keydown", handleEsc);
    };
  }, []);

  return (
    <div className="consultas-avulsas" ref={menuRef}>
      <button
        type="button"
        className={`consultas-avulsas-trigger${aberto ? " active" : ""}`}
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="true"
      >
        Consultas Avulsas
        <span className="consultas-avulsas-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {aberto && (
        <div className="consultas-avulsas-panel" role="menu">
          {GRUPOS.map((titulo) => (
            <div key={titulo} className="consultas-avulsas-grupo">
              <span className="consultas-avulsas-titulo">{titulo}</span>
              <span className="consultas-avulsas-vazio">Em breve</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
