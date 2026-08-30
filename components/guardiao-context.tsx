"use client";

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type ResumoGuardiao = { texto: string; alerta: boolean };

type GuardiaoContextValue = {
  resumo: ResumoGuardiao | null;
  setResumo: (resumo: ResumoGuardiao | null) => void;
};

const GuardiaoContext = createContext<GuardiaoContextValue | null>(null);

/** Guarda o resumo inteligente da última ficha consultada, pra o Guardião
 * flutuante (`GuardiaoHelper`) mostrar em vez da dica genérica de página. */
export function GuardiaoProvider({ children }: { children: ReactNode }) {
  const [resumo, setResumo] = useState<ResumoGuardiao | null>(null);
  const value = useMemo(() => ({ resumo, setResumo }), [resumo]);
  return <GuardiaoContext.Provider value={value}>{children}</GuardiaoContext.Provider>;
}

export function useGuardiaoContext() {
  return useContext(GuardiaoContext);
}

/** Publica o resumo da ficha atual pro Guardião flutuante. Passe `null`
 * pra voltar à dica genérica da página (ex: quando não há consulta feita). */
export function useGuardiaoResumo(resumo: ResumoGuardiao | null) {
  const ctx = useContext(GuardiaoContext);
  useEffect(() => {
    ctx?.setResumo(resumo);
  }, [ctx, resumo]);

  useEffect(() => {
    return () => ctx?.setResumo(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só limpa ao desmontar a página, não a cada render
  }, []);
}
