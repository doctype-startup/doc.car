import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe";
import {
  PACOTES_RECARGA,
  PRECO_AVULSO_SIMPLES_CENTAVOS,
  getPlanoPorPriceId,
} from "@/lib/plans";
import { contarUsoSimplesNoPeriodo } from "@/lib/uso-simples";
import { getRecargasAtivas, getSaldoCreditos } from "@/lib/creditos";
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
  const usoNoPeriodo = plano ? await contarUsoSimplesNoPeriodo(supabase, user.id, desde) : 0;
  const [saldo, recargas] = await Promise.all([
    getSaldoCreditos(supabase, user.id),
    getRecargasAtivas(supabase, user.id),
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
        creditosInicial={saldo}
        precoAvulsoFormatado={currency.format(PRECO_AVULSO_SIMPLES_CENTAVOS / 100)}
      />

      {recargas.length > 0 && (
        <div className="card" style={{ marginBottom: 24, marginTop: -8 }}>
          <span className="label">Validade das recargas</span>
          {recargas.map((recarga) => (
            <p key={recarga.id} style={{ fontSize: 13, color: "var(--muted)", marginTop: 4 }}>
              {recarga.creditosRestantes} crédito{recarga.creditosRestantes > 1 ? "s" : ""} —
              válido até {new Date(recarga.expiraEm).toLocaleDateString("pt-BR")}
            </p>
          ))}
        </div>
      )}

      {!isStripeConfigured ? (
        <div className="empty-state">
          <Guardiao pose="aguardando" mensagem="Recarga ainda não disponível — cobrança não configurada." />
        </div>
      ) : (
        <>
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
