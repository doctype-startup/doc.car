import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanoPorPriceId, PLANOS, PLANO_TESTE } from "@/lib/plans";
import { contarUsoNoPeriodo } from "@/lib/uso-avancada";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import {
  revogarAcesso,
  revogarEExcluirDados,
  concederAcessoManual,
  criarTeste,
  concederCreditoManualAdmin,
} from "./actions";
import ConfirmSubmitButton from "./confirm-submit-button";
import WhatsappAcessoButton from "./whatsapp-acesso-button";
import CopiarLinkButton from "./copiar-link-button";
import PasswordField from "@/components/PasswordField";

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

function ConcederCreditoForm({ userId }: { userId: string }) {
  return (
    <form
      action={concederCreditoManualAdmin.bind(null, userId)}
      style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}
    >
      <select name="tipo" defaultValue="simples" className="admin-select" style={{ fontSize: 12 }}>
        <option value="simples">Consulta simples</option>
        <option value="avancada">Consulta avançada</option>
        <option value="avulsas">Saldo avulsas (R$)</option>
      </select>
      <input
        type="number"
        name="quantidade"
        placeholder="Qtd."
        min={0.01}
        step="any"
        required
        className="admin-input"
        style={{ fontSize: 12, width: 70 }}
      />
      <label className="admin-checkbox-label">
        <input type="checkbox" name="bonus" />
        Bônus
      </label>
      <button type="submit" className="secondary-button" style={{ fontSize: 12 }}>
        Conceder crédito
      </button>
    </form>
  );
}

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

  // last_seen_at é opcional (coluna nova, migration 0017) — se a migration
  // ainda não rodou nesse ambiente, um select pedindo uma coluna
  // inexistente falha por inteiro (despachantes viraria null e a tabela
  // inteira sumiria, não só a coluna de acesso). Tenta com ela primeiro;
  // se falhar, cai pra sem ela, pra nunca perder a lista de despachantes
  // por causa de uma coluna nova que ainda não foi migrada.
  let despachantes: { id: string; name: string; email: string; created_at: string; last_seen_at: string | null }[] | null = null;
  {
    const { data, error } = await admin
      .from("profiles")
      .select("id, name, email, created_at, last_seen_at")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(`[admin] falha ao buscar despachantes com last_seen_at: ${error.message}`);
      const fallback = await admin
        .from("profiles")
        .select("id, name, email, created_at")
        .order("created_at", { ascending: false });
      despachantes = (fallback.data ?? []).map((d) => ({ ...d, last_seen_at: null }));
    } else {
      despachantes = data;
    }
  }

  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select(
      "user_id, status, price_id, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id"
    );

  const subsPorUsuario = new Map((subscriptions ?? []).map((s) => [s.user_id, s]));

  // Quantidades e saldos — uma busca por tabela pra todo mundo, agregada em
  // memória, em vez de uma consulta por despachante.
  const agora = new Date();
  const [
    { data: usoSimples },
    { data: usoAvancada },
    { data: usoAvulsas },
    { data: recargasSimplesAtivas },
    { data: recargasAvancadaAtivas },
    { data: saldosAvulsas },
  ] = await Promise.all([
    admin.from("simples_usage").select("user_id"),
    admin.from("avancada_usage").select("user_id"),
    admin.from("consultas_avulsas_uso").select("user_id"),
    admin
      .from("recargas_simples")
      .select("user_id, creditos_restantes")
      .gt("creditos_restantes", 0)
      .gt("expira_em", agora.toISOString()),
    admin
      .from("recargas_avancada")
      .select("user_id, creditos_restantes")
      .gt("creditos_restantes", 0)
      .gt("expira_em", agora.toISOString()),
    admin.from("saldo_avulsas").select("user_id, saldo_centavos"),
  ]);

  function contarPorUsuario(linhas: { user_id: string }[] | null) {
    const mapa = new Map<string, number>();
    for (const l of linhas ?? []) {
      mapa.set(l.user_id, (mapa.get(l.user_id) ?? 0) + 1);
    }
    return mapa;
  }

  function somarPorUsuario(linhas: { user_id: string; [campo: string]: unknown }[] | null, campo: string) {
    const mapa = new Map<string, number>();
    for (const l of linhas ?? []) {
      mapa.set(l.user_id, (mapa.get(l.user_id) ?? 0) + Number(l[campo] ?? 0));
    }
    return mapa;
  }

  const qtdSimplesPorUsuario = contarPorUsuario(usoSimples);
  const qtdAvancadaPorUsuario = contarPorUsuario(usoAvancada);
  const qtdAvulsasPorUsuario = contarPorUsuario(usoAvulsas);
  const saldoSimplesPorUsuario = somarPorUsuario(recargasSimplesAtivas, "creditos_restantes");
  const saldoAvancadaPorUsuario = somarPorUsuario(recargasAvancadaAtivas, "creditos_restantes");
  const saldoAvulsasPorUsuario = new Map(
    (saldosAvulsas ?? []).map((s) => [s.user_id, s.saldo_centavos as number])
  );

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
      const gastoTotal = faturas
        .filter((f) => f.status === "paid")
        .reduce((soma, f) => soma + f.valor, 0);
      const ultimoAcesso = d.last_seen_at ? new Date(d.last_seen_at) : null;
      const online = ultimoAcesso ? agora.getTime() - ultimoAcesso.getTime() < 5 * 60 * 1000 : false;
      return {
        despachante: d,
        sub,
        plano,
        uso,
        faturas,
        gastoTotal,
        ultimoAcesso,
        online,
        quantidades: {
          simples: qtdSimplesPorUsuario.get(d.id) ?? 0,
          avancada: qtdAvancadaPorUsuario.get(d.id) ?? 0,
          avulsas: qtdAvulsasPorUsuario.get(d.id) ?? 0,
        },
        saldos: {
          simples: saldoSimplesPorUsuario.get(d.id) ?? 0,
          avancada: saldoAvancadaPorUsuario.get(d.id) ?? 0,
          avulsasCentavos: saldoAvulsasPorUsuario.get(d.id) ?? 0,
        },
      };
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
          <Link href="/admin/cadastro-autorizacoes">Cadastro e Autorizações</Link>
          <Link href="/admin/precos">Preços das APIs</Link>
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

        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <h3 style={{ marginBottom: 4, fontSize: 15 }}>Criar acesso de teste</h3>
          <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
            Cria um teste temporário pra qualquer e-mail, novo ou já cadastrado — sem cobrança,
            com {PLANO_TESTE.cotaSimples} consultas básicas e {PLANO_TESTE.cota} consultas
            completas, pelo número de dias que você definir. O teste expira sozinho no prazo, mas
            você pode revogar a qualquer momento na tabela abaixo.
          </p>
          <form
            action={criarTeste}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
          >
            <input
              type="email"
              name="email"
              placeholder="email@exemplo.com"
              required
              className="admin-input"
              style={{ fontSize: 13, flex: "1 1 220px" }}
            />
            <PasswordField
              name="senha"
              placeholder="Senha provisória (opcional)"
              minLength={6}
              className="admin-input"
              style={{ fontSize: 13 }}
              wrapperStyle={{ flex: "1 1 180px" }}
            />
            <input
              type="number"
              name="dias"
              placeholder="Dias"
              min={1}
              defaultValue={7}
              required
              className="admin-input"
              style={{ fontSize: 13, width: 90 }}
            />
            <button type="submit" className="secondary-button" style={{ fontSize: 12 }}>
              Criar teste
            </button>
          </form>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
            Preenchendo a senha, o despachante já consegue entrar com ela na hora — combine por
            fora (telefone, WhatsApp), ela não é enviada por e-mail. Deixando em branco, quem
            ainda não tem conta recebe um convite do Supabase pra criar a própria senha.
          </p>
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
                <th>Consultas</th>
                <th>Saldos disponíveis</th>
                <th>Gastos</th>
                <th>Acesso</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(
                ({ despachante, sub, plano, uso, faturas, gastoTotal, ultimoAcesso, online, quantidades, saldos }) => {
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
                        <>
                          <span className="badge neutral">Acesso manual (teste)</span>
                          {sub?.current_period_end && (
                            <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
                              até {dataCurta.format(new Date(sub.current_period_end))}
                            </div>
                          )}
                        </>
                      ) : status ? (
                        <span className={`badge ${status.badge}`}>{status.texto}</span>
                      ) : (
                        <span className="badge neutral">Sem assinatura</span>
                      )}
                    </td>
                    <td>{plano ? `${uso}/${plano.cota}` : "—"}</td>
                    <td>
                      <div className="admin-stat-list">
                        <div className="admin-stat-row">
                          <span className="admin-stat-label">Simples:</span>
                          <span className="admin-stat-value">{quantidades.simples}</span>
                        </div>
                        <div className="admin-stat-row">
                          <span className="admin-stat-label">Avançada:</span>
                          <span className="admin-stat-value">{quantidades.avancada}</span>
                        </div>
                        <div className="admin-stat-row">
                          <span className="admin-stat-label">Avulsas:</span>
                          <span className="admin-stat-value">{quantidades.avulsas}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-stat-list">
                        <div className="admin-stat-row">
                          <span className="admin-stat-label">Simples:</span>
                          <span className="admin-stat-value">{saldos.simples} créditos</span>
                        </div>
                        <div className="admin-stat-row">
                          <span className="admin-stat-label">Avançada:</span>
                          <span className="admin-stat-value">{saldos.avancada} créditos</span>
                        </div>
                        <div className="admin-stat-row">
                          <span className="admin-stat-label">Avulsas:</span>
                          <span className="admin-stat-value">
                            {currency.format(saldos.avulsasCentavos / 100)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{currency.format(gastoTotal)}</td>
                    <td>
                      <span className={`badge ${online ? "ok" : "neutral"}`}>
                        {online ? "Online" : "Offline"}
                      </span>
                      <div className="admin-acesso-ultimo">
                        {ultimoAcesso ? dataHora.format(ultimoAcesso) : "Nunca acessou"}
                      </div>
                    </td>
                    <td>
                      {temAcesso ? (
                        <div className="admin-actions">
                          <WhatsappAcessoButton nome={despachante.name} email={despachante.email} />
                          <CopiarLinkButton email={despachante.email} />
                          <ConcederCreditoForm userId={despachante.id} />
                          <form action={revogarAcesso.bind(null, despachante.id)}>
                            <button type="submit" className="secondary-button" style={{ fontSize: 12 }}>
                              Revogar acesso
                            </button>
                          </form>
                          <form action={revogarEExcluirDados.bind(null, despachante.id)}>
                            <ConfirmSubmitButton
                              className="danger-button"
                              confirmText={`Excluir permanentemente a conta e todos os dados de ${despachante.name} (${despachante.email})? Isso cancela a assinatura, apaga perfil, histórico de consultas e uso — não tem como desfazer.`}
                            >
                              Revogar e excluir dados
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      ) : (
                        <div className="admin-actions">
                          <WhatsappAcessoButton nome={despachante.name} email={despachante.email} />
                          <CopiarLinkButton email={despachante.email} />
                          <ConcederCreditoForm userId={despachante.id} />
                          <form action={concederAcessoManual.bind(null, despachante.id)}>
                            <select name="plano" defaultValue={PLANOS[0].id} className="admin-select" style={{ fontSize: 12 }}>
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
                          <form action={revogarEExcluirDados.bind(null, despachante.id)}>
                            <ConfirmSubmitButton
                              className="danger-button"
                              confirmText={`Excluir permanentemente a conta e todos os dados de ${despachante.name} (${despachante.email})? Apaga perfil, histórico de consultas e uso — não tem como desfazer.`}
                            >
                              Excluir dados
                            </ConfirmSubmitButton>
                          </form>
                        </div>
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
