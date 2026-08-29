-- Suporte a planos com cota de consultas avançadas + cobrança avulsa do
-- excedente. Rodar no SQL Editor do Supabase.

-- Precisamos do início do período de cobrança pra contar o uso "deste mês"
-- (current_period_end já existia; current_period_start é novo).
alter table public.subscriptions
  add column if not exists current_period_start timestamptz;

-- Um registro por consulta avançada realizada, pra contar contra a cota do
-- plano e saber quais foram cobradas como avulso (fora da cota).
create table if not exists public.avancada_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  placa text not null,
  consultado_em timestamptz not null default now(),
  cobrada_avulsa boolean not null default false
);

create index if not exists avancada_usage_user_id_idx
  on public.avancada_usage (user_id, consultado_em desc);

alter table public.avancada_usage enable row level security;

create policy "Usuário vê o próprio uso de consulta avançada"
  on public.avancada_usage for select
  using (auth.uid() = user_id);

-- Sem policy de insert/update/delete para usuários: só o backend (service
-- role, que ignora RLS) grava uso, a partir da rota /api/consulta-avancada —
-- evita que alguém manipule o próprio saldo direto pelo client.
