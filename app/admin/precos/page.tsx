import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { salvarPreco, removerPreco } from "./actions";
import ConfirmSubmitButton from "../confirm-submit-button";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dataCurta = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

type PrecoApi = {
  id: string;
  nome: string;
  categoria: string;
  preco_centavos: number;
  atualizado_em: string;
};

export default async function PrecosApiPage() {
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
  const { data: precos } = await admin
    .from("api_precos")
    .select("id, nome, categoria, preco_centavos, atualizado_em")
    .order("categoria")
    .order("nome");

  const totalMensalEstimado = (precos || []).reduce(
    (total, p: PrecoApi) => total + p.preco_centavos,
    0
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
        <h2 style={{ marginBottom: 4 }}>Preços das APIs</h2>
        <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 20 }}>
          Referência interna do custo por consulta de cada API contratada — não afeta
          cobrança de despachante. Atualize aqui sempre que o preço mudar na API Brasil.
        </p>

        <div className="card" style={{ maxWidth: 420, marginBottom: 24 }}>
          <span className="label">Cadastrar / atualizar preço</span>
          <form action={salvarPreco} style={{ marginTop: 12 }}>
            <input
              type="text"
              name="nome"
              placeholder="Nome da API (ex: Proprietário Atual V2)"
              required
              style={{ marginBottom: 8, width: "100%" }}
            />
            <input
              type="text"
              name="categoria"
              placeholder="Categoria (ex: Segurança Veicular)"
              required
              style={{ marginBottom: 8, width: "100%" }}
            />
            <input
              type="number"
              name="preco"
              placeholder="Preço por consulta (R$)"
              step="0.01"
              min="0"
              required
              style={{ marginBottom: 12, width: "100%" }}
            />
            <button className="primary wide" type="submit">
              Salvar
            </button>
          </form>
          <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
            Se o nome já existir, só atualiza o preço e a categoria.
          </p>
        </div>

        {precos && precos.length > 0 && (
          <div className="card" style={{ overflowX: "auto" }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>API</th>
                  <th>Categoria</th>
                  <th>Preço/consulta</th>
                  <th>Atualizado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {(precos as PrecoApi[]).map((preco) => (
                  <tr key={preco.id}>
                    <td>{preco.nome}</td>
                    <td>{preco.categoria}</td>
                    <td>{currency.format(preco.preco_centavos / 100)}</td>
                    <td>{dataCurta.format(new Date(preco.atualizado_em))}</td>
                    <td>
                      <form action={removerPreco.bind(null, preco.id)}>
                        <ConfirmSubmitButton
                          confirmText={`Remover "${preco.nome}" da tabela de preços?`}
                          className="secondary-button"
                        >
                          Remover
                        </ConfirmSubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
              {precos.length} APIs cadastradas — soma de uma consulta em cada:{" "}
              {currency.format(totalMensalEstimado / 100)}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
