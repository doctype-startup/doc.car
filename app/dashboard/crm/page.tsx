import { createClient } from "@/lib/supabase/server";
import CadastrarCpfCnpjForm from "./cadastrar-cpf-cnpj-form";
import ConsultarProprietarioForm from "./consultar-proprietario-form";

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function CrmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("cpf_cnpj")
    .eq("id", user.id)
    .single();

  const { data: auditoria } = await supabase
    .from("crm_proprietario_auditoria")
    .select("id, placa, consultado_em")
    .eq("user_id", user.id)
    .order("consultado_em", { ascending: false })
    .limit(20);

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Histórico de Proprietário</h1>
          <p>
            Dossiê completo do proprietário atual de um veículo (nome, CPF/CNPJ) por placa —
            uso profissional exclusivo, cada consulta é registrada e conta como consulta
            avançada.
          </p>
        </div>
      </div>

      {!profile?.cpf_cnpj ? (
        <CadastrarCpfCnpjForm />
      ) : (
        <ConsultarProprietarioForm />
      )}

      {auditoria && auditoria.length > 0 && (
        <>
          <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>
            Suas últimas consultas
          </h2>
          <div className="card" style={{ maxWidth: 480 }}>
            {auditoria.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 13,
                }}
              >
                <strong>{item.placa}</strong>
                <span style={{ color: "var(--muted)" }}>
                  {dataHora.format(new Date(item.consultado_em))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
