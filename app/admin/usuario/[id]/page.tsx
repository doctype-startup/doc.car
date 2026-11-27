import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getPlanoPorPriceId,
  PLANO_TESTE,
  PRECO_CONSULTA_SIMPLES_SEMPRE_CENTAVOS,
  PRECO_AVULSO_CENTAVOS,
} from "@/lib/plans";
import { getSaldoAvulsas } from "@/lib/saldo-avulsas";
import { listarVeiculos } from "@/lib/meus-veiculos";
import { getConsultaAvulsaPorId } from "@/lib/consultas-avulsas";
import { getStripe, isStripeConfigured } from "@/lib/stripe";
import OcultarPrecosCheckbox from "./ocultar-precos-checkbox";
import CobrarConsultaSimplesCheckbox from "./cobrar-consulta-simples-checkbox";
import CreditoForm from "../../credito-form";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
// Server component — sem timeZone, o runtime (UTC na Vercel) formataria
// hora errada pra quem está no Brasil.
const dataHora = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const FATURA_STATUS_LABEL: Record<string, { texto: string; badge: string }> = {
  paid: { texto: "Paga", badge: "ok" },
  open: { texto: "Em aberto", badge: "warn" },
  uncollectible: { texto: "Não cobrada", badge: "warn" },
  void: { texto: "Anulada", badge: "neutral" },
  draft: { texto: "Rascunho", badge: "neutral" },
};

