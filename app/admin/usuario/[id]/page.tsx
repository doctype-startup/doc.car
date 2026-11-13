import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanoPorPriceId } from "@/lib/plans";
import { getSaldoAvulsas } from "@/lib/saldo-avulsas";
import { listarVeiculos } from "@/lib/meus-veiculos";
import { getConsultaAvulsaPorId } from "@/lib/consultas-avulsas";
import OcultarPrecosCheckbox from "./ocultar-precos-checkbox";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const STATUS_LABEL: Record<string, { texto: string; badge: string }> = {
  active: { texto: "Ativa", badge: "ok" },
  trialing: { texto: "Em teste", badge: "ok" },
  past_due: { texto: "Pagamento pendente", badge: "warn" },
  canceled: { texto: "Cancelada", badge: "neutral" },
  incomplete: { texto: "Incompleta", badge: "neutral" },
};

/** Visão só-leitura da conta de um despachante, pra suporte/manutenção —
 * ver exatamente o que ele vê (saldo, histórico, veículos) sem precisar
 * pedir print ou acesso à senha dele. Nenhuma ação daqui muda dado nenhum;
 * ações (revogar acesso, conceder crédito etc.) continuam só na listagem
 * principal do admin. */
export default async function AdminUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profileAdmin } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profileAdmin?.is_admin) redirect("/dashboard");

  const admin = createAdminClient();

  // ocultar_precos_login é coluna nova (migration 0018) — se ainda não
  // rodou nesse ambiente, pedir ela junto faz o select inteiro falhar (o
  // despachante viraria "não encontrado", não só o checkbox sumir). Tenta
  // com ela primeiro; se falhar, cai pra sem ela.
  let despachante: {
    id: string;
    name: string;
    email: string;
    created_at: string;
    last_seen_at: string | null;
    ocultar_precos_login: boolean;
  } | null = null;
  {
    const { data, error } = await admin
      .from("profiles")
      .select("id, name, email, created_at, last_seen_at, ocultar_precos_login")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error(`[admin/usuario] falha ao buscar com ocultar_precos_login: ${error.message}`);
      const fallback = await admin
        .from("profiles")
        .select("id, name, email, created_at, last_seen_at")
        .eq("id", id)
        .maybeSingle();
      despachante = fallback.data ? { ...fallback.data, ocultar_precos_login: false } : null;
    } else {
      despachante = data;
    }
  }

  if (!despachante) notFound();

  const [
    { data: sub },
    saldoAvulsasCentavos,
    veiculos,
    { data: historico },
    { data: avulsasRecentes },
  ] = await Promise.all([
    admin
      .from("subscriptions")
      .select(
        "status, price_id, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id"
      )
      .eq("user_id", id)
      .maybeSingle(),
    getSaldoAvulsas(admin, id),
    listarVeiculos(admin, id).catch(() => []),
    admin
      .from("search_history")
      .select("placa, consultado_em")
      .eq("user_id", id)
      .order("consultado_em", { ascending: false })
      .limit(20),
    admin
      .from("consultas_avulsas_uso")
      .select("servico_id, parametro, preco_centavos, consultado_em")
      .eq("user_id", id)
      .order("consultado_em", { ascending: false })
      .limit(20),
  ]);

  const plano = getPlanoPorPriceId(sub?.price_id);
  const status = sub?.status ? STATUS_LABEL[sub.status] : undefined;
  const temAcesso = sub?.status === "active" || sub?.status === "trialing";
  const ehManual = temAcesso && !sub?.stripe_subscription_id;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-left">
          <div className="brand">
            DOC<span>.CAR</span> <span className="admin-tag">Admin</span>
          </div>
        </div>
        <nav className="topbar-nav">
          <Link href="/admin">Voltar ao painel</Link>
        </nav>
      </header>
      <div className="orange-line" />
      <main className="app-content">
        <h2 style={{ marginBottom: 4 }}>{despachante.name}</h2>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
          {despachante.email} · Visão de suporte/manutenção. Ações de conta (revogar acesso,
          conceder crédito, excluir dados) continuam na{" "}
          <Link href="/admin">listagem principal</Link>.
        </p>

        <div className="card" style={{ padding: 12, marginBottom: 20, maxWidth: 420 }}>
          <OcultarPrecosCheckbox
            userId={despachante.id}
            ocultoInicial={Boolean(despachante.ocultar_precos_login)}
          />
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
            Pra despachante que paga direto com a DOCTYPE (valor negociado) — esconde a tabela de
            preços dos planos quando ele abre o link de acesso personalizado copiado na listagem
            principal.
          </p>
        </div>

        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Cadastrado em</span>
            <span className="value" style={{ marginTop: 4 }}>
              {dataHora.format(new Date(despachante.created_at))}
            </span>
          </div>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Último acesso</span>
            <span className="value" style={{ marginTop: 4 }}>
              {despachante.last_seen_at ? dataHora.format(new Date(despachante.last_seen_at)) : "Nunca acessou"}
            </span>
          </div>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Plano</span>
            <span className="value" style={{ marginTop: 4 }}>
              {plano?.nome ?? "—"}{" "}
              {ehManual ? (
                <span className="badge neutral">Acesso manual (teste)</span>
              ) : status ? (
                <span className={`badge ${status.badge}`}>{status.texto}</span>
              ) : (
                <span className="badge neutral">Sem assinatura</span>
              )}
            </span>
          </div>
        </div>

        <div className="grid-3" style={{ marginBottom: 24 }}>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Saldo avulsas</span>
            <span className="value" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              {currency.format(saldoAvulsasCentavos / 100)}
            </span>
          </div>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Veículos cadastrados</span>
            <span className="value" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              {veiculos.length}
            </span>
          </div>
          {sub?.stripe_customer_id && (
            <div className="card kv" style={{ margin: 0 }}>
              <span className="label">Stripe</span>
              <a
                href={`https://dashboard.stripe.com/customers/${sub.stripe_customer_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 4 }}
              >
                Ver cliente no Stripe
              </a>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Veículos cadastrados</h3>
          {veiculos.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhum veículo cadastrado.</p>
          ) : (
            <div className="admin-table-wrap" style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Marca/Modelo</th>
                    <th>Situação</th>
                    <th>Atualizado em</th>
                  </tr>
                </thead>
                <tbody>
                  {veiculos.map((v) => (
                    <tr key={v.placa}>
                      <td style={{ fontWeight: 600 }}>{v.placa}</td>
                      <td>{v.marcaModelo || "—"}</td>
                      <td>{v.situacao || "—"}</td>
                      <td>{v.atualizadoEm ? dataHora.format(new Date(v.atualizadoEm)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Histórico de consultas (últimas 20)</h3>
          {!historico || historico.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma consulta ainda.</p>
          ) : (
            <div className="admin-table-wrap" style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Placa</th>
                    <th>Consultado em</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((h, index) => (
                    <tr key={`${h.placa}-${index}`}>
                      <td style={{ fontWeight: 600 }}>{h.placa}</td>
                      <td>{dataHora.format(new Date(h.consultado_em))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Consultas avulsas (últimas 20)</h3>
          {!avulsasRecentes || avulsasRecentes.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma consulta avulsa ainda.</p>
          ) : (
            <div className="admin-table-wrap" style={{ overflowX: "auto" }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Serviço</th>
                    <th>Placa</th>
                    <th>Preço</th>
                    <th>Consultado em</th>
                  </tr>
                </thead>
                <tbody>
                  {avulsasRecentes.map((a, index) => (
                    <tr key={index}>
                      <td>{getConsultaAvulsaPorId(a.servico_id)?.nome ?? a.servico_id}</td>
                      <td style={{ fontWeight: 600 }}>{a.parametro}</td>
                      <td>{currency.format(a.preco_centavos / 100)}</td>
                      <td>{dataHora.format(new Date(a.consultado_em))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
