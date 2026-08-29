-- Permite que o usuário apague o próprio histórico de consultas (botão
-- "Limpar histórico" em /dashboard/historico). Rodar no SQL Editor do
-- Supabase.

create policy "Usuário apaga o próprio histórico"
  on public.search_history for delete
  using (auth.uid() = user_id);
