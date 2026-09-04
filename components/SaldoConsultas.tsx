"use client";

import { useEffect, useState } from "react";

type Props = {
  usoInicial: number;
  cotaInicial: number | null;
  usoAvancadaInicial: number;
  cotaAvancadaInicial: number | null;
  creditosInicial: number;
  creditosAvancadaInicial: number;
};

const INTERVALO_MS = 15000;

export default function SaldoConsultas({
  usoInicial,
  cotaInicial,
  usoAvancadaInicial,
  cotaAvancadaInicial,
  creditosInicial,
  creditosAvancadaInicial,
}: Props) {
  const [uso, setUso] = useState(usoInicial);
  const [cota, setCota] = useState(cotaInicial);
  const [usoAvancada, setUsoAvancada] = useState(usoAvancadaInicial);
  const [cotaAvancada, setCotaAvancada] = useState(cotaAvancadaInicial);
  const [creditos, setCreditos] = useState(creditosInicial);
  const [creditosAvancada, setCreditosAvancada] = useState(creditosAvancadaInicial);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function atualizar() {
      setAtualizando(true);
      try {
        const response = await fetch("/api/creditos/saldo");
        if (response.ok && !cancelado) {
          const payload = await response.json();
          setUso(payload.usoNoPeriodo);
          setCota(payload.cotaSimples);
          setUsoAvancada(payload.usoAvancadaNoPeriodo);
          setCotaAvancada(payload.cotaAvancada);
          setCreditos(payload.creditos);
          setCreditosAvancada(payload.creditosAvancada);
          setAtualizadoEm(new Date());
        }
      } catch {
        // mantém os últimos valores conhecidos em caso de falha de rede
      }
      if (!cancelado) setAtualizando(false);
    }

    const timer = setInterval(() => void atualizar(), INTERVALO_MS);
    function aoFicarVisivel() {
      if (document.visibilityState === "visible") void atualizar();
    }
    document.addEventListener("visibilitychange", aoFicarVisivel);

    return () => {
      cancelado = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoFicarVisivel);
    };
  }, []);

  const percentual = cota ? Math.min(100, Math.round((uso / cota) * 100)) : 0;
  const percentualAvancada = cotaAvancada
    ? Math.min(100, Math.round((usoAvancada / cotaAvancada) * 100))
    : 0;

  return (
    <div className="card saldo-consumo" style={{ marginBottom: 24 }}>
      <div className="result-title">
        <h3 style={{ marginBottom: 0 }}>Seu saldo</h3>
        <span className="saldo-status">
          <span className={`status-dot${atualizando ? " atualizando" : ""}`} />
          {atualizadoEm
            ? `Atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR")}`
            : "Ao vivo"}
        </span>
      </div>

      {cota !== null && (
        <div style={{ marginBottom: 18 }}>
          <div className="saldo-barra-label">
            <span>Consultas simples usadas neste período</span>
            <span>
              {uso}/{cota}
            </span>
          </div>
          <div className="saldo-barra">
            <div className="saldo-barra-fill" style={{ width: `${percentual}%` }} />
          </div>
        </div>
      )}

      {cotaAvancada !== null && (
        <div style={{ marginBottom: 18 }}>
          <div className="saldo-barra-label">
            <span>Consultas avançadas usadas neste período</span>
            <span>
              {usoAvancada}/{cotaAvancada}
            </span>
          </div>
          <div className="saldo-barra">
            <div className="saldo-barra-fill" style={{ width: `${percentualAvancada}%` }} />
          </div>
        </div>
      )}

      <div className="grid-2">
        <div className="kv">
          <span className="label">Créditos de consulta simples disponíveis</span>
          <span className="value">{creditos}</span>
        </div>
        <div className="kv">
          <span className="label">Créditos de consulta avançada disponíveis</span>
          <span className="value">{creditosAvancada}</span>
        </div>
      </div>
    </div>
  );
}
