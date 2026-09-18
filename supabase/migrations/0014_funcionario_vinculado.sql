-- Vínculo de funcionário a um despachante já cadastrado — usado na aba
-- "Cadastro e Autorizações" do admin pra autorizar manualmente o acesso de
-- um funcionário de um assinante ativo. O funcionário ganha login e cota
-- independentes (mesmo esquema de "Criar acesso de teste"); esse campo só
-- registra a quem ele está vinculado, pra fins de organização no admin.
-- Rodar no SQL Editor do Supabase.

alter table public.profiles
  add column if not exists vinculado_a_id uuid references public.profiles (id) on delete set null;

create index if not exists profiles_vinculado_a_id_idx on public.profiles (vinculado_a_id);
