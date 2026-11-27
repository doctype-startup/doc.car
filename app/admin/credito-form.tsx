"use client";

import { useState } from "react";
import { concederCreditoManualAdmin } from "./actions";

/** Form de conceder/retirar crédito — direção escolhida no próprio
 * formulário, pra corrigir uma concessão feita errada ou qualquer ajuste
 * manual pra menos, sem precisar de uma ação separada. Usado tanto no menu
 * "Ações" da listagem principal quanto na página "Ver conta" de cada
 * despachante. */
export default function CreditoForm({ userId }: { userId: string }) {
  const [direcao, setDirecao] = useState<"conceder" | "retirar">("conceder");

  return (
    <form action={concederCreditoManualAdmin.bind(null, userId)} className="admin-actions-group">
      <div className="admin-actions-group-row">
        <select
          name="direcao"
          value={direcao}
          onChange={(event) => setDirecao(event.target.value as "conceder" | "retirar")}
          className="admin-select"
          style={{ fontSize: 12 }}
        >
          <option value="conceder">Conceder</option>
          <option value="retirar">Retirar</option>
        </select>
        <select name="tipo" defaultValue="simples" className="admin-select" style={{ fontSize: 12 }}>
          <option value="simples">Consulta simples</option>
          <option value="avancada">Consulta avançada</option>
          <option value="avulsas">Saldo avulsas (R$)</option>
        </select>
      </div>
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
        {direcao === "conceder" && (
          <label className="admin-checkbox-label" style={{ whiteSpace: "nowrap" }}>
            <input type="checkbox" name="bonus" />
            Bônus
          </label>
        )}
      </div>
      <button
        type="submit"
        className={direcao === "retirar" ? "danger-button" : "secondary-button"}
        style={{ fontSize: 12, width: "100%" }}
      >
        {direcao === "retirar" ? "Retirar crédito" : "Conceder crédito"}
      </button>
    </form>
  );
}
