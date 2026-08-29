"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clearHistory } from "@/lib/history";

export default function ClearHistoryButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!confirm("Apagar todo o histórico de consultas? Essa ação não pode ser desfeita.")) {
      return;
    }
    setLoading(true);
    await clearHistory();
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      className="secondary-button"
      onClick={handleClick}
      disabled={loading}
    >
      {loading ? "Apagando..." : "Limpar histórico"}
    </button>
  );
}
