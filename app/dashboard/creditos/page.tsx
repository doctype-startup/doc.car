import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe";
import {
  PACOTES_RECARGA,
  PRECO_AVULSO_CENTAVOS,
  PRECO_AVULSO_SIMPLES_CENTAVOS,
  getPlanoPorPriceId,
} from "@/lib/plans";
import { contarUsoSimplesNoPeriodo } from "@/lib/uso-simples";
import { contarUsoNoPeriodo as contarUsoAvancadaNoPeriodo } from "@/lib/uso-avancada";
import { getRecargasAtivas, getSaldoCreditos } from "@/lib/creditos";
import { getRecargasAtivasAvancada, getSaldoCreditosAvancada } from "@/lib/creditos-avancada";
import Guardiao from "@/components/Guardiao";
import SaldoConsultas from "@/components/SaldoConsultas";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function inicioDoPeriodo(currentPeriodStart: string | null) {
  if (currentPeriodStart) return currentPeriodStart;
  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);
  return inicioDoMes.toISOString();
}

export default async function CreditosPage({
  searchParams,
}: {
  searchParams: Promise<{ compra?: string; erro?: string }>;
}) {
  const { compra, erro } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("price_id, current_period_start")
    .eq("user_id", user.id)
    .maybeSingle();

  const plano = getPlanoPorPriceId(subscription?.price_id);
  const desde = inicioDoPeriodo(subscription?.current_period_start ?? null);
  const [usoNoPeriodo, usoAvancadaNoPeriodo, saldo, recargas, saldoAvancada, recargasAvancada] =
    await Promise.all([
      plano ? contarUsoSimplesNoPeriodo(supabase, user.id, desde) : 0,
      plano ? contarUsoAvancadaNoPeriodo(supabase, user.id, desde) : 0,
      getSaldoCreditos(supabase, user.id),
      getRecargasAtivas(supabase, user.id),
      getSaldoCreditosAvancada(supabase, user.id),
      getRecargasAtivasAvancada(supabase, user.id),
    ]);

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Créditos de consulta simples</h1>
          <p>
            Cada plano já inclui uma cota de consultas simples por mês. Depois
            dela, cada consulta extra é coberta por crédito de recarga (se
            houver saldo) ou cobrada avulsa.
          </p>
        </div>
      </div>

      {compra === "sucesso" && (
        <div className="badge ok" style={{ marginBottom: 20, display: "inline-block" }}>
          Recarga confirmada! O saldo pode levar alguns segundos pra atualizar.
        </div>
      )}
      {erro === "1" && (
        <p className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>
          Não foi possível iniciar a compra. Tente de novo em instantes.
        </p>
      )}

      <SaldoConsultas
        usoInicial={usoNoPeriodo}
        cotaInicial={plano?.cotaSimples ?? null}
        usoAvancadaInicial={usoAvancadaNoPeriodo}
        cotaAvancadaInicial={plano?.cota ?? null}
        creditosInicial={saldo}
        creditosAvancadaInicial={saldoAvancada}
      />

      {(recargas.length > 0 || recargasAvancada.length > 0) && (
        <div className="card" style={{ marginBottom: 24, marginTop: -8 }}>
          <span className="label">Validade das recargas</span>
          {recargas.map((recarga) => (
            <p key={recarga.id} style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {recarga.creditosRestantes} crédito{recarga.creditosRestantes > 1 ? "s" : ""} de
              consulta simples — válido até {new Date(recarga.expiraEm).toLocaleDateString("pt-BR")}
            </p>
          ))}
          {recargasAvancada.map((recarga) => (
            <p key={recarga.id} style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {recarga.creditosRestantes} crédito{recarga.creditosRestantes > 1 ? "s" : ""} de
              consulta avançada — válido até {new Date(recarga.expiraEm).toLocaleDateString("pt-BR")}
            </p>
          ))}
        </div>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Consultas avulsas</h2>
      <div
        className="planos-grid"
        style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: 700, marginBottom: 24 }}
      >
        <div className="plano-card">
          <h3>Consulta simples avulsa</h3>
          <div className="plano-preco">{currency.format(PRECO_AVULSO_SIMPLES_CENTAVOS / 100)}</div>
          <p className="plano-cota">
            Cobrada automaticamente quando a cota do mês e os créditos acabam — ou compre 1
            crédito agora pra garantir esse preço.
          </p>
          {isStripeConfigured && (
            <form action="/api/checkout-creditos" method="POST">
              <input type="hidden" name="pacote" value="avulso-simples" />
              <button className="primary wide" type="submit">
                Comprar recarga
              </button>
            </form>
          )}
        </div>
        <div className="plano-card">
          <h3>Consulta avançada avulsa</h3>
          <div className="plano-preco">{currency.format(PRECO_AVULSO_CENTAVOS / 100)}</div>
          <p className="plano-cota">
            Cobrada automaticamente quando a cota mensal acaba — ou compre 1 crédito agora pra
            garantir esse preço.
          </p>
          {isStripeConfigured && (
            <form action="/api/checkout-creditos" method="POST">
              <input type="hidden" name="pacote" value="avulso-avancada" />
              <button className="primary wide" type="submit">
                Comprar recarga
              </button>
            </form>
          )}
        </div>
      </div>

      {!isStripeConfigured ? (
        <div className="empty-state">
          <Guardiao pose="aguardando" mensagem="Recarga ainda não disponível — cobrança não configurada." />
        </div>
      ) : (
        <>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>Pacotes de recarga</h2>
          <div className="planos-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: 700 }}>
            {PACOTES_RECARGA.map((pacote) => (
              <div key={pacote.id} className="plano-card">
                <h3>{pacote.creditos} consultas simples</h3>
                <div className="plano-preco">{currency.format(pacote.precoCentavos / 100)}</div>
                <p className="plano-cota">
                  {currency.format(pacote.precoCentavos / 100 / pacote.creditos)} por consulta —
                  válido por 6 meses
                </p>
                <form action="/api/checkout-creditos" method="POST">
                  <input type="hidden" name="pacote" value={pacote.id} />
                  <button className="primary wide" type="submit">
                    Comprar recarga
                  </button>
                </form>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
            Pagamento no cartão ou PIX.
          </p>
        </>
      )}
    </>
  );
}
