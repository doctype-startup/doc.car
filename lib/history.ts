import { createClient } from "@/lib/supabase/client";

export type HistoryItem = {
  placa: string;
  consultadoEm: string;
};

export async function getHistory(): Promise<HistoryItem[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("search_history")
    .select("placa, consultado_em")
    .eq("user_id", user.id)
    .order("consultado_em", { ascending: false })
    .limit(20);

  return (data || []).map((row) => ({
    placa: row.placa,
    consultadoEm: new Date(row.consultado_em).toLocaleString("pt-BR"),
  }));
}

export async function addHistory(placa: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("search_history").insert({ user_id: user.id, placa });
}
