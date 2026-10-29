import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getConsultasAvulsasParaCombo } from "@/lib/consultas-avulsas";
import { getSaldoAvulsas } from "@/lib/saldo-avulsas";
import AvancadaContent from "./avancada-content";

export default async function ConsultaAvancadaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const servicos = getConsultasAvulsasParaCombo();
  const saldo = await getSaldoAvulsas(supabase, user.id);

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Consulta Avançada</h1>
          <p>
            Dados reais por placa via API Brasil — Renavam, chassi, ficha técnica, multas,
            restrição judicial (Renajud) e mais. Cada serviço tem botão próprio e preço
            próprio, debitado do seu saldo de Consultas Avulsas; ou consulte todos de uma vez
            com o botão &quot;Consultar tudo&quot;.
          </p>
        </div>
      </div>

      <AvancadaContent servicos={servicos} saldoInicialCentavos={saldo} />
    </>
  );
}
