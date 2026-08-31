-- "Meus Veículos" — cofre pessoal de veículos por despachante: cadastro
-- manual ou importação do JSON obtido na própria sessão SENATRAN do
-- despachante, com o CRLV em PDF. Cada despachante só vê e gerencia os
-- próprios registros (RLS por user_id) — nunca dado de outro despachante.
-- Rodar no SQL Editor do Supabase.

create table if not exists public.meus_veiculos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  placa text not null,
  renavam text,
  chassi text,
  marca_modelo text,
  ano_fabricacao integer,
  ano_modelo integer,
  cor text,
  exercicio integer,
  categoria text,
  combustivel text,
  especie text,
  tipo_veiculo text,
  municipio_emplacamento text,
  uf_jurisdicao text,
  cilindradas text,
  lotacao text,
  situacao text,
  procedencia text,
  data_emissao_crv text,
  proprietario_nome text,
  proprietario_documento text,
  proprietario_tipo text,
  indicadores jsonb not null default '{}'::jsonb,
  restricoes jsonb not null default '[]'::jsonb,
  crlv_storage_path text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Um despachante não pode ter dois registros pra mesma placa — reimportar
-- ou recadastrar atualiza o existente (upsert).
create unique index if not exists meus_veiculos_user_placa_key
  on public.meus_veiculos (user_id, placa);

alter table public.meus_veiculos enable row level security;

create policy "Despachante gerencia os próprios veículos"
  on public.meus_veiculos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auditoria sem dado sensível: usuário, ação, veículo por id interno,
-- data/hora e resultado — nunca nome, CPF/CNPJ, RENAVAM ou chassi.
create table if not exists public.meus_veiculos_auditoria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  veiculo_id uuid references public.meus_veiculos (id) on delete set null,
  acao text not null check (
    acao in ('cadastro', 'importacao_senatran', 'visualizacao', 'download_crlv', 'exclusao')
  ),
  resultado text not null check (resultado in ('sucesso', 'erro')),
  criado_em timestamptz not null default now()
);

create index if not exists meus_veiculos_auditoria_user_id_idx
  on public.meus_veiculos_auditoria (user_id, criado_em desc);

alter table public.meus_veiculos_auditoria enable row level security;

create policy "Despachante vê a própria auditoria"
  on public.meus_veiculos_auditoria for select
  using (auth.uid() = user_id);

create policy "Despachante registra a própria auditoria"
  on public.meus_veiculos_auditoria for insert
  with check (auth.uid() = user_id);

-- Bucket privado pro PDF do CRLV — nunca público, só acessível pelo
-- despachante dono do arquivo (pasta com o próprio user_id) ou pelo
-- backend (service role, que ignora as policies abaixo).
insert into storage.buckets (id, name, public)
values ('crlv-pdfs', 'crlv-pdfs', false)
on conflict (id) do nothing;

create policy "Despachante gerencia os próprios PDFs de CRLV"
  on storage.objects for all
  using (bucket_id = 'crlv-pdfs' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'crlv-pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
