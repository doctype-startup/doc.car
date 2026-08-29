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
- `app/api/veiculo` — consulta dados reais de veículo por placa (exige login + assinatura ativa)
- `app/api/consulta-avancada` — consulta avançada real de multas/roubo-furto/Renajud, sob demanda (exige login + assinatura ativa)
- `lib/vehicle.ts` — camada de dados **mock** (débitos — ainda simulado, exibido junto com o dado real)
- `lib/dados-veiculo.ts` — client do provedor de dados veiculares ativo (veja "Dados reais de veículo" abaixo)
- `lib/dados-avancados.ts` — client do provedor de consulta avançada (veja "Consulta avançada" abaixo)
- `lib/infosimples.ts` — client da Infosimples, hoje **não usado** (endpoint de veículo não autorizado na conta atual); mantido caso a consulta de multas ANTT/SIFAMA seja retomada
- `lib/supabase/` — clients Supabase (browser, server, admin/service-role) e o proxy de sessão
- `lib/stripe.ts` — client Stripe
- `proxy.ts` — protege as rotas de `/dashboard` redirecionando para `/login` sem sessão
- `supabase/migrations/0001_init.sql` — schema do banco (perfis, assinaturas, histórico)
- `components/Guardiao.tsx` — mascote oficial DOCTYPE, usado nos momentos de espera/aprovação/confirmação do app
- `public/mascote/` — imagens do Guardião (veja "Identidade visual" abaixo)

## Identidade visual (DOCTYPE)

O app segue o manual de marca DOCTYPE: laranja `#FF6400` como cor de ação, navy `#06133F` como base institucional, texto em `#101419`, fundo neutro `#F7F8FA` e cinza de apoio `#8A93A2`. Títulos usam Montserrat e o corpo de texto usa Inter (carregadas via `next/font/google` em `app/layout.tsx`), sem dependência externa de CSS.

O mascote **Guardião** — o "monitor" de todos os produtos DOCTYPE — aparece nos momentos-chave da jornada (tela de login, aguardando a primeira consulta, durante a verificação da placa, pedindo aprovação da assinatura, confirmando envio de e-mail). O componente `components/Guardiao.tsx` referencia os arquivos em `public/mascote/`:

- `guardiao-aguardando.png` — login e estados vazios ("aguardamos seu retorno")
- `guardiao-verificando.png` — carregando o resultado de uma consulta
- `guardiao-aprovacao.png` — página de assinatura
- `guardiao-enviado.png` — confirmações de e-mail (cadastro, recuperação de senha)
- `guardiao-sucesso.png` — reservado para estados de sucesso

Esses arquivos ainda não estão no repositório — o componente se esconde automaticamente (sem quebrar o layout) quando a imagem correspondente não existe. Basta adicionar os PNGs com esses nomes em `public/mascote/` para o mascote aparecer.

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

