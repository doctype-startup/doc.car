import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";
import NavTabs from "./nav-tabs";
import GuardiaoHelper from "@/components/GuardiaoHelper";

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
    .select("name, email")
    .eq("id", user.id)
    .single();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  const hasActiveAccess =
    subscription?.status === "active" || subscription?.status === "trialing";

  if (!hasActiveAccess) {
    redirect("/assinar");
  }

  return (
    <div className="app-shell">
      <header className="app-topbar">
        <div className="topbar-left">
          <div className="brand">
            DOC<span>.CAR</span>
          </div>
        </div>
        <NavTabs />
        <div className="topbar-right">
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
