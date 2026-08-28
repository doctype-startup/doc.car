-- DOC.CAR — schema inicial (perfis, assinaturas, histórico de consultas)
-- Rodar no SQL Editor do Supabase (Project > SQL Editor > New query).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Usuário vê o próprio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Usuário atualiza o próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Cria o perfil automaticamente quando um despachante se cadastra.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete'
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  status public.subscription_status not null default 'incomplete',
  price_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_user_id_key on public.subscriptions (user_id);

alter table public.subscriptions enable row level security;

create policy "Usuário vê a própria assinatura"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Sem policy de insert/update para usuários: só o backend (service role,
-- que ignora RLS) grava assinaturas, a partir do webhook do Stripe.

create table if not exists public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  placa text not null,
  consultado_em timestamptz not null default now()
);

create index if not exists search_history_user_id_idx on public.search_history (user_id, consultado_em desc);

alter table public.search_history enable row level security;

create policy "Usuário vê o próprio histórico"
  on public.search_history for select
  using (auth.uid() = user_id);

create policy "Usuário insere no próprio histórico"
  on public.search_history for insert
  with check (auth.uid() = user_id);
