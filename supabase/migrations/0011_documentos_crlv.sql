-- Emissão avulsa de CRLV-e por placa (R$65,00 via Stripe Checkout), usando
-- a API Brasil — recurso separado da consulta de dados do veículo (outro
-- provedor). Rodar no SQL Editor do Supabase.

create table if not exists public.documentos_crlv (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  placa text not null,
  uf text not null,
  status text not null check (status in ('emitido', 'erro')),
  -- Caminho no bucket "crlv-pdfs" (criado em 0007_meus_veiculos.sql), pasta
  -- ${user_id}/emissoes/${id}.pdf — reaproveita o mesmo bucket privado e a
  -- mesma policy de RLS por pasta de usuário, sem precisar de bucket novo.
  pdf_storage_path text,
  erro_mensagem text,
  stripe_checkout_session_id text unique,
  criado_em timestamptz not null default now()
);

create index if not exists documentos_crlv_user_id_idx
  on public.documentos_crlv (user_id, criado_em desc);

alter table public.documentos_crlv enable row level security;

create policy "Usuário vê os próprios documentos emitidos"
  on public.documentos_crlv for select
  using (auth.uid() = user_id);

-- Sem policy de insert/update para usuários: só o backend grava, a partir
-- do webhook do Stripe (checkout.session.completed) — mesma regra de
-- recargas_simples/recargas_avancada.
