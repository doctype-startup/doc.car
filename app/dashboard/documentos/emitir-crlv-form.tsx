"use client";

// Lista oficial de estados suportados pela API Brasil pra emissão de CRLV-e
// (página "API Veicular — Emissão de CRLV-e (digital) por Placa" no painel
// deles) — confirma que SC não está aí, batendo com o erro real recebido
// ("uf SC não suportada para consulta CRLV."). Deixar um estado fora dessa
// lista selecionável cobraria de novo por uma tentativa fadada a falhar.
const UFS = [
  "AP", "BA", "GO", "MA", "MG", "MT", "PA", "PI", "PR", "RO", "RR", "SE", "SP", "TO",
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
