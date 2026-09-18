"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConsultasAvulsasMenu from "./consultas-avulsas-menu";

const TABS = [
  { href: "/dashboard", label: "Consultar placa" },
  { href: "/dashboard/historico", label: "Histórico" },
  { href: "/dashboard/creditos", label: "Créditos" },
  { href: "/dashboard/meus-veiculos", label: "Meus Veículos" },
  { href: "/dashboard/documentos", label: "Documentos" },
  { href: "/dashboard/logistica", label: "Logística" },
  { href: "/dashboard/crm", label: "Histórico de Proprietário" },
];

export default function NavTabs({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="topbar-nav">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={pathname === tab.href ? "active" : ""}
        >
          {tab.label}
        </Link>
      ))}
      <ConsultasAvulsasMenu />
      {isAdmin && <Link href="/admin">Admin</Link>}
    </nav>
  );
}
