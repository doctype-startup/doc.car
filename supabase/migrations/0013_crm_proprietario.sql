-- Aba CRM: consulta do dossiê completo de proprietário atual (nome, CPF/CNPJ,
-- veículo) por placa — dado sensível, liberado só depois do despachante
-- reconfirmar o próprio CPF/CNPJ a cada consulta. Rodar no SQL Editor do
-- Supabase.

-- CPF/CNPJ do próprio despachante, cadastrado uma vez, usado pra conferir a
-- reconfirmação exigida antes de cada consulta do CRM. Nunca coletado no
-- cadastro inicial — só quando o despachante entra na aba CRM pela
-- primeira vez.
alter table public.profiles add column if not exists cpf_cnpj text;

-- Uma linha por consulta ao dossiê completo de proprietário — auditoria de
-- quem acessou o quê, quando. Nunca guarda o nome/CPF do proprietário
-- consultado (só a placa, que é dado público do veículo), mesma regra de
-- meus_veiculos_auditoria.
create table if not exists public.crm_proprietario_auditoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  placa text not null,
  origem text not null check (origem in ('cota', 'credito', 'avulso')),
  consultado_em timestamptz not null default now()
);

create index if not exists crm_proprietario_auditoria_user_id_idx
  on public.crm_proprietario_auditoria (user_id, consultado_em desc);

alter table public.crm_proprietario_auditoria enable row level security;

create policy "Usuário vê a própria auditoria do CRM"
  on public.crm_proprietario_auditoria for select
  using (auth.uid() = user_id);

-- Sem policy de insert/update/delete para usuários: só o backend (service
-- role) grava, a partir de app/api/crm/proprietario.
