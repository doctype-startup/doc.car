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

export async function clearHistory() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("search_history").delete().eq("user_id", user.id);
}

export async function countHistoryHoje(): Promise<number> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const inicioDoDia = new Date();
  inicioDoDia.setHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("search_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("consultado_em", inicioDoDia.toISOString());

  return count ?? 0;
}
