"use client";

// SC (Santa Catarina) fora da lista de propósito: a API Brasil respondeu
// "uf SC não suportada para consulta CRLV." em testes reais — deixar
// selecionável cobraria de novo por uma tentativa fadada a falhar. Se algum
// outro estado também não for suportado, o erro específico do fornecedor
// agora aparece na lista de "Documentos emitidos" (lib/crlv.ts prioriza
// json.data.detail), então dá pra remover ele daqui também quando acontecer.
const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SP", "SE", "TO",
];

export default function EmitirCrlvForm({ precoFormatado }: { precoFormatado: string }) {
  function confirmarCobranca(event: React.FormEvent<HTMLFormElement>) {
    const confirmado = window.confirm(
      `Isso vai gerar uma cobrança de ${precoFormatado}, mesmo que seja uma nova tentativa pra uma placa que já falhou antes. Confirmar?`
    );
    if (!confirmado) event.preventDefault();
  }

  return (
    <form action="/api/checkout-crlv" method="POST" onSubmit={confirmarCobranca} style={{ marginTop: 12 }}>
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
        Emitir CRLV-e — {precoFormatado}
      </button>
    </form>
  );
}
