-- Cota de consultas simples por plano + cobrança avulsa do excedente
-- (mesmo modelo já usado pra consulta avançada) e pacotes de recarga de
-- créditos pré-pagos. Rodar no SQL Editor do Supabase.

-- Um registro por consulta simples realizada, pra contar contra a cota do
-- plano e saber a origem de cada uma: dentro da cota, coberta por crédito
-- de recarga, ou cobrada avulsa (fora da cota e sem crédito disponível).
create table if not exists public.simples_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  placa text not null,
  consultado_em timestamptz not null default now(),
  origem text not null default 'cota' check (origem in ('cota', 'credito', 'avulso'))
);

create index if not exists simples_usage_user_id_idx
  on public.simples_usage (user_id, consultado_em desc);

alter table public.simples_usage enable row level security;

create policy "Usuário vê o próprio uso de consulta simples"
  on public.simples_usage for select
  using (auth.uid() = user_id);

-- Sem policy de insert/update/delete para usuários: só o backend (service
-- role) grava uso, a partir da rota /api/veiculo — evita manipulação do
-- próprio saldo direto pelo client.

-- Uma linha por pacote de recarga comprado. creditos_restantes é
-- decrementado consulta a consulta (a mais próxima de expirar primeiro);
-- expira 6 meses após a compra, ou é zerada na hora se a assinatura for
-- cancelada.
create table if not exists public.recargas_simples (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pacote_id text not null,
  creditos_totais integer not null,
  creditos_restantes integer not null,
  comprado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  stripe_checkout_session_id text unique
);

create index if not exists recargas_simples_user_id_idx
  on public.recargas_simples (user_id, expira_em);

alter table public.recargas_simples enable row level security;

create policy "Usuário vê as próprias recargas"
  on public.recargas_simples for select
  using (auth.uid() = user_id);

-- Sem policy de insert/update para usuários: só o backend grava recargas,
-- a partir do webhook do Stripe (checkout.session.completed) e zera saldo
-- no cancelamento da assinatura.
