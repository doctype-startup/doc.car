"use client";

import { useRef, useTransition } from "react";
import { definirOcultarPrecosLogin } from "../../actions";

export default function OcultarPrecosCheckbox({
  userId,
  ocultoInicial,
}: {
  userId: string;
  ocultoInicial: boolean;
}) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      action={definirOcultarPrecosLogin.bind(null, userId)}
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <label className="admin-checkbox-label">
        <input
          type="checkbox"
          name="ocultar"
          defaultChecked={ocultoInicial}
          disabled={isPending}
          onChange={() => startTransition(() => formRef.current?.requestSubmit())}
        />
        Ocultar preços no link de acesso ({"/login?email=..."})
      </label>
    </form>
  );
}
