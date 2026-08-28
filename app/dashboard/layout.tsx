import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "./sign-out-button";

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
      <aside className="app-sidebar">
        <div className="brand">
          DOC<span>.CAR</span>
        </div>
        <nav>
          <Link href="/dashboard" className="active">
            Consulta veicular
          </Link>
          <Link href="/dashboard/historico">Histórico</Link>
          <SignOutButton />
        </nav>
        <div className="sidebar-footer">
          {profile?.name}
          <br />
          {profile?.email ?? user.email}
        </div>
      </aside>
      <main className="app-main">{children}</main>
    </div>
  );
}
