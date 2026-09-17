-- Tabela de referência (só pra admin) com os preços cobrados pela API Brasil
-- por consulta — não afeta cobrança de despachante nem lógica de negócio,
-- é só uma tabela de custos pra a DOCTYPE acompanhar. Rodar no SQL Editor
-- do Supabase.

create table if not exists public.api_precos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  categoria text not null,
  preco_centavos integer not null,
  atualizado_em timestamptz not null default now()
);

alter table public.api_precos enable row level security;

-- Sem nenhuma policy: só a service role (admin, via createAdminClient())
-- lê e escreve aqui. Nenhum despachante precisa ver isso.

-- Seed inicial, a partir da tabela de preços da API Brasil em 17/09/2026.
insert into public.api_precos (nome, categoria, preco_centavos) values
  ('Documento CRLV AC', 'CRLV', 1600),
  ('Documento CRLV AL', 'CRLV', 6000),
  ('Documento CRLV AP', 'CRLV', 800),
  ('Documento CRLV BA', 'CRLV', 3000),
  ('Documento CRLV CE', 'CRLV', 7980),
  ('Documento CRLV GO', 'CRLV', 800),
  ('Documento CRLV MA', 'CRLV', 800),
  ('Documento CRLV MG', 'CRLV', 800),
  ('Documento CRLV MS', 'CRLV', 1400),
  ('Documento CRLV MT', 'CRLV', 800),
  ('Documento CRLV PA', 'CRLV', 1400),
  ('Documento CRLV PE', 'CRLV', 10000),
  ('Documento CRLV RJ', 'CRLV', 4000),
  ('Documento CRLV RO', 'CRLV', 1000),
  ('Documento CRLV TO', 'CRLV', 800),
  ('API CEP com IBGE', 'Geolocalização e Logística', 4),
  ('Base Estadual V3', 'Precificação Veicular', 1075),
  ('Decodificador Precificador', 'Precificação Veicular', 375),
  ('Decodificados Agregados', 'Precificação Veicular', 525),
  ('Fipe (Beta)', 'Precificação Veicular', 6),
  ('Gravame V2', 'Precificação Veicular', 1175),
  ('Leilão V2', 'Precificação Veicular', 2112),
  ('Placa FIPE (Com Chassi)', 'Precificação Veicular', 10),
  ('Recall V2', 'Precificação Veicular', 375),
  ('Tabela Fipe Crédito', 'Precificação Veicular', 6),
  ('Veículos Total', 'Precificação Veicular', 3000),
  ('API Leilao', 'Segurança Veicular', 1150),
  ('API Recall', 'Segurança Veicular', 62),
  ('Agregados Basica', 'Segurança Veicular', 14),
  ('Agregados Propria', 'Segurança Veicular', 8),
  ('Agregados Renavam', 'Segurança Veicular', 140),
  ('Agregados Renavam V2', 'Segurança Veicular', 280),
  ('Agregados Simples', 'Segurança Veicular', 2),
  ('Agregados V2', 'Segurança Veicular', 60),
  ('Base Estadual', 'Segurança Veicular', 250),
  ('Base Nacional', 'Segurança Veicular', 180),
  ('Base Nacional V2', 'Segurança Veicular', 320),
  ('CSV Completa', 'Segurança Veicular', 400),
  ('CSV V2', 'Segurança Veicular', 545),
  ('Contatos por Placa', 'Segurança Veicular', 389),
  ('Decodificador Chassi', 'Segurança Veicular', 8),
  ('Débitos V4', 'Segurança Veicular', 800),
  ('Emite CRLV-e', 'Segurança Veicular', 2400),
  ('Farol', 'Segurança Veicular', 1100),
  ('Ficha Técnica', 'Segurança Veicular', 298),
  ('Gravame', 'Segurança Veicular', 271),
  ('Histórico de Proprietários', 'Segurança Veicular', 500),
  ('Leilao com Score', 'Segurança Veicular', 1300),
  ('Leilão Sintetico', 'Segurança Veicular', 1840),
  ('Multas (Renainf)', 'Segurança Veicular', 345),
  ('Placa Dados V1', 'Segurança Veicular', 250),
  ('Proprietário Atual', 'Segurança Veicular', 70),
  ('Proprietário Atual V2', 'Segurança Veicular', 675),
  ('Renajud', 'Segurança Veicular', 340),
  ('Roubo e Furto', 'Segurança Veicular', 386),
  ('Roubo e Furto V2', 'Segurança Veicular', 1250)
on conflict (nome) do update set
  categoria = excluded.categoria,
  preco_centavos = excluded.preco_centavos,
  atualizado_em = now();
