-- Esconde a tabela de preços dos planos na tela de login/cadastro pro
-- link de acesso personalizado (/login?email=...) de um despachante
-- específico — útil pra quem paga direto com a DOCTYPE (valor negociado,
-- fora do preço público dos planos). Ligado manualmente pelo admin na
-- página "Ver conta" (/admin/usuario/[id]). Rodar no SQL Editor do
-- Supabase.

alter table public.profiles
  add column if not exists ocultar_precos_login boolean not null default false;
