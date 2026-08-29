"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Guardiao from "./Guardiao";

const DICAS: { match: (pathname: string) => boolean; texto: string }[] = [
  {
    match: (p) => p === "/dashboard",
    texto:
      "Dica: clique numa placa de exemplo pra ver a ficha na hora, ou digite a sua. Depois de consultar, dá pra imprimir a ficha.",
  },
  {
    match: (p) => p.startsWith("/dashboard/historico"),
    texto:
      "Aqui fica o histórico das suas últimas consultas — clique numa placa pra consultar de novo.",
  },
  {
    match: () => true,
    texto: "Precisa de ajuda? Fale com o suporte da DOCTYPE.",
  },
];

/**
 * Assistente flutuante do Guardião — botão fixo no canto da tela que mostra
 * uma dica contextual conforme a página atual.
 */
export default function GuardiaoHelper() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const dica = DICAS.find((d) => d.match(pathname))?.texto ?? "";

  return (
    <div className="guardiao-helper">
      {open && (
        <div className="guardiao-helper-panel">
          <h4>Guardião DOCTYPE</h4>
          <p>{dica}</p>
        </div>
      )}
      <button
        type="button"
        className="guardiao-helper-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir dicas do Guardião"
      >
        <Guardiao pose="aguardando" size={44} />
      </button>
    </div>
  );
}
