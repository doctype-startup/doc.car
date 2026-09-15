"use client";

import { useState } from "react";

export default function CopiarLinkButton({ email }: { email: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const link = `${window.location.origin}/login?email=${encodeURIComponent(email)}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      window.prompt("Copie o link de acesso:", link);
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <button type="button" className="secondary-button" style={{ fontSize: 12 }} onClick={copiar}>
      {copiado ? "Link copiado!" : "Copiar link de acesso"}
    </button>
  );
}
