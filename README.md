# DOC.CAR

SaaS de consulta veicular para despachantes — placa, ficha técnica, FIPE, débitos e restrições em um só lugar. Um produto **DOCTYPE**.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha com suas chaves (veja "Backend" abaixo)
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Estrutura

- `app/login` — login e cadastro de despachante (Supabase Auth)
- `app/forgot-password` — recuperação de senha
- `app/assinar` — página de assinatura (Stripe Checkout); usuário sem assinatura ativa é redirecionado para cá
- `app/dashboard` — consulta de veículo por placa, com ficha técnica, FIPE, débitos e restrições (protegido: exige login + assinatura ativa)
- `app/dashboard/historico` — histórico de placas consultadas, salvo no banco
- `app/api/checkout` — cria a sessão de Stripe Checkout para o usuário logado
- `app/api/stripe/webhook` — recebe eventos do Stripe e atualiza a assinatura no banco
- `lib/vehicle.ts` — camada de dados da consulta veicular (**ainda mock**, determinística por placa — é o próximo passo trocar por uma API real de FIPE/Detran)
- `lib/supabase/` — clients Supabase (browser, server, admin/service-role) e o proxy de sessão
- `lib/stripe.ts` — client Stripe
- `proxy.ts` — protege as rotas de `/dashboard` redirecionando para `/login` sem sessão
- `supabase/migrations/0001_init.sql` — schema do banco (perfis, assinaturas, histórico)

## Backend (Supabase + Stripe)

O app precisa de duas contas externas configuradas antes de funcionar de verdade:

### 1. Supabase (login, banco de dados)

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor** e rode o conteúdo de `supabase/migrations/0001_init.sql`.
3. Em **Authentication > Providers**, confirme que "Email" está habilitado. Em **Authentication > Emails**, decida se exige confirmação de e-mail (recomendado em produção).
4. Em **Project Settings > API Keys**, copie:
   - a URL do projeto (visão geral do projeto, formato `https://xxxx.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_...`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Secret key** (`sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY` (secreta — só no servidor)

   (Em projetos Supabase mais antigos essas chaves aparecem como `anon public` / `service_role` — funcionam da mesma forma, só o nome muda.)

   Depois de adicionar/alterar variáveis na Vercel, é preciso fazer um **novo deploy** para elas passarem a valer — variáveis de ambiente não afetam deploys já publicados.

### 2. Stripe (cobrança)

1. Crie um produto e um preço recorrente (ex: mensal) em **Product catalog**. Copie o `price_...` → `STRIPE_PRICE_ID`.
2. Em **Developers > API keys**, copie a `Secret key` → `STRIPE_SECRET_KEY`.
3. Em **Developers > Webhooks**, adicione um endpoint apontando para `https://SEU-DOMINIO/api/stripe/webhook`, escutando pelo menos: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copie o `Signing secret` → `STRIPE_WEBHOOK_SECRET`.

### 3. Configurar na Vercel

Em **Project Settings > Environment Variables** do projeto `doc-car-app`, adicione as 6 variáveis acima (Production e Preview) e faça um novo deploy.

Sem essas variáveis configuradas, o app sobe normalmente mas login/cadastro e a página de assinatura mostram erro — é esperado até a configuração ser concluída.

A autenticação e a assinatura já usam esse backend real; a consulta veicular em si (`lib/vehicle.ts`) segue com dados simulados até integrarmos um provedor de dados de veículos.

## Deploy

O projeto está conectado à Vercel via este repositório GitHub: todo push no branch `main` gera um deploy automático. Não é necessário publicar manualmente — basta abrir um PR, revisar e fazer merge em `main`.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Supabase](https://supabase.com) — autenticação e Postgres
- [Stripe](https://stripe.com) — assinatura recorrente
- Sem dependências externas de UI (CSS puro em `app/globals.css`)
- `npm run lint` (ESLint) e `npm run build` rodam automaticamente em cada PR via GitHub Actions (`.github/workflows/ci.yml`)
