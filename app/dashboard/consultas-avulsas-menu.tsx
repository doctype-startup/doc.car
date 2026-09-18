"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CONSULTAS_AVULSAS } from "@/lib/consultas-avulsas";

// Todo serviço "avançada" ganha link próprio no menu — os que também
// entram no combo automático de Consultar placa (incluirNoCombo !== false)
// aparecem nos dois lugares.
const SERVICOS_AVANCADA = CONSULTAS_AVULSAS.filter((servico) => servico.grupo === "avancada");

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
          <div className="consultas-avulsas-grupo">
            <span className="consultas-avulsas-titulo">Consulta simples</span>
            <span className="consultas-avulsas-vazio">Em breve</span>
          </div>
          <div className="consultas-avulsas-grupo">
            <span className="consultas-avulsas-titulo">Consulta avançada</span>
            <Link href="/dashboard" onClick={() => setAberto(false)}>
              Combo completo em Consultar placa
            </Link>
            {SERVICOS_AVANCADA.map((servico) => (
              <Link
                key={servico.id}
                href={`/dashboard/consultas-avulsas/${servico.id}`}
                onClick={() => setAberto(false)}
              >
                {servico.nome}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
