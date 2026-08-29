import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanoPorPriceId, PLANOS } from "@/lib/plans";
import { contarUsoNoPeriodo } from "@/lib/uso-avancada";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import { revogarAcesso, concederAcessoManual } from "./actions";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

function inicioDoMesAtual() {
  const inicio = new Date();
  inicio.setDate(1);
  inicio.setHours(0, 0, 0, 0);
  return inicio;
}

const STATUS_LABEL: Record<string, { texto: string; badge: string }> = {
  active: { texto: "Ativa", badge: "ok" },
  trialing: { texto: "Em teste", badge: "ok" },
  past_due: { texto: "Pagamento pendente", badge: "warn" },
  canceled: { texto: "Cancelada", badge: "neutral" },
  incomplete: { texto: "Incompleta", badge: "neutral" },
};

const FATURA_STATUS_LABEL: Record<string, { texto: string; badge: string }> = {
  paid: { texto: "Paga", badge: "ok" },
  open: { texto: "Em aberto", badge: "warn" },
  uncollectible: { texto: "Não cobrada", badge: "warn" },
  void: { texto: "Anulada", badge: "neutral" },
  draft: { texto: "Rascunho", badge: "neutral" },
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
      "user_id, status, price_id, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id"
    );

  const subsPorUsuario = new Map((subscriptions ?? []).map((s) => [s.user_id, s]));

  // Faturas — busca uma vez pra conta inteira do Stripe e agrupa por
  // cliente, em vez de uma chamada por despachante.
  const faturasPorCliente = new Map<
    string,
    { id: string; valor: number; status: string; criadaEm: Date; url: string | null }[]
  >();
  let recebidoNoMesCentavos = 0;
  const inicioDoMes = inicioDoMesAtual();

  if (isStripeConfigured) {
    try {
      const resultado = await getStripe().invoices.list({ limit: 100 });
      for (const fatura of resultado.data) {
        const clienteId =
          typeof fatura.customer === "string" ? fatura.customer : fatura.customer?.id;
        if (!clienteId) continue;

        const criadaEm = new Date(fatura.created * 1000);
        const lista = faturasPorCliente.get(clienteId) ?? [];
        lista.push({
          id: fatura.id ?? "",
          valor: (fatura.amount_paid || fatura.amount_due) / 100,
          status: fatura.status ?? "draft",
          criadaEm,
          url: fatura.hosted_invoice_url ?? null,
        });
        faturasPorCliente.set(clienteId, lista);

        if (fatura.status === "paid" && criadaEm >= inicioDoMes) {
          recebidoNoMesCentavos += fatura.amount_paid;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "erro desconhecido";
      console.error(`[admin] falha ao buscar faturas no Stripe: ${message}`);
    }
  }

  const linhas = await Promise.all(
    (despachantes ?? []).map(async (d) => {
      const sub = subsPorUsuario.get(d.id);
      const plano = getPlanoPorPriceId(sub?.price_id);
      const inicioDoPeriodo = sub?.current_period_start || inicioDoMes.toISOString();
      const uso = plano ? await contarUsoNoPeriodo(admin, d.id, inicioDoPeriodo) : 0;
      const faturas = sub?.stripe_customer_id
        ? (faturasPorCliente.get(sub.stripe_customer_id) ?? [])
        : [];
      return { despachante: d, sub, plano, uso, faturas };
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
          Detalhes de pagamento além do que está aqui (reembolsos, notas fiscais, métodos de
          cobrança) continuam no{" "}
          <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer">
            painel do Stripe
          </a>
          ; gerenciar contas de usuário (resetar senha, apagar conta) continua no{" "}
          <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">
            painel do Supabase
          </a>
          .
        </p>

        <div className="grid-3" style={{ marginBottom: 12 }}>
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
        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Recebido este mês (faturas pagas)</span>
            <span className="value" style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>
              {currency.format(recebidoNoMesCentavos / 100)}
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
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ despachante, sub, plano, uso, faturas }) => {
                const temAcesso = sub?.status === "active" || sub?.status === "trialing";
                const ehManual = temAcesso && !sub?.stripe_subscription_id;
                const status = sub?.status ? STATUS_LABEL[sub.status] : undefined;

                return (
                  <tr key={despachante.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{despachante.name}</div>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {despachante.email}
                      </div>
                      {sub?.stripe_customer_id && (
                        <a
                          href={`https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 11 }}
                        >
                          Ver no Stripe
                        </a>
                      )}
                      {faturas.length > 0 && (
                        <details style={{ marginTop: 6 }}>
                          <summary style={{ fontSize: 11, cursor: "pointer", color: "var(--muted)" }}>
                            {faturas.length} fatura{faturas.length > 1 ? "s" : ""}
                          </summary>
                          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                            {faturas.map((f) => {
                              const fStatus = FATURA_STATUS_LABEL[f.status] ?? {
                                texto: f.status,
                                badge: "neutral",
                              };
                              return (
                                <div key={f.id} style={{ fontSize: 12 }}>
                                  {dataCurta.format(f.criadaEm)} · {currency.format(f.valor)} ·{" "}
                                  <span className={`badge ${fStatus.badge}`}>{fStatus.texto}</span>
                                  {f.url && (
                                    <>
                                      {" "}
                                      ·{" "}
                                      <a href={f.url} target="_blank" rel="noopener noreferrer">
                                        ver
                                      </a>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </td>
                    <td>{dataHora.format(new Date(despachante.created_at))}</td>
                    <td>{plano?.nome ?? "—"}</td>
                    <td>
                      {ehManual ? (
                        <span className="badge neutral">Acesso manual (teste)</span>
                      ) : status ? (
                        <span className={`badge ${status.badge}`}>{status.texto}</span>
                      ) : (
                        <span className="badge neutral">Sem assinatura</span>
                      )}
                    </td>
                    <td>{plano ? `${uso}/${plano.cota}` : "—"}</td>
                    <td>
                      {temAcesso ? (
                        <form action={revogarAcesso.bind(null, despachante.id)}>
                          <button type="submit" className="secondary-button" style={{ fontSize: 12 }}>
                            Revogar acesso
                          </button>
                        </form>
                      ) : (
                        <form
                          action={concederAcessoManual.bind(null, despachante.id)}
                          style={{ display: "flex", gap: 6, alignItems: "center" }}
                        >
                          <select name="plano" defaultValue={PLANOS[0].id} style={{ fontSize: 12 }}>
                            {PLANOS.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nome}
                              </option>
                            ))}
                          </select>
                          <button type="submit" className="secondary-button" style={{ fontSize: 12 }}>
                            Conceder teste
                          </button>
                        </form>
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
