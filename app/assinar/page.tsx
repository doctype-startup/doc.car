import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe";
import Guardiao from "@/components/Guardiao";

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
    <div className="login-page">
      <div className="login-brand">
        <div className="brand">
          DOC<span>.CAR</span>
        </div>
        <p>
          Consulta veicular completa para despachantes — placa, ficha
          técnica, FIPE, débitos e restrições em um só lugar. Um produto{" "}
          <strong>DOCTYPE</strong>.
        </p>
      </div>
      <div className="login-panel">
        <div className="login-card">
          <div className="orange-line" />
          <div style={{ padding: "20px 32px 32px" }}>
            <Guardiao pose="aprovacao" size={72} className="assinar-guardiao" />
            <h2 style={{ marginTop: 14 }}>Assine o DOC.CAR</h2>
            <p style={{ marginTop: 6, fontSize: 13, color: "var(--muted)" }}>
              {subscription?.status === "past_due"
                ? "Sua assinatura está com um pagamento pendente. Atualize para continuar consultando."
                : "Sua conta foi criada. Para acessar as consultas, ative sua assinatura."}
            </p>

            {isStripeConfigured ? (
              <form action="/api/checkout" method="POST" style={{ marginTop: 20 }}>
                <button className="primary wide" type="submit">
                  Assinar agora
                </button>
              </form>
            ) : (
              <div className="form-error" style={{ marginTop: 20 }}>
                Cobrança ainda não configurada. Fale com o administrador do
                DOC.CAR.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
