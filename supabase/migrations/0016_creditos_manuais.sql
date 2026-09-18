-- Marca créditos concedidos manualmente pelo admin (sem cobrança) como
-- "bônus" ou não, nas três carteiras de crédito existentes. Rodar no SQL
-- Editor do Supabase.

alter table public.recargas_simples
  add column if not exists bonus boolean not null default false;

alter table public.recargas_avancada
  add column if not exists bonus boolean not null default false;

alter table public.recargas_avulsas
  add column if not exists bonus boolean not null default false;
