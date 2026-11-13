"use client";

import { useEffect, useRef, useState } from "react";
import { PLANOS } from "@/lib/plans";
import ConfirmSubmitButton from "./confirm-submit-button";
import WhatsappAcessoButton from "./whatsapp-acesso-button";
import CopiarLinkButton from "./copiar-link-button";
import {
  revogarAcesso,
  revogarEExcluirDados,
  concederAcessoManual,
  concederCreditoManualAdmin,
} from "./actions";

/** Menu suspenso com todas as ações de um despachante — mesmo padrão do
 * menu "Consultas Avulsas" do dashboard (botão + painel flutuante que
 * fecha ao clicar fora ou apertar Esc). Antes essas ~7 ações ficavam
 * sempre visíveis empilhadas na coluna "Ações", o que fazia a tabela
 * inteira crescer e, em algum momento, até sobrepor colunas vizinhas.
 * Escondidas atrás de um botão só, a tabela fica compacta por padrão e
 * as ações aparecem só quando alguém realmente precisa delas. */
export default function AcoesDespachanteMenu({
  despachante,
  temAcesso,
  ehManual,
  ehTeste,
}: {
  despachante: { id: string; name: string; email: string };
  temAcesso: boolean;
  ehManual: boolean;
  ehTeste: boolean;
}) {
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
    <div className="admin-acoes" ref={menuRef}>
      <button
        type="button"
        className={`admin-acoes-trigger${aberto ? " active" : ""}`}
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="true"
      >
        Ações
        <span className="admin-acoes-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {aberto && (
        <div className="admin-acoes-panel" role="menu">
          <WhatsappAcessoButton nome={despachante.name} email={despachante.email} />
          <CopiarLinkButton email={despachante.email} />

          <form action={concederCreditoManualAdmin.bind(null, despachante.id)} className="admin-actions-group">
            <select name="tipo" defaultValue="simples" className="admin-select" style={{ fontSize: 12 }}>
              <option value="simples">Consulta simples</option>
              <option value="avancada">Consulta avançada</option>
              <option value="avulsas">Saldo avulsas (R$)</option>
            </select>
            <div className="admin-actions-group-row">
              <input
                type="number"
                name="quantidade"
                placeholder="Qtd."
                min={0.01}
                step="any"
                required
                className="admin-input"
                style={{ fontSize: 12 }}
              />
              <label className="admin-checkbox-label" style={{ whiteSpace: "nowrap" }}>
                <input type="checkbox" name="bonus" />
                Bônus
              </label>
            </div>
            <button type="submit" className="secondary-button" style={{ fontSize: 12, width: "100%" }}>
              Conceder crédito
            </button>
          </form>

          {(!temAcesso || ehManual) && (
            <form action={concederAcessoManual.bind(null, despachante.id)} className="admin-actions-group">
              <select name="plano" defaultValue={PLANOS[0].id} className="admin-select" style={{ fontSize: 12 }}>
                {PLANOS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
              <button type="submit" className="secondary-button" style={{ fontSize: 12, width: "100%" }}>
                {!temAcesso ? "Conceder acesso fixo" : ehTeste ? "Tornar acesso fixo" : "Trocar plano"}
              </button>
            </form>
          )}

          {temAcesso && (
            <form action={revogarAcesso.bind(null, despachante.id)}>
              <button type="submit" className="secondary-button" style={{ fontSize: 12, width: "100%" }}>
                Revogar acesso
              </button>
            </form>
          )}

          <form action={revogarEExcluirDados.bind(null, despachante.id)}>
            <ConfirmSubmitButton
              className="danger-button"
              confirmText={
                temAcesso
                  ? `Excluir permanentemente a conta e todos os dados de ${despachante.name} (${despachante.email})? Isso cancela a assinatura, apaga perfil, histórico de consultas e uso — não tem como desfazer.`
                  : `Excluir permanentemente a conta e todos os dados de ${despachante.name} (${despachante.email})? Apaga perfil, histórico de consultas e uso — não tem como desfazer.`
              }
            >
              {temAcesso ? "Revogar e excluir dados" : "Excluir dados"}
            </ConfirmSubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
