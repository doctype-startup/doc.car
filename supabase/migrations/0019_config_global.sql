-- Configuração global do app (uma linha só, id sempre true) — hoje só
-- guarda se a consulta simples deve ser cobrada avulsa mesmo dentro da
-- cota do plano (decisão de negócio, ligada/desligada pelo super admin).
-- Rodar no SQL Editor do Supabase.

create table if not exists public.config_global (
  id boolean primary key default true,
  cobrar_consulta_simples boolean not null default false,
  constraint config_global_singleton check (id)
);

insert into public.config_global (id, cobrar_consulta_simples)
values (true, false)
on conflict (id) do nothing;

alter table public.config_global enable row level security;

-- Qualquer despachante autenticado pode LER (não tem nada sensível aqui,
-- só um booleano de regra de cobrança) — só o admin (service role) grava.
create policy "autenticado le config_global"
  on public.config_global for select
  to authenticated
  using (true);
