import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DOC.CAR — DOCTYPE",
  description: "Consulta veicular para despachantes — DOC.CAR by DOCTYPE.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
