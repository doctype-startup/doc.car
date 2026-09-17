import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe";
import { isApiBrasilConfigured, PRECO_CRLV_CENTAVOS } from "@/lib/crlv";
import Guardiao from "@/components/Guardiao";

const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type DocumentoCrlv = {
  id: string;
  placa: string;
  uf: string;
  status: "emitido" | "erro";
  pdf_storage_path: string | null;
  erro_mensagem: string | null;
  criado_em: string;
};

export default async function DocumentosPage({
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

  const { data: documentos } = await supabase
    .from("documentos_crlv")
    .select("id, placa, uf, status, pdf_storage_path, erro_mensagem, criado_em")
    .eq("user_id", user.id)
    .order("criado_em", { ascending: false });

  const disponivel = isStripeConfigured && isApiBrasilConfigured;

  return (
    <>
      <div className="app-header">
        <div>
          <h1>Documentos</h1>
          <p>
            Emita o CRLV-e (Certificado de Registro e Licenciamento de Veículo eletrônico)
            oficial informando só a placa — pronto pra imprimir ou baixar.
          </p>
        </div>
      </div>

      {compra === "sucesso" && (
        <div className="badge ok" style={{ marginBottom: 20, display: "inline-block" }}>
          Pagamento confirmado! O CRLV-e pode levar alguns segundos pra ser emitido — atualize a
          página se ainda não aparecer na lista abaixo.
        </div>
      )}
      {erro === "1" && (
        <p className="form-error" style={{ maxWidth: 420, marginBottom: 20 }}>
          Não foi possível iniciar a emissão. Tente de novo em instantes.
        </p>
      )}

      {!disponivel ? (
        <div className="empty-state">
          <Guardiao pose="aguardando" mensagem="Emissão de CRLV-e ainda não disponível." />
        </div>
      ) : (
        <div className="card" style={{ maxWidth: 420, marginBottom: 24 }}>
          <span className="label">Emitir CRLV-e</span>
          <form action="/api/checkout-crlv" method="POST" style={{ marginTop: 12 }}>
            <input
              type="text"
              name="placa"
              placeholder="Placa (ex: ABC1D23)"
              maxLength={8}
              required
              style={{ textTransform: "uppercase", marginBottom: 8, width: "100%" }}
            />
            <select name="uf" required defaultValue="" style={{ marginBottom: 12, width: "100%" }}>
              <option value="" disabled>
                UF da placa
              </option>
              {UFS.map((uf) => (
                <option key={uf} value={uf}>
                  {uf}
                </option>
              ))}
            </select>
            <button className="primary wide" type="submit">
              Emitir CRLV-e — {currency.format(PRECO_CRLV_CENTAVOS / 100)}
            </button>
          </form>
        </div>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Documentos emitidos</h2>
      {!documentos || documentos.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Nenhum documento emitido ainda.</p>
      ) : (
        <div className="card" style={{ maxWidth: 560 }}>
          {(documentos as DocumentoCrlv[]).map((doc) => (
            <div
              key={doc.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div>
                <strong>{doc.placa}</strong> — {doc.uf}
                <br />
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {new Date(doc.criado_em).toLocaleString("pt-BR")}
                  {doc.status === "erro" && ` — falhou: ${doc.erro_mensagem}`}
                </span>
              </div>
              {doc.status === "emitido" && doc.pdf_storage_path && (
                <div style={{ display: "flex", gap: 8 }}>
                  <a
                    className="secondary-button"
                    href={`/api/documentos/${doc.id}/crlv?visualizar=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Imprimir
                  </a>
                  <a className="primary" href={`/api/documentos/${doc.id}/crlv`}>
                    Baixar
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
