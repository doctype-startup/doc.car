"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { IMPERSONADOR_COOKIE, type ImpersonadorPayload } from "@/lib/impersonar";

/** Volta da sessão do despachante pra sessão original do admin, restaurando
 * os tokens salvos por entrarComoUsuario (app/admin/actions.ts) quando o
 * "modo suporte" começou. Limpa o cookie de qualquer jeito, mesmo se a
 * restauração falhar (sessão do admin expirada etc.) — nesse caso o admin
 * só precisa logar de novo, não fica preso impersonando. */
export async function pararImpersonar() {
  const cookieStore = await cookies();
  const bruto = cookieStore.get(IMPERSONADOR_COOKIE)?.value;
  cookieStore.delete(IMPERSONADOR_COOKIE);

  if (!bruto) {
    redirect("/admin");
  }

  // redirect() lança internamente pra interromper a renderização — nunca
  // chamar ela de dentro do try/catch abaixo, senão esse catch acaba
  // engolindo o próprio redirect.
  let restaurou = false;
  try {
    const payload: ImpersonadorPayload = JSON.parse(bruto);
    const supabase = await createClient();
    const { error } = await supabase.auth.setSession({
      access_token: payload.accessToken,
      refresh_token: payload.refreshToken,
    });
    restaurou = !error;
    if (error) {
      console.error(`[parar-impersonar] falha ao restaurar sessão do admin: ${error.message}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "erro desconhecido";
    console.error(`[parar-impersonar] falha ao ler cookie: ${message}`);
  }

  redirect(restaurou ? "/admin" : "/login");
}
