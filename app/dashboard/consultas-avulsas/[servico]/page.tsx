import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getConsultaAvulsaPorId } from "@/lib/consultas-avulsas";
import { getSaldoAvulsas } from "@/lib/saldo-avulsas";
import ConsultarAvulsaForm from "./consultar-form";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function ConsultaAvulsaPage({
  params,
}: {
  params: Promise<{ servico: string }>;
}) {
  const { servico: servicoId } = await params;
  const servico = getConsultaAvulsaPorId(servicoId);
  if (!servico) notFound();

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
          <h1>{servico.nome}</h1>
          <p>
            Consulta avulsa por placa — {currency.format(servico.precoCentavos / 100)} por
            consulta, debitado do seu saldo de Consultas Avulsas.
          </p>
        </div>
      </div>

      <div className="card kv" style={{ maxWidth: 320, marginBottom: 20 }}>
        <span className="label">Seu saldo</span>
        <span className="value" style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
          {currency.format(saldo / 100)}
        </span>
        <Link href="/dashboard/consultas-avulsas/recarga" style={{ fontSize: 12, marginTop: 6 }}>
          Recarregar saldo
        </Link>
      </div>

      {saldo < servico.precoCentavos && (
        <p className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>
          Saldo insuficiente pra essa consulta —{" "}
          <Link href="/dashboard/consultas-avulsas/recarga">recarregue aqui</Link> antes de
          continuar.
        </p>
      )}

      <ConsultarAvulsaForm servicoId={servico.id} precoCentavos={servico.precoCentavos} />
    </>
  );
}
