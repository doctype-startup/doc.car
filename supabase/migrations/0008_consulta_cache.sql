-- Cache da última ficha real puxada por placa, por despachante — clicar
-- numa placa do histórico/últimas consultas reaproveita esse dado em vez
-- de consultar o provedor de novo, sem gastar cota nem crédito. Some
-- quando o despachante limpa o histórico (mesma ação, mesmo botão).
-- Rodar no SQL Editor do Supabase.

create table if not exists public.consulta_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  placa text not null,
  veiculo_data jsonb not null,
  avancada_data jsonb,
  atualizado_em timestamptz not null default now()
);

create unique index if not exists consulta_cache_user_placa_key
  on public.consulta_cache (user_id, placa);

alter table public.consulta_cache enable row level security;

create policy "Despachante vê o próprio cache de consulta"
  on public.consulta_cache for select
  using (auth.uid() = user_id);

create policy "Despachante limpa o próprio cache de consulta"
  on public.consulta_cache for delete
  using (auth.uid() = user_id);

-- Sem policy de insert/update pro usuário: só o backend (service role)
-- grava o cache, logo depois de uma consulta real bem-sucedida — evita
-- que o despachante forje um cache pra "ver de graça" um dado que nunca
-- consultou de verdade.
