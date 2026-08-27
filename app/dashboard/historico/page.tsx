"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getHistory, HistoryItem } from "@/lib/history";

export default function HistoricoPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs from localStorage after mount to avoid a hydration mismatch
    setItems(getHistory());
  }, []);

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Histórico de consultas</h1>
          <p>Últimas placas consultadas neste navegador.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">Você ainda não realizou nenhuma consulta.</div>
      ) : (
        <div className="card">
          {items.map((item) => (
            <div
              key={item.placa}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <Link
                href={{ pathname: "/dashboard", query: { placa: item.placa } }}
                style={{ fontWeight: 700 }}
              >
                {item.placa}
              </Link>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                {item.consultadoEm}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
