import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPlanoPorPriceId, PLANOS } from "@/lib/plans";
import { contarUsoNoPeriodo } from "@/lib/uso-avancada";
import { revogarAcesso, revogarEExcluirDados } from "../actions";
import { autorizarFuncionario, desvincularFuncionario } from "./actions";
import ConfirmSubmitButton from "../confirm-submit-button";
import WhatsappAcessoButton from "../whatsapp-acesso-button";
import CopiarLinkButton from "../copiar-link-button";
import PasswordField from "@/components/PasswordField";

export default async function CadastroAutorizacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/dashboard");

  const admin = createAdminClient();

  const { data: todosPerfis } = await admin
    .from("profiles")
    .select("id, name, email, vinculado_a_id")
    .order("name");

  const { data: subscriptions } = await admin
    .from("subscriptions")
    .select("user_id, status, price_id, current_period_start, current_period_end");

  const subsPorUsuario = new Map((subscriptions ?? []).map((s) => [s.user_id, s]));

  const despachantesComAcesso = (todosPerfis ?? []).filter((p) => {
    const sub = subsPorUsuario.get(p.id);
    return sub?.status === "active" || sub?.status === "trialing";
  });

  const funcionarios = (todosPerfis ?? []).filter((p) => p.vinculado_a_id);
  const perfilPorId = new Map((todosPerfis ?? []).map((p) => [p.id, p]));

  const inicioDoMes = new Date();
  inicioDoMes.setDate(1);
  inicioDoMes.setHours(0, 0, 0, 0);

  const linhas = await Promise.all(
    funcionarios.map(async (f) => {
      const sub = subsPorUsuario.get(f.id);
      const plano = getPlanoPorPriceId(sub?.price_id);
      const inicioDoPeriodo = sub?.current_period_start || inicioDoMes.toISOString();
      const uso = plano ? await contarUsoNoPeriodo(admin, f.id, inicioDoPeriodo) : 0;
      const despachante = f.vinculado_a_id ? perfilPorId.get(f.vinculado_a_id) : undefined;
      return { funcionario: f, sub, plano, uso, despachante };
    })
  );

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-left">
          <div className="brand">
            DOC<span>.CAR</span> <span className="admin-tag">Admin</span>
          </div>
        </div>
        <nav className="topbar-nav">
          <Link href="/admin">Voltar pro admin</Link>
          <Link href="/dashboard">Voltar ao app</Link>
        </nav>
      </header>
      <div className="orange-line" />
      <main className="app-content">
        <h2 style={{ marginBottom: 4 }}>Cadastro e Autorizações</h2>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
          Autorize manualmente o acesso de um funcionário de um despachante já ativo. O
          funcionário recebe login e cota próprios — não compartilha a cota do despachante — o
          vínculo aqui é só pra organização.
        </p>

        <div className="card" style={{ padding: 16, marginBottom: 24 }}>
          <h3 style={{ marginBottom: 4, fontSize: 15 }}>Autorizar funcionário</h3>
          <form
            action={autorizarFuncionario}
            style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
          >
            <select
              name="despachanteId"
              required
              style={{ fontSize: 13, flex: "1 1 220px" }}
              defaultValue=""
            >
              <option value="" disabled>
                Despachante responsável
              </option>
              {despachantesComAcesso.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.email})
                </option>
              ))}
            </select>
            <input
              type="email"
              name="email"
              placeholder="e-mail do funcionário"
              required
              style={{ fontSize: 13, flex: "1 1 220px" }}
            />
            <PasswordField
              name="senha"
              placeholder="Senha provisória (opcional)"
              minLength={6}
              style={{ fontSize: 13 }}
              wrapperStyle={{ flex: "1 1 180px" }}
            />
            <select name="plano" defaultValue={PLANOS[0].id} style={{ fontSize: 13 }}>
              {PLANOS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
            <button type="submit" className="secondary-button" style={{ fontSize: 12 }}>
              Autorizar acesso
            </button>
          </form>
          <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 8 }}>
            Preenchendo a senha, o funcionário já consegue entrar com ela na hora — combine por
            fora, ela não é enviada por e-mail. Deixando em branco, quem ainda não tem conta
            recebe um convite do Supabase pra criar a própria senha. Se o despachante escolhido
            perder o acesso, o do funcionário não é afetado — revogue os dois separadamente.
          </p>
          {despachantesComAcesso.length === 0 && (
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
              Nenhum despachante com acesso ativo no momento.
            </p>
          )}
        </div>

        <div className="card" style={{ overflowX: "auto" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Funcionário</th>
                <th>Vinculado a</th>
                <th>Plano</th>
                <th>Uso no período</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ funcionario, plano, uso, despachante }) => (
                <tr key={funcionario.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{funcionario.name}</div>
                    <div style={{ fontSize: 12, color: "var(--muted)" }}>{funcionario.email}</div>
                  </td>
                  <td>
                    {despachante ? (
                      <>
                        <div>{despachante.name}</div>
                        <div style={{ fontSize: 12, color: "var(--muted)" }}>
                          {despachante.email}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {plano?.nome ?? "—"}
                  </td>
                  <td>{plano ? `${uso}/${plano.cota}` : "—"}</td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-start" }}>
                      <WhatsappAcessoButton nome={funcionario.name} email={funcionario.email} />
                      <CopiarLinkButton email={funcionario.email} />
                      <form action={desvincularFuncionario.bind(null, funcionario.id)}>
                        <button type="submit" className="secondary-button" style={{ fontSize: 12 }}>
                          Desvincular
                        </button>
                      </form>
                      <form action={revogarAcesso.bind(null, funcionario.id)}>
                        <button type="submit" className="secondary-button" style={{ fontSize: 12 }}>
                          Revogar acesso
                        </button>
                      </form>
                      <form action={revogarEExcluirDados.bind(null, funcionario.id)}>
                        <ConfirmSubmitButton
                          className="danger-button"
                          confirmText={`Excluir permanentemente a conta e todos os dados de ${funcionario.name} (${funcionario.email})? Isso cancela o acesso, apaga perfil, histórico de consultas e uso — não tem como desfazer.`}
                        >
                          Excluir dados
                        </ConfirmSubmitButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {funcionarios.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 12 }}>
              Nenhum funcionário autorizado ainda.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
