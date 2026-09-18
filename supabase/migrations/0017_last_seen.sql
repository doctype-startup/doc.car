-- Rastreia a última vez que o despachante usou o app, pra mostrar
-- "Online" e "Último acesso" no painel do admin. Atualizado a cada
-- carregamento do dashboard (app/dashboard/layout.tsx). Rodar no SQL
-- Editor do Supabase.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;
