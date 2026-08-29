import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";
import NavTabs from "./nav-tabs";
import GuardiaoHelper from "@/components/GuardiaoHelper";
import { getPlanoPorPriceId } from "@/lib/plans";
import { contarUsoNoPeriodo } from "@/lib/uso-avancada";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, email, is_admin")
    .eq("id", user.id)
    .single();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, price_id, current_period_start")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasActiveAccess =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!hasActiveAccess) {
    redirect("/assinar");
  }

  const plano = getPlanoPorPriceId(subscription?.price_id);
  const inicioDoPeriodo =
    subscription?.current_period_start ||
    (() => {
      const inicioDoMes = new Date();
      inicioDoMes.setDate(1);
      inicioDoMes.setHours(0, 0, 0, 0);
      return inicioDoMes.toISOString();
    })();
  const usoNoPeriodo = plano
    ? await contarUsoNoPeriodo(supabase, user.id, inicioDoPeriodo)
    : 0;

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-left">
          <div className="brand">
            DOC<span>.CAR</span>
          </div>
        </div>
        <NavTabs isAdmin={Boolean(profile?.is_admin)} />
        <div className="topbar-right">
          {plano && (
            <span
              className={`badge ${usoNoPeriodo >= plano.cota ? "warn" : "neutral"}`}
              title="Consultas avançadas usadas neste período"
            >
              Saldo: {usoNoPeriodo}/{plano.cota}
            </span>
          )}
          <span className="topbar-user">
            {profile?.name ?? profile?.email ?? user.email} · Responsável
          </span>
          <SignOutButton />
        </div>
      </header>
      <div className="orange-line" />
      <main className="app-content">{children}</main>
      <GuardiaoHelper />
    </div>
  );
}
