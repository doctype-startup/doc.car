"use client";

export default function WhatsappAcessoButton({
  nome,
  email,
}: {
  nome: string;
  email: string;
}) {
  function enviar() {
    const origin = window.location.origin;
    const link = `${origin}/login?email=${encodeURIComponent(email)}`;
    const mensagem = `Olá, ${nome}! Seu acesso ao DOC.CAR está liberado. Entre em ${link} com o e-mail ${email}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(mensagem)}`, "_blank", "noopener,noreferrer");
  }

  return (
    <button type="button" className="secondary-button" style={{ fontSize: 12 }} onClick={enviar}>
      Enviar acesso via WhatsApp
    </button>
  );
}