async function buscarFaturas(stripeCustomerId: string | null) {
  if (!stripeCustomerId || !isStripeConfigured) return [];

  try {
    const resultado = await getStripe().invoices.list({ customer: stripeCustomerId, limit: 20 });
    return resultado.data.map((fatura) => ({
      id: fatura.id ?? "",
      valor: (fatura.amount_paid || fatura.amount_due) / 100,
      status: fatura.status ?? "draft",
      criadaEm: new Date(fatura.created * 1000),
      url: fatura.hosted_invoice_url ?? null,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[admin/usuario] falha ao buscar faturas no Stripe: ${message}`);
    return [];
  }
}

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
    cobrar_consulta_simples: boolean;
  } | null = null;
  {
    const { data, error } = await admin
      .from("profiles")
      .select(
        "id, name, email, created_at, last_seen_at, ocultar_precos_login, cobrar_consulta_simples"
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error(`[admin/usuario] falha ao buscar com colunas novas: ${error.message}`);
      const fallback = await admin
        .from("profiles")
        .select("id, name, email, created_at, last_seen_at")
        .eq("id", id)
        .maybeSingle();
      despachante = fallback.data
        ? { ...fallback.data, ocultar_precos_login: false, cobrar_consulta_simples: false }
        : null;
    } else {
      despachante = data;
    }
  }

  if (!despachante) notFound();

  const { data: sub } = await admin
    .from("subscriptions")
    .select(
      "status, price_id, current_period_start, current_period_end, stripe_customer_id, stripe_subscription_id"
    )
    .eq("user_id", id)
    .maybeSingle();

  const agora = new Date().toISOString();

  const [
    saldoAvulsasCentavos,
    veiculos,
    { data: historico },
    { data: avulsasRecentes },
    { count: qtdSimples },
    { count: qtdAvancada },
    { count: qtdAvulsas },
    { data: recargasSimplesAtivas },
    { data: recargasAvancadaAtivas },
    { data: avulsasTodas },
    faturas,
  ] = await Promise.all([
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
    admin.from("simples_usage").select("id", { count: "exact", head: true }).eq("user_id", id),
    admin.from("avancada_usage").select("id", { count: "exact", head: true }).eq("user_id", id),
    admin
      .from("consultas_avulsas_uso")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id),
    admin
      .from("recargas_simples")
      .select("creditos_restantes")
      .eq("user_id", id)
      .gt("creditos_restantes", 0)
      .gt("expira_em", agora),
    admin
      .from("recargas_avancada")
      .select("creditos_restantes")
      .eq("user_id", id)
      .gt("creditos_restantes", 0)
      .gt("expira_em", agora),
    admin.from("consultas_avulsas_uso").select("preco_centavos").eq("user_id", id),
    buscarFaturas(sub?.stripe_customer_id ?? null),
  ]);

  const saldoSimples = (recargasSimplesAtivas ?? []).reduce(
    (soma, r) => soma + r.creditos_restantes,
    0
  );
  const saldoAvancada = (recargasAvancadaAtivas ?? []).reduce(
    (soma, r) => soma + r.creditos_restantes,
    0
  );
  const gastoTotal = faturas
    .filter((f) => f.status === "paid")
    .reduce((soma, f) => soma + f.valor, 0);

  // Valor "preço cheio": quanto essas consultas valem pro cliente (o preço
  // que aparece pra ele), não o custo real pra DOCTYPE — e não depende de
  // ter gerado fatura ou não (cota do plano, crédito manual etc. não geram
  // fatura, mas têm valor igual). Avulsas já tem o preço real cobrado
  // registrado por consulta; simples e avançada usam o preço avulso/cheio
  // de cada uma, multiplicado pela quantidade.
  const valorSimplesCentavos = (qtdSimples ?? 0) * PRECO_CONSULTA_SIMPLES_SEMPRE_CENTAVOS;
  const valorAvancadaCentavos = (qtdAvancada ?? 0) * PRECO_AVULSO_CENTAVOS;
  const valorAvulsasCentavos = (avulsasTodas ?? []).reduce(
    (soma, a) => soma + a.preco_centavos,
    0
  );
  const valorConsumidoTotalCentavos =
    valorSimplesCentavos + valorAvancadaCentavos + valorAvulsasCentavos;

  const plano = getPlanoPorPriceId(sub?.price_id);
  const status = sub?.status ? STATUS_LABEL[sub.status] : undefined;
  const temAcesso = sub?.status === "active" || sub?.status === "trialing";
  const ehManual = temAcesso && !sub?.stripe_subscription_id;
  const ehTeste = ehManual && sub?.price_id === PLANO_TESTE.priceId;

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
          {despachante.email} · Visão de suporte/manutenção. Outras ações de conta (revogar
          acesso, excluir dados) continuam na{" "}
          <Link href="/admin">listagem principal</Link>.
        </p>

        <div className="card" style={{ padding: 12, marginBottom: 20, maxWidth: 320 }}>
          <h3 style={{ marginBottom: 12, fontSize: 15 }}>Manipular créditos</h3>
          <CreditoForm userId={despachante.id} />
        </div>

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

        <div className="card" style={{ padding: 12, marginBottom: 20, maxWidth: 420 }}>
          <CobrarConsultaSimplesCheckbox
            userId={despachante.id}
            ativoInicial={Boolean(despachante.cobrar_consulta_simples)}
          />
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 6 }}>
            Hoje a consulta simples (busca de placa) é de graça pra esse despachante enquanto não
            estoura a cota do plano. Ligando essa opção, toda consulta simples dele passa a ser
            cobrada avulsa ({currency.format(PRECO_CONSULTA_SIMPLES_SEMPRE_CENTAVOS / 100)}),
            mesmo com cota disponível — descontando primeiro do saldo de recarga, se tiver.
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
                <span className="badge neutral">
                  {ehTeste ? "Acesso manual (teste)" : "Acesso manual (fixo)"}
                </span>
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
            <span className="label">Veículos cadastrados</span>
            <span className="value" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              {veiculos.length}
            </span>
          </div>
          <div className="card kv" style={{ margin: 0 }}>
            <span className="label">Gasto total (faturas pagas)</span>
            <span className="value" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
              {currency.format(gastoTotal)}
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

        <div className="grid-2" style={{ marginBottom: 24 }}>
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: 15 }}>Consultas (total)</h3>
            <div className="admin-stat-list">
              <div className="admin-stat-row">
                <span className="admin-stat-label">Simples:</span>
                <span className="admin-stat-value">{qtdSimples ?? 0}</span>
              </div>
              <div className="admin-stat-row">
                <span className="admin-stat-label">Avançada:</span>
                <span className="admin-stat-value">{qtdAvancada ?? 0}</span>
              </div>
              <div className="admin-stat-row">
                <span className="admin-stat-label">Avulsas:</span>
                <span className="admin-stat-value">{qtdAvulsas ?? 0}</span>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: 15 }}>Saldos disponíveis</h3>
            <div className="admin-stat-list">
              <div className="admin-stat-row">
                <span className="admin-stat-label">Simples:</span>
                <span className="admin-stat-value">{saldoSimples} créditos</span>
              </div>
              <div className="admin-stat-row">
                <span className="admin-stat-label">Avançada:</span>
                <span className="admin-stat-value">{saldoAvancada} créditos</span>
              </div>
              <div className="admin-stat-row">
                <span className="admin-stat-label">Avulsas:</span>
                <span className="admin-stat-value">{currency.format(saldoAvulsasCentavos / 100)}</span>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 4, fontSize: 15 }}>Valor consumido (preço cheio)</h3>
            <p style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 12 }}>
              Quanto essas consultas valem pelo preço que aparece pro cliente — não o custo real
              pra DOCTYPE, e descontado aqui mesmo quando veio de cota do plano ou crédito manual
              (não gera fatura, mas tem o mesmo valor).
            </p>
            <div className="admin-stat-list">
              <div className="admin-stat-row">
                <span className="admin-stat-label">Simples:</span>
                <span className="admin-stat-value">{currency.format(valorSimplesCentavos / 100)}</span>
              </div>
              <div className="admin-stat-row">
                <span className="admin-stat-label">Avançada:</span>
                <span className="admin-stat-value">{currency.format(valorAvancadaCentavos / 100)}</span>
              </div>
              <div className="admin-stat-row">
                <span className="admin-stat-label">Avulsas:</span>
                <span className="admin-stat-value">{currency.format(valorAvulsasCentavos / 100)}</span>
              </div>
              <div className="admin-stat-row" style={{ fontWeight: 700 }}>
                <span className="admin-stat-label">Total:</span>
                <span className="admin-stat-value">
                  {currency.format(valorConsumidoTotalCentavos / 100)}
                </span>
              </div>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12, fontSize: 15 }}>Faturas (últimas 20)</h3>
            {faturas.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)" }}>Nenhuma fatura ainda.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                {faturas.map((f) => {
                  const fStatus = FATURA_STATUS_LABEL[f.status] ?? { texto: f.status, badge: "neutral" };
                  return (
                    <div key={f.id} style={{ fontSize: 12 }}>
                      {dataHora.format(f.criadaEm)} · {currency.format(f.valor)} ·{" "}
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
            )}
          </div>
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
