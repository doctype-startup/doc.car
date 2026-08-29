import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanoPorPriceId } from "@/lib/plans";
import { contarUsoNoPeriodo } from "@/lib/uso-avancada";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function inicioDoMesAtual() {
  const inicio = new Date();
  inicio.setDate(1);
  inicio.setHours(0, 0, 0, 0);
  return inicio.toISOString();
}

const STATUS_LABEL: Record<string, { texto: string; badge: string }> = {
  active: { texto: "Ativa", badge: "ok" },
  trialing: { texto: "Em teste", badge: "ok" },
  past_due: { texto: "Pagamento pendente", badge: "warn" },
  canceled: { texto: "Cancelada", badge: "neutral" },
  incomplete: { texto: "Incompleta", badge: "neutral" },
};

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  const admin = createAdminClient();

  const { data: despachantes } = await admin
    .from("profiles")
    .select("id, name, email, created_at")
    .order("created_at", { ascending: false });

  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select(
      "user_id, status, price_id, current_period_start, current_period_end, stripe_customer_id"
    );

  const subsPorUsuario = new Map((subscriptions ?? []).map((s) => [s.user_id, s]));

  const linhas = await Promise.all(
    (despachantes ?? []).map(async (d) => {
      const sub = subsPorUsuario.get(d.id);
      const plano = getPlanoPorPriceId(sub?.price_id);
      const inicioDoPeriodo = sub?.current_period_start || inicioDoMesAtual();
      const uso = plano ? await contarUsoNoPeriodo(admin, d.id, inicioDoPeriodo) : 0;
      return { despachante: d, sub, plano, uso };
    })
  );

  const totalAtivos = linhas.filter(
    (l) => l.sub?.status === "active" || l.sub?.status === "trialing"
  ).length;
  const mrrCentavos = linhas.reduce((soma, l) => {
    if (l.sub?.status === "active" || l.sub?.status === "trialing") {
      return soma + (l.plano?.precoCentavos ?? 0);
    }
    return soma;
  }, 0);

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-left">
          <div className="brand">
            DOC<span>.CAR</span> <span className="admin-tag">Admin</span>
          </div>
        </div>
        <nav className="topbar-nav">
          <Link href="/dashboard">Voltar ao app</Link>
        </nav>
      </header>
      <div className="orange-line" />
      <main className="app-content">
        <h2 style={{ marginBottom: 4 }}>Painel administrativo</h2>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
          Visão geral de despachantes, assinaturas e uso. Gerenciar cobranças, cancelar
          assinaturas e ver detalhes de pagamento continua no{" "}
          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
            painel do Stripe
          </a>
          ; gerenciar contas de usuário continua no{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
            painel do Supabase
          </a>
          .
        </p>

        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Despachantes cadastrados</span>
            <span className="value" style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>
              {despachantes?.length ?? 0}
            </span>
          </div>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Assinaturas ativas</span>
            <span className="value" style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>
              {totalAtivos}
            </span>
          </div>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Receita mensal recorrente</span>
            <span className="value" style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>
              {currency.format(mrrCentavos / 100)}
            </span>
          </div>
        </div>

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Despachante</th>
                <th>Cadastrado em</th>
                <th>Plano</th>
                <th>Status</th>
                <th>Uso no período</th>
                <th>Cliente Stripe</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ despachante, sub, plano, uso }) => {
                const status = sub?.status ? STATUS_LABEL[sub.status] : undefined;
                return (
                  <tr key={despachante.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{despachante.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {despachante.email}
                      </div>
                    </td>
                    <td>{dataHora.format(new Date(despachante.created_at))}</td>
                    <td>{plano?.nome ?? "—"}</td>
                    <td>
                      {status ? (
                        <span className={`badge ${status.badge}`}>{status.texto}</span>
                      ) : (
                        <span className="badge neutral">Sem assinatura</span>
                      )}
                    </td>
                    <td>{plano ? `${uso}/${plano.cota}` : "—"}</td>
                    <td>
                      {sub?.stripe_customer_id ? (
                        <a
                          href={`https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Ver no Stripe
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(despachantes?.length ?? 0) === 0 && (
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>
              Nenhum despachante cadastrado ainda.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
