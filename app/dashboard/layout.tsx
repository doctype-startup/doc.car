import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";
import NavTabs from "./nav-tabs";
import GuardiaoHelper from "@/components/GuardiaoHelper";
import { GuardiaoProvider } from "@/components/guardiao-context";
import { getPlanoPorPriceId } from "@/lib/plans";
import { contarUsoNoPeriodo } from "@/lib/uso-avancada";
import { IMPERSONADOR_COOKIE } from "@/lib/impersonar";
import { pararImpersonar } from "./parar-impersonar-action";
import { diasAteVencimento, formatarDiaVencimento } from "@/lib/vencimento";

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
    .select("name, email, is_admin, created_at")
    .eq("id", user.id)
    .single();

  const impersonando = Boolean((await cookies()).get(IMPERSONADOR_COOKIE)?.value);
  const diasAteVenc = profile?.created_at ? diasAteVencimento(profile.created_at) : null;
  const mostrarAvisoVencimento = diasAteVenc !== null && diasAteVenc >= 0 && diasAteVenc <= 3;

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

  // Marca a atividade do despachante — usado pelo painel do admin pra
  // mostrar "Online" (visto nos últimos minutos) e "Último acesso". Não
  // bloqueia a navegação se falhar.
  void supabase
    .from("profiles")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", user.id)
    .then(({ error }) => {
      if (error) console.error(`[dashboard-layout] falha ao marcar last_seen_at: ${error.message}`);
    });

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
    <GuardiaoProvider>
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
        {impersonando && (
          <div className="conta-aviso impersonando">
            <span>
              Modo suporte: você está vendo como <strong>{profile?.name ?? profile?.email}</strong>.
            </span>
            <form action={pararImpersonar}>
              <button type="submit">Parar e voltar ao admin</button>
            </form>
          </div>
        )}
        {mostrarAvisoVencimento && profile?.created_at && (
          <div className="conta-aviso vencimento">
            <span>
              {diasAteVenc === 0
                ? "Seu plano vence hoje"
                : `Seu plano vence em ${diasAteVenc} dia${diasAteVenc === 1 ? "" : "s"}`}{" "}
              ({formatarDiaVencimento(profile.created_at)}).
            </span>
          </div>
        )}
        <main className="app-content">{children}</main>
        <GuardiaoHelper />
      </div>
    </GuardiaoProvider>
  );
}
