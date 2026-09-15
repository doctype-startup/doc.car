"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Guardiao from "./Guardiao";
import { useGuardiaoContext } from "./guardiao-context";

const INTERVALO_STATUS_MS = 20000;

type StatusProvedor = { online: boolean; verificadoEm: string } | null;

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
  const [status, setStatus] = useState<StatusProvedor>(null);
  const guardiao = useGuardiaoContext();

  const dica = DICAS.find((d) => d.match(pathname))?.texto ?? "";
  // Na tela de consulta, se já existe um resumo da ficha atual, ele
  // substitui a dica genérica — é o que há de mais útil pra mostrar ali.
  const resumo = pathname === "/dashboard" ? guardiao?.resumo : null;
  const alerta = Boolean(resumo?.alerta);

  useEffect(() => {
    let cancelado = false;

    async function verificar() {
      try {
        const response = await fetch("/api/status/provedor");
        if (response.ok && !cancelado) {
          const payload = await response.json();
          setStatus({ online: Boolean(payload.online), verificadoEm: payload.verificadoEm });
        }
      } catch {
        // mantém o último status conhecido em caso de falha de rede
      }
    }

    void verificar();
    const timer = setInterval(() => void verificar(), INTERVALO_STATUS_MS);
    return () => {
      cancelado = true;
      clearInterval(timer);
    };
  }, []);

  const monitorClasse =
    status === null ? "" : status.online ? " monitor-online" : " monitor-offline";

  return (
    <div className="guardiao-helper">
      {open && (
        <div className="guardiao-helper-panel">
          {status && (
            <div className={`guardiao-monitor-card${status.online ? "" : " offline"}`}>
              <span className="guardiao-monitor-eyebrow">
                {status.online ? "Provedor em dia" : "Provedor indisponível"}
              </span>
              <span className="guardiao-monitor-titulo">
                {status.online
                  ? "Consulta de placas disponível."
                  : "Consulta de placas fora do ar."}
              </span>
              <span className="guardiao-monitor-desc">
                {status.online
                  ? "Nenhuma indisponibilidade no momento."
                  : "O provedor de dados não está respondendo — novas consultas podem falhar."}
              </span>
              <span className="guardiao-monitor-fonte">
                <span className={`status-dot${status.online ? "" : " offline"}`} />
                Fonte: monitoramento do provedor de dados
              </span>
            </div>
          )}
          <h4>Guardião DOCTYPE</h4>
          <p>{resumo?.texto || dica}</p>
        </div>
      )}
      <button
        type="button"
        className={`guardiao-helper-toggle${alerta ? " has-alert" : ""}${monitorClasse}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Abrir dicas do Guardião"
      >
        <Guardiao pose={resumo ? (alerta ? "aprovacao" : "sucesso") : "aguardando"} size={44} />
      </button>
    </div>
  );
}
