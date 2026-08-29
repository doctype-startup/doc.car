-- Painel administrativo (/admin) — flag de administrador no perfil.
-- Rodar no SQL Editor do Supabase.

alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- Depois de rodar esta migration, promova sua própria conta a admin
-- (troque o e-mail abaixo pelo seu):
--   update public.profiles set is_admin = true where email = 'seu-email@exemplo.com';
