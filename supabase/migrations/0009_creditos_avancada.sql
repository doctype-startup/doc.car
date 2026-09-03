-- Pacotes de recarga (créditos pré-pagos) pra consulta avançada, no mesmo
-- modelo já usado pra consulta simples (0006_creditos_simples.sql). Rodar
-- no SQL Editor do Supabase.

-- Distingue a origem de cada consulta avançada, igual já existe pra
-- simples (simples_usage.origem) — antes só existia cobrada_avulsa
-- (boolean), que continua sendo gravada por compatibilidade.
alter table public.avancada_usage
  add column if not exists origem text not null default 'cota'
  check (origem in ('cota', 'credito', 'avulso'));

-- Uma linha por pacote de recarga de consulta avançada comprado —
-- estrutura idêntica a recargas_simples.
create table if not exists public.recargas_avancada (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  pacote_id text not null,
  creditos_totais integer not null,
  creditos_restantes integer not null,
  comprado_em timestamptz not null default now(),
  expira_em timestamptz not null,
  stripe_checkout_session_id text unique
);

create index if not exists recargas_avancada_user_id_idx
  on public.recargas_avancada (user_id, expira_em);

alter table public.recargas_avancada enable row level security;

create policy "Usuário vê as próprias recargas de consulta avançada"
  on public.recargas_avancada for select
  using (auth.uid() = user_id);

-- Sem policy de insert/update para usuários: só o backend grava recargas,
-- a partir do webhook do Stripe (checkout.session.completed) e zera saldo
-- no cancelamento da assinatura — mesma regra de recargas_simples.
