"use client";

import { useRef, useTransition } from "react";
import { definirCobrarConsultaSimples } from "../../actions";

export default function CobrarConsultaSimplesCheckbox({
  userId,
  ativoInicial,
}: {
  userId: string;
  ativoInicial: boolean;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={definirCobrarConsultaSimples.bind(null, userId)}
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <label className="admin-checkbox-label">
        <input
          type="checkbox"
          name="ativar"
          defaultChecked={ativoInicial}
          disabled={isPending}
          onChange={() => startTransition(() => formRef.current?.requestSubmit())}
        />
        Cobrar a consulta simples (mesmo dentro da cota do plano)
      </label>
    </form>
  );
}