5. **SMTP próprio (obrigatório para suportar múltiplos cadastros).** Por padrão o Supabase manda os e-mails de confirmação/recuperação de senha pelo servidor deles, compartilhado entre todos os projetos gratuitos — o limite é de poucos e-mails por hora, e estoura rápido (erro `email rate limit exceeded`). Pra suportar dezenas de despachantes se cadastrando, configure um SMTP próprio:

   1. Crie uma conta em [resend.com](https://resend.com) (grátis até 3.000 e-mails/mês, 100/dia — dá folga pra dezenas de usuários).
   2. Em **Domains**, adicione e verifique um domínio seu (adicionar os registros DNS que o Resend pedir). Sem isso o envio fica restrito.
   3. Em **API Keys**, crie uma chave — ela funciona como a senha do SMTP.
   4. No Supabase, vá em **Authentication > Emails > SMTP Settings**, habilite "Enable Custom SMTP" e preencha:
      - Host: `smtp.resend.com`
      - Port: `465`
      - Username: `resend`
      - Password: a API key criada no passo 3
      - Sender email: um endereço do domínio verificado (ex: `contato@seudominio.com.br`)
      - Sender name: `DOC.CAR`
   5. Salve. Com SMTP próprio configurado, o Supabase também libera aumentar os limites de envio em **Authentication > Rate Limits**.

### 2. Stripe (cobrança)

1. Crie um produto e um preço recorrente (ex: mensal) em **Product catalog**. Copie o `price_...` → `STRIPE_PRICE_ID`.
2. Em **Developers > API keys**, copie a `Secret key` → `STRIPE_SECRET_KEY`.
3. Em **Developers > Webhooks**, crie um novo destino de evento (não reaproveite um endpoint de outro projeto) apontando para `https://SEU-DOMINIO/api/stripe/webhook`, escutando apenas: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copie o `Signing secret` → `STRIPE_WEBHOOK_SECRET`.

   Se sua conta usa **Sandboxes** (contas Stripe novas), confirme que o produto, a chave e o webhook estão todos dentro do mesmo sandbox — cada sandbox tem chaves e webhooks isolados.

### 3. Dados reais de veículo

1. Copie o token fornecido pelo provedor da consulta por placa → `PLACA_API_TOKEN`.
2. `lib/dados-veiculo.ts` chama esse provedor e devolve ficha do veículo (placa, chassi, Renavam, marca/modelo, ano, cor, combustível, FIPE, restrições, indicadores de roubo/furto/multa) e o nome do proprietário atual.
3. **Importante — dados pessoais**: o provedor retorna, junto da ficha do veículo, um dossiê pessoal completo do proprietário (CPF, nome da mãe, data de nascimento, endereço, telefone, e-mail e dados de birô de crédito). `sanitizeVeiculo()` em `lib/dados-veiculo.ts` descarta tudo isso — só o **nome** do proprietário atual chega a sair da função. Isso é proposital: um despachante tem necessidade legítima de saber quem é o dono do veículo, mas não de acessar o dossiê pessoal completo dele (LGPD — minimização de dados). **Não amplie esse retorno sem revisar as implicações de LGPD antes.**
4. Débitos (IPVA, licenciamento) **continuam simulados** — não fazem parte do retorno de nenhum dos dois provedores.
5. `lib/infosimples.ts` fica sem uso por enquanto (endpoint de veículo não autorizado na conta atual) — mantido só caso a consulta de multas ANTT/SIFAMA seja retomada.

### 4. Consulta avançada (multas, roubo/furto, Renajud)

1. Copie o token de um segundo provedor, cobrado por consulta (à parte do provedor acima) → `PLACA_DEBITOS_API_TOKEN`.
2. `lib/dados-avancados.ts` chama esse provedor sob demanda — só quando o despachante clica no botão "Consultar multas, roubo/furto e Renajud reais" na ficha, nunca automaticamente numa consulta normal, já que cada chamada tem custo. Devolve: total de multas em aberto, valor total, pontos, ocorrência de roubo/furto (tipo, data, município) e se há restrição judicial ativa no Renajud.
3. **Dados pessoais**: o provedor devolve, junto da ficha, nome e documento (CPF/CNPJ) do proprietário. `sanitizeAvancada()` em `lib/dados-avancados.ts` descarta o nome e o CPF por completo — segue a mesma regra do provedor principal (item 3 acima). Só o **CNPJ** sai da função, e só quando o documento tem 14 dígitos (pessoa jurídica); documento de 11 dígitos (CPF de pessoa física) nunca é exposto.
4. A lista de multas e o array do Renajud vêm vazios nos testes feitos até agora — por isso a ficha mostra só totais/contagens (não itens individuais). Antes de exibir os itens em si, é preciso confirmar com uma amostra real quais campos cada item traz, pra garantir que nenhum deles carregue dado pessoal (ex: nome do infrator).

### 5. Configurar na Vercel

Em **Project Settings > Environment Variables** do projeto `doc-car-app`, adicione as 8 variáveis acima. Depois de salvar, é preciso um **novo deploy** (as variáveis não afetam deploys já publicados) — basta mesclar qualquer PR em `main` para gerar um.

Sem essas variáveis configuradas, o app sobe normalmente mas login/cadastro, assinatura e consulta real mostram erro — é esperado até a configuração ser concluída.

## Deploy

O projeto está conectado à Vercel via este repositório GitHub: todo push no branch `main` gera um deploy automático. Não é necessário publicar manualmente — basta abrir um PR, revisar e fazer merge em `main`.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Supabase](https://supabase.com) — autenticação e Postgres
- [Stripe](https://stripe.com) — assinatura recorrente
- Sem dependências externas de UI (CSS puro em `app/globals.css`)
- `npm run lint` (ESLint) e `npm run build` rodam automaticamente em cada PR via GitHub Actions (`.github/workflows/ci.yml`)
