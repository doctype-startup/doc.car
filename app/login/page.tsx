import Link from "next/link";
import { Suspense } from "react";
import Guardiao from "@/components/Guardiao";
import LoginSignupForm from "./login-form";
import { PLANOS } from "@/lib/plans";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const WHATSAPP_CONTATO = "5541998365578";
const WHATSAPP_MENSAGEM = encodeURIComponent(
  "Olá! Quero saber mais sobre um plano personalizado no DOC.CAR."
);

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="brand">
          DOC<span>.CAR</span>
        </div>
        <p>
          Consulta veicular completa para despachantes — placa, ficha
          técnica, FIPE, débitos e restrições em um só lugar. Um produto{" "}
          <strong>DOCTYPE</strong>.
        </p>
        <Guardiao pose="aguardando" />

        <div className="login-planos">
          <h3>Planos</h3>
          <div className="login-planos-lista">
            {PLANOS.map((plano, index) => (
              <Link
                key={plano.id}
                href={`/login?plano=${plano.id}`}
                className={`login-plano-card${index === 1 ? " destaque" : ""}`}
              >
                <div className="login-plano-linha">
                  <span className="login-plano-nome">{plano.nome}</span>
                  <span className="login-plano-preco">
                    {currency.format(plano.precoCentavos / 100)}
                    <span> /mês</span>
                  </span>
                </div>
                <span className="login-plano-cota">
                  {plano.cota} consultas avançadas/mês
                </span>
              </Link>
            ))}
            <a
              className="login-plano-card"
              href={`https://wa.me/${WHATSAPP_CONTATO}?text=${WHATSAPP_MENSAGEM}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="login-plano-linha">
                <span className="login-plano-nome">Empresas de grande porte</span>
                <span className="login-plano-preco">Fale conosco</span>
              </div>
              <span className="login-plano-cota">
                Volume alto de consultas? A gente monta um plano sob medida.
              </span>
            </a>
          </div>
        </div>
      </div>
      <div className="login-panel">
        <div className="login-card">
          <div className="orange-line" />
          <Suspense fallback={null}>
            <LoginSignupForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
