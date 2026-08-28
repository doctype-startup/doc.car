-- Amplia o enum subscription_status para cobrir todos os status que o
-- Stripe pode enviar (o webhook falhava silenciosamente para status fora
-- da lista original). Rodar no SQL Editor do Supabase.

alter type public.subscription_status add value if not exists 'incomplete_expired';
alter type public.subscription_status add value if not exists 'unpaid';
alter type public.subscription_status add value if not exists 'paused';
