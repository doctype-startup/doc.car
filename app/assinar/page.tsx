import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe";
import { PLANOS, PRECO_AVULSO_CENTAVOS } from "@/lib/plans";
import Guardiao from "@/components/Guardiao";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const WHATSAPP_CONTATO = "5541998365578";
const WHATSAPP_MENSAGEM = encodeURIComponent(
  "Olá! Quero saber mais sobre um plano personalizado no DOC.CAR."
);

export default async function AssinarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (subscription?.status === "active" || subscription?.status === "trialing") {
    redirect("/dashboard");
  }

  return (
    <div className="assinar-page">
      <div className="assinar-header">
        <div className="brand">
          DOC<span>.CAR</span>
        </div>
        <Guardiao pose="aprovacao" size={72} className="assinar-guardiao" />
        <h2>Escolha seu plano</h2>
        <p>
          {subscription?.status === "past_due"
            ? "Sua assinatura está com um pagamento pendente. Escolha um plano para regularizar."
            : "Consultas de placa sempre liberadas. A cota abaixo é só para consultas avançadas (multas, roubo/furto e Renajud)."}
        </p>
      </div>

      {!isStripeConfigured && (
        <div
          className="form-error"
          style={{ maxWidth: 420, margin: "0 auto 24px" }}
        >
          Cobrança ainda não configurada. Fale com o administrador do DOC.CAR.
        </div>
      )}

      <div className="planos-grid">
        {PLANOS.map((plano, index) => (
          <div
            key={plano.id}
            className={`plano-card${index === 1 ? " destaque" : ""}`}
          >
            <h3>{plano.nome}</h3>
            <div className="plano-preco">
              {currency.format(plano.precoCentavos / 100)}
              <span> /mês</span>
            </div>
            <p className="plano-cota">{plano.cota} consultas avançadas/mês</p>

            {isStripeConfigured ? (
              <form action="/api/checkout" method="POST">
                <input type="hidden" name="plano" value={plano.id} />
                <button className="primary wide" type="submit">
                  Assinar {plano.nome}
                </button>
              </form>
            ) : (
              <button className="primary wide" type="button" disabled>
                Assinar {plano.nome}
              </button>
            )}

            <p className="plano-detalhe">
              Consulta avançada extra fora da cota:{" "}
              {currency.format(PRECO_AVULSO_CENTAVOS / 100)} cada.
            </p>
          </div>
        ))}

        <div className="plano-card contato-card">
          <h3>Alto volume?</h3>
          <p>
            Escritórios que passam de 120 consultas avançadas por mês
            regularmente costumam sair mais em conta com um plano sob
            medida. Fala com a gente.
          </p>
          <a
            className="secondary-button"
            href={`https://wa.me/${WHATSAPP_CONTATO}?text=${WHATSAPP_MENSAGEM}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Fale com a gente
          </a>
        </div>
      </div>
    </div>
  );
}
