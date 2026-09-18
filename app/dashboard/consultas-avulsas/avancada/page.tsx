import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getConsultasAvulsasPorGrupo } from "@/lib/consultas-avulsas";
import { getSaldoAvulsas } from "@/lib/saldo-avulsas";
import ConsultarAvancadaForm from "./consultar-form";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export default async function ConsultaAvancadaAvulsaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const servicos = getConsultasAvulsasPorGrupo("avancada");
  const precoTotalCentavos = servicos.reduce((total, s) => total + s.precoCentavos, 0);
  const saldo = await getSaldoAvulsas(supabase, user.id);

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Consulta Avançada — Consultas Avulsas</h1>
          <p>
            Uma placa, várias APIs de uma vez — cada serviço abaixo é debitado do seu saldo
            individualmente, só o que realmente retornar dado é cobrado.
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

      {servicos.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--muted)", maxWidth: 420 }}>
          Nenhum serviço de consulta avançada cadastrado ainda.
        </p>
      ) : (
        <>
          <div className="card" style={{ maxWidth: 420, marginBottom: 20 }}>
            <span className="label">Serviços incluídos ({servicos.length})</span>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {servicos.map((servico) => (
                <div
                  key={servico.id}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}
                >
                  <span>{servico.nome}</span>
                  <span style={{ color: "var(--muted)" }}>
                    {currency.format(servico.precoCentavos / 100)}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 10 }}>
              Até {currency.format(precoTotalCentavos / 100)} no total, se todos os serviços
              retornarem dado.
            </p>
          </div>

          <ConsultarAvancadaForm />
        </>
      )}
    </>
  );
}
