"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Consultar placa" },
  { href: "/dashboard/historico", label: "Histórico" },
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
      {isAdmin && <Link href="/admin">Admin</Link>}
    </nav>
  );
}
