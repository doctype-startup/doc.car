import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HistoricoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = user
    ? await supabase
        .from("search_history")
        .select("placa, consultado_em")
        .eq("user_id", user.id)
        .order("consultado_em", { ascending: false })
        .limit(20)
    : { data: [] };

  const items = (data || []).map((row) => ({
    placa: row.placa,
    consultadoEm: new Date(row.consultado_em).toLocaleString("pt-BR"),
  }));

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Histórico de consultas</h1>
          <p>Últimas placas consultadas por você.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">Você ainda não realizou nenhuma consulta.</div>
      ) : (
        <div className="card">
          {items.map((item, index) => (
            <div
              key={`${item.placa}-${index}`}
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
