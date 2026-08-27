"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSession, clearSession, Session } from "@/lib/auth";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(
    undefined
  );

  useEffect(() => {
    const current = getSession();
    if (!current) {
      router.replace("/login");
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs from localStorage after mount to avoid a hydration mismatch
    setSession(current);
  }, [router]);

  if (session === undefined) return null;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="brand">
          DOC<span>.CAR</span>
        </div>
        <nav>
          <Link href="/dashboard" className="active">
            Consulta veicular
          </Link>
          <Link href="/dashboard/historico">Histórico</Link>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              clearSession();
              router.replace("/login");
            }}
          >
            Sair
          </a>
        </nav>
        <div className="sidebar-footer">
          {session?.name}
          <br />
          {session?.email}
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
