/** Nome do cookie que guarda a sessão original do admin enquanto ele está
 * "vendo como" um despachante (ver app/admin/actions.ts → entrarComoUsuario
 * e app/dashboard/parar-impersonar-action.ts → pararImpersonar). Fica num
 * cookie httpOnly separado dos cookies de sessão do Supabase (que nesse
 * meio tempo passam a guardar a sessão do despachante). */
export const IMPERSONADOR_COOKIE = "doc_car_impersonador";

export type ImpersonadorPayload = {
  accessToken: string;
  refreshToken: string;
};
