-- "Consultas Avulsas" — menu de serviços novos (API Brasil, categoria
-- Segurança Veicular), cada um com preço próprio, pagos com saldo
-- pré-pago em dinheiro (sem validade, diferente dos créditos de consulta
-- simples/avançada em lib/creditos.ts, que contam unidades com validade
-- de 6 meses — aqui cada serviço custa um valor diferente). Rodar no SQL
-- Editor do Supabase.

create table if not exists public.saldo_avulsas (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  saldo_centavos integer not null default 0,
  atualizado_em timestamptz not null default now()
);

alter table public.saldo_avulsas enable row level security;

create policy "Usuário vê o próprio saldo de consultas avulsas"
  on public.saldo_avulsas for select
  using (auth.uid() = user_id);

-- Sem policy de insert/update pro usuário: só as funções abaixo (security
-- definer) mexem no saldo, chamadas pelo backend depois de confirmar
-- pagamento ou consumo.

-- Uma linha por recarga paga — usada pra idempotência (o unique em
-- stripe_checkout_session_id impede que um reenvio do webhook do Stripe
-- credite o mesmo pagamento duas vezes) e pra listar o histórico.
create table if not exists public.recargas_avulsas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  valor_centavos integer not null,
  stripe_checkout_session_id text not null unique,
  criado_em timestamptz not null default now()
);

create index if not exists recargas_avulsas_user_id_idx
  on public.recargas_avulsas (user_id, criado_em desc);

alter table public.recargas_avulsas enable row level security;

create policy "Usuário vê as próprias recargas de consultas avulsas"
  on public.recargas_avulsas for select
  using (auth.uid() = user_id);

-- Uma linha por consulta avulsa feita — auditoria de uso, mesmo padrão de
-- crm_proprietario_auditoria (nunca guarda o dado retornado pela API, só o
-- parâmetro consultado e quanto custou).
create table if not exists public.consultas_avulsas_uso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  servico_id text not null,
  parametro text not null,
  preco_centavos integer not null,
  consultado_em timestamptz not null default now()
);

create index if not exists consultas_avulsas_uso_user_id_idx
  on public.consultas_avulsas_uso (user_id, consultado_em desc);

alter table public.consultas_avulsas_uso enable row level security;

create policy "Usuário vê a própria auditoria de consultas avulsas"
  on public.consultas_avulsas_uso for select
  using (auth.uid() = user_id);

-- Incrementa o saldo de forma atômica — usada tanto pra creditar uma
-- recarga paga quanto pra estornar uma consulta que falhou.
create or replace function public.creditar_saldo_avulsas(p_user_id uuid, p_valor_centavos integer)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.saldo_avulsas (user_id, saldo_centavos)
  values (p_user_id, p_valor_centavos)
  on conflict (user_id) do update
    set saldo_centavos = saldo_avulsas.saldo_centavos + excluded.saldo_centavos,
        atualizado_em = now();
end;
$$;

-- Debita o saldo de forma atômica, só se houver saldo suficiente — a
-- condição no WHERE roda dentro do mesmo lock de linha do UPDATE, então
-- duas consultas simultâneas nunca gastam o mesmo saldo. Retorna true se
-- debitou de verdade.
create or replace function public.debitar_saldo_avulsas(p_user_id uuid, p_valor_centavos integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  linhas_afetadas integer;
begin
  update public.saldo_avulsas
    set saldo_centavos = saldo_centavos - p_valor_centavos,
        atualizado_em = now()
    where user_id = p_user_id and saldo_centavos >= p_valor_centavos;

  get diagnostics linhas_afetadas = row_count;
  return linhas_afetadas > 0;
end;
$$;
