-- Muda "Cobrar consulta simples" de opção global (config_global, migration
-- 0019) pra opção por despachante — decidimos que cada despachante pode
-- ter essa regra diferente, não vale pra todo mundo de uma vez. Rodar no
-- SQL Editor do Supabase.

alter table public.profiles
  add column if not exists cobrar_consulta_simples boolean not null default false;

drop table if exists public.config_global;
