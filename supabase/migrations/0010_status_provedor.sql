-- Status real do provedor de dados veiculares — gravado a partir do
-- resultado de cada consulta de verdade feita por um despachante em
-- /api/veiculo, não por uma checagem sintética à parte. É o que o monitor
-- ao vivo (GuardiaoHelper) exibe. Rodar no SQL Editor do Supabase.

create table if not exists public.provedor_status (
  provedor text primary key,
  online boolean not null,
  atualizado_em timestamptz not null default now(),
  detalhe text
);

alter table public.provedor_status enable row level security;

create policy "Despachante logado lê o status do provedor"
  on public.provedor_status for select
  using (auth.role() = 'authenticated');

-- Sem policy de insert/update para usuários: só o backend (service role,
-- que ignora RLS) grava, a partir do resultado real de cada consulta em
-- app/api/veiculo.
