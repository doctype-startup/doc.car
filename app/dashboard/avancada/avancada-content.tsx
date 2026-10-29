"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import type { ConsultaAvulsaServico } from "@/lib/consultas-avulsas";
import { formatarLabelAvulsa, formatarValorAvulsa } from "@/lib/consultas-avulsas";
import { extrairCamposAvulsa } from "@/lib/consultas-avulsas-extratores";
import type { ResultadoServicoAvancada } from "@/app/api/consultas-avulsas/avancada/route";
import { isValidPlaca, normalizePlaca } from "@/lib/vehicle";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type ResultadoCard =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "error"; errorMessage: string };

export default function AvancadaContent({
  servicos,
  saldoInicialCentavos,
}: {
  servicos: ConsultaAvulsaServico[];
  saldoInicialCentavos: number;
}) {
  const [placaInput, setPlacaInput] = useState("");
  const [placaAtiva, setPlacaAtiva] = useState("");
  const [erroPlaca, setErroPlaca] = useState("");
  const [saldo, setSaldo] = useState(saldoInicialCentavos);
  const [comboLoading, setComboLoading] = useState(false);
  const [resultados, setResultados] = useState<Record<string, ResultadoCard>>({});

  function buscarPlaca(event: FormEvent) {
    event.preventDefault();
    if (!isValidPlaca(placaInput)) {
      setErroPlaca("Informe uma placa válida, ex: ABC1D23 ou ABC1234.");
      return;
    }
    setErroPlaca("");
    setResultados({});
    setPlacaAtiva(normalizePlaca(placaInput));
  }

  async function consultarServico(servico: ConsultaAvulsaServico) {
    if (!placaAtiva) return;
    setResultados((prev) => ({ ...prev, [servico.id]: { status: "loading" } }));

    try {
      const response = await fetch(
        `/api/consultas-avulsas?servico=${encodeURIComponent(servico.id)}&placa=${encodeURIComponent(placaAtiva)}`
      );
      const payload = await response.json();
      if (response.ok) {
        setResultados((prev) => ({ ...prev, [servico.id]: { status: "ok", data: payload.data } }));
        if (typeof payload.saldo === "number") setSaldo(payload.saldo);
      } else {
        setResultados((prev) => ({
          ...prev,
          [servico.id]: { status: "error", errorMessage: payload.error || "Não foi possível consultar." },
        }));
      }
    } catch {
      setResultados((prev) => ({
        ...prev,
        [servico.id]: { status: "error", errorMessage: "Não foi possível contatar o servidor." },
      }));
    }
  }

  async function consultarTudo() {
    if (!placaAtiva) return;
    setComboLoading(true);
    setResultados(
      Object.fromEntries(servicos.map((s) => [s.id, { status: "loading" } as ResultadoCard]))
    );

    try {
      const response = await fetch(
        `/api/consultas-avulsas/avancada?placa=${encodeURIComponent(placaAtiva)}`
      );
      const payload = await response.json();
      if (response.ok) {
        const porServico = new Map<string, ResultadoServicoAvancada>(
          (payload.resultados ?? []).map((r: ResultadoServicoAvancada) => [r.servicoId, r])
        );
        setResultados(
          Object.fromEntries(
            servicos.map((s) => {
              const r = porServico.get(s.id);
              if (!r) return [s.id, { status: "idle" } as ResultadoCard];
              return [s.id, r.ok ? { status: "ok", data: r.data } : { status: "error", errorMessage: r.errorMessage }];
            })
          )
        );
        if (typeof payload.saldo === "number") setSaldo(payload.saldo);
      } else {
        setResultados(
          Object.fromEntries(
            servicos.map((s) => [
              s.id,
              { status: "error", errorMessage: payload.error || "Não foi possível consultar." } as ResultadoCard,
            ])
          )
        );
      }
    } catch {
      setResultados(
        Object.fromEntries(
          servicos.map((s) => [
            s.id,
            { status: "error", errorMessage: "Não foi possível contatar o servidor." } as ResultadoCard,
          ])
        )
      );
    }

    setComboLoading(false);
  }

  const totalCombo = servicos.reduce((soma, s) => soma + s.precoCentavos, 0);

  return (
    <>
      <div className="card" style={{ maxWidth: 420, marginBottom: 20 }}>
        <form onSubmit={buscarPlaca} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <input
            type="text"
            value={placaInput}
            onChange={(event) => setPlacaInput(event.target.value.toUpperCase())}
            placeholder="Placa (ex: ABC1D23)"
            required
            style={{ flex: 1 }}
          />
          <button className="primary" type="submit">
            Buscar
          </button>
        </form>
        {erroPlaca && (
          <p className="form-error" style={{ marginTop: 8 }}>
            {erroPlaca}
          </p>
        )}
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

      {placaAtiva && (
        <>
          <div className="card" style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 4 }}>Placa {placaAtiva}</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
              Consulta todos os {servicos.length} serviços de uma vez — só cobra os que
              realmente retornarem dado (falha é estornada automaticamente).
            </p>
            <button
              type="button"
              className="secondary-button destaque"
              onClick={consultarTudo}
              disabled={comboLoading}
            >
              {comboLoading
                ? "Consultando..."
                : `Consultar tudo (até ${currency.format(totalCombo / 100)})`}
            </button>
          </div>

          <div className="grid-2">
            {servicos.map((servico) => {
              const resultado = resultados[servico.id] ?? { status: "idle" };
              return (
                <div key={servico.id} className="card">
                  <h3>
                    {servico.nome}{" "}
                    {resultado.status === "ok" && <span className="badge ok">Dados reais</span>}
                  </h3>
                  <p style={{ fontSize: 12, color: "var(--muted)", marginBottom: 12 }}>
                    {currency.format(servico.precoCentavos / 100)} por consulta
                  </p>

                  {resultado.status !== "ok" && (
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => consultarServico(servico)}
                      disabled={resultado.status === "loading"}
                      style={{ marginBottom: 12 }}
                    >
                      {resultado.status === "loading" ? "Consultando..." : "Consultar"}
                    </button>
                  )}

                  {resultado.status === "error" && (
                    <p style={{ fontSize: 13, color: "var(--muted)" }}>
                      {resultado.errorMessage}
                      {resultado.errorMessage === "Saldo insuficiente." && (
                        <>
                          {" "}
                          <Link href="/dashboard/consultas-avulsas/recarga">Recarregar saldo</Link>
                        </>
                      )}
                    </p>
                  )}

                  {resultado.status === "ok" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {(extrairCamposAvulsa(servico.id, resultado.data) ??
                        Object.entries(resultado.data).map(([chave, valor]) => ({
                          label: formatarLabelAvulsa(chave),
                          valor: formatarValorAvulsa(valor),
                        }))
                      ).map((campo) => (
                        <div key={campo.label} className="kv">
                          <span className="label">{campo.label}</span>
                          <span className="value">{campo.valor}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
