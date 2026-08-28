"use client";

import { useState } from "react";

export type GuardiaoPose =
  | "aguardando"
  | "verificando"
  | "aprovacao"
  | "enviado"
  | "sucesso";

const poses: Record<GuardiaoPose, { src: string; alt: string }> = {
  aguardando: {
    src: "/mascote/guardiao-aguardando.png",
    alt: "Guardião DOCTYPE aguardando seu retorno",
  },
  verificando: {
    src: "/mascote/guardiao-verificando.png",
    alt: "Guardião DOCTYPE verificando os dados",
  },
  aprovacao: {
    src: "/mascote/guardiao-aprovacao.png",
    alt: "Guardião DOCTYPE pedindo sua aprovação",
  },
  enviado: {
    src: "/mascote/guardiao-enviado.png",
    alt: "Guardião DOCTYPE confirmando envio",
  },
  sucesso: {
    src: "/mascote/guardiao-sucesso.png",
    alt: "Guardião DOCTYPE comemorando",
  },
};

/**
 * Mascote "Guardião" — monitor oficial dos produtos DOCTYPE.
 * Some poses aren't shipped as image assets yet; hides itself instead of
 * showing a broken image while `public/mascote/` is filled in.
 */
export default function Guardiao({
  pose,
  size = 96,
  className,
}: {
  pose: GuardiaoPose;
  size?: number;
  className?: string;
}) {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  const { src, alt } = poses[pose];

  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={`guardiao${className ? ` ${className}` : ""}`}
      onError={() => setHidden(true)}
    />
  );
}
