import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe";
import { getSaldoAvulsas } from "@/lib/saldo-avulsas";
import Guardiao from "@/components/Guardiao";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function RecargaConsultasAvulsasPage({
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

  const saldo = await getSaldoAvulsas(supabase, user.id);

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Recarregar saldo — Consultas Avulsas</h1>
          <p>
            Cada serviço do menu Consultas Avulsas tem um preço próprio, debitado desse saldo —
            sem validade, sem cota mensal.
          </p>
        </div>
      </div>

      <div className="card kv" style={{ maxWidth: 320, marginBottom: 24 }}>
        <span className="label">Saldo atual</span>
        <span className="value" style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>
          {currency.format(saldo / 100)}
        </span>
      </div>

      {compra === "sucesso" && (
        <div className="badge ok" style={{ marginBottom: 20, display: "inline-block" }}>
          Recarga confirmada! O saldo pode levar alguns segundos pra atualizar.
        </div>
      )}
      {erro === "1" && (
        <p className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>
          Não foi possível iniciar a recarga. Confira o valor (mínimo R$ 20,00) e tente de novo.
        </p>
      )}

      {isStripeConfigured ? (
        <div className="card" style={{ maxWidth: 360 }}>
          <span className="label">Recarregar</span>
          <form action="/api/checkout-consultas-avulsas" method="POST" style={{ marginTop: 12 }}>
            <input
              type="number"
              name="valor"
              placeholder="Valor em R$ (mínimo 20)"
              min={20}
              step="0.01"
              required
              style={{ marginBottom: 12, width: "100%" }}
            />
            <button className="primary wide" type="submit">
              Recarregar
            </button>
          </form>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            Pagamento no cartão ou PIX.
          </p>
        </div>
      ) : (
        <div className="empty-state">
          <Guardiao pose="aguardando" mensagem="Recarga ainda não disponível — cobrança não configurada." />
        </div>
      )}
    </>
  );
}
