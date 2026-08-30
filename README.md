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
- `app/assinar` — página com os 3 planos (Essencial/Profissional/Escritório) + "Fale com a gente" pra alto volume; usuário sem assinatura ativa é redirecionado pra cá
- `app/dashboard` — consulta de veículo por placa, com ficha técnica, FIPE, débitos e restrições (protegido: exige login + assinatura ativa); topbar mostra o saldo de consultas avançadas do período
- `app/dashboard/historico` — histórico de placas consultadas, salvo no banco; tem botão "Limpar histórico" (apaga tudo, com confirmação)
- `app/api/checkout` — cria a sessão de Stripe Checkout para o usuário logado
- `app/api/stripe/webhook` — recebe eventos do Stripe e atualiza a assinatura no banco
- `app/api/veiculo` — consulta dados reais de veículo por placa (exige login + assinatura ativa)
- `app/api/consulta-avancada` — consulta avançada real de multas/roubo-furto/Renajud, sob demanda (exige login + assinatura ativa)
- `lib/vehicle.ts` — camada de dados **mock** (débitos — ainda simulado, exibido junto com o dado real)
- `lib/dados-veiculo.ts` — client do provedor de dados veiculares ativo (veja "Dados reais de veículo" abaixo)
- `lib/dados-avancados.ts` — client do provedor de consulta avançada (veja "Consulta avançada" abaixo)
- `lib/plans.ts` — os 3 planos (nome, cota mensal de consultas avançadas, preço) e o preço da consulta avulsa fora da cota
- `lib/uso-avancada.ts` — conta o uso do período atual e registra cada consulta avançada realizada (tabela `avancada_usage`)
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
2. Abra **SQL Editor** e rode o conteúdo dos arquivos em `supabase/migrations/`, em ordem (`0001_init.sql`, `0002_...`, etc.) — cada um é rodado manualmente, não há pipeline automático de migração.
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

1. Crie um produto e **três preços recorrentes mensais** em **Product catalog** — um por plano (Essencial, Profissional, Escritório; valores e cotas em `lib/plans.ts`). Copie cada `price_...` → `STRIPE_PRICE_ESSENCIAL` / `STRIPE_PRICE_PROFISSIONAL` / `STRIPE_PRICE_ESCRITORIO`.
2. Em **Developers > API keys**, copie a `Secret key` → `STRIPE_SECRET_KEY`.
3. Em **Developers > Webhooks**, crie um novo destino de evento (não reaproveite um endpoint de outro projeto) apontando para `https://SEU-DOMINIO/api/stripe/webhook`, escutando: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`. Copie o `Signing secret` → `STRIPE_WEBHOOK_SECRET`.

   Se sua conta usa **Sandboxes** (contas Stripe novas), confirme que o produto, a chave e o webhook estão todos dentro do mesmo sandbox — cada sandbox tem chaves e webhooks isolados.

4. **Cobrança avulsa do excedente**: quando o despachante estoura a cota de consultas avançadas ou simples do plano no período (e, no caso de consulta simples, não tem crédito de recarga disponível), `app/api/consulta-avancada` e `app/api/veiculo` criam um item de fatura avulso (`stripe.invoiceItems.create`) nos valores de `PRECO_AVULSO_CENTAVOS` / `PRECO_AVULSO_SIMPLES_CENTAVOS` (`lib/plans.ts`) — o Stripe inclui isso automaticamente na próxima fatura do cliente, sem precisar de nenhum job agendado.

5. **Pacotes de recarga de créditos**: não exigem nenhum Price cadastrado no Stripe — `app/api/checkout-creditos` cria a sessão de checkout com `price_data` inline (valores em `PACOTES_RECARGA`, `lib/plans.ts`), e o webhook (`checkout.session.completed`) credita os créditos ao usuário via `registrarRecarga()`. Créditos expiram 6 meses após a compra, ou imediatamente se a assinatura for cancelada (`expirarCreditosPorCancelamento()`, chamada tanto pelo webhook quanto pela revogação manual de acesso no admin).

### 3. Dados reais de veículo

1. Copie o token fornecido pelo provedor da consulta por placa → `PLACA_API_TOKEN`.
2. `lib/dados-veiculo.ts` chama esse provedor e devolve ficha do veículo (placa, chassi, Renavam, marca/modelo, ano, cor, combustível, FIPE, restrições, indicadores de roubo/furto/multa) e o nome do proprietário atual.
3. **Importante — dados pessoais**: o provedor retorna, junto da ficha do veículo, um dossiê pessoal completo do proprietário (CPF, nome da mãe, data de nascimento, endereço, telefone, e-mail e dados de birô de crédito). `sanitizeVeiculo()` em `lib/dados-veiculo.ts` descarta tudo isso — só o **nome** do proprietário atual chega a sair da função. Isso é proposital: um despachante tem necessidade legítima de saber quem é o dono do veículo, mas não de acessar o dossiê pessoal completo dele (LGPD — minimização de dados). **Não amplie esse retorno sem revisar as implicações de LGPD antes.**
   - Exceção deliberada: quando o proprietário é **pessoa jurídica** (`tipo === "Juridica"` no retorno do provedor), o **CNPJ** é liberado (`proprietarioCnpj`). CNPJ é registro público de empresa, não dado pessoal protegido pela LGPD como o CPF — a mesma regra de nunca expor CPF de pessoa física continua valendo.
   - Se o cliente informar o próprio CPF/CNPJ pessoalmente (ex: presente numa vistoria), há um campo manual de anotação na ficha (`cpfCnpjCliente` em `app/dashboard/page.tsx`) — não vem da API, não é persistido, existe só naquela consulta/impressão.
4. Débitos (IPVA, licenciamento) **continuam simulados** — não fazem parte do retorno de nenhum dos dois provedores.
5. `lib/infosimples.ts` fica sem uso por enquanto (endpoint de veículo não autorizado na conta atual) — mantido só caso a consulta de multas ANTT/SIFAMA seja retomada.

### 4. Consulta avançada (multas, roubo/furto, Renajud)

1. Copie o token de um segundo provedor, cobrado por consulta (à parte do provedor acima) → `PLACA_DEBITOS_API_TOKEN`.
2. `lib/dados-avancados.ts` chama esse provedor sob demanda — só quando o despachante clica no botão "Consultar multas, roubo/furto e Renajud reais" na ficha, nunca automaticamente numa consulta normal, já que cada chamada tem custo. Devolve: multas em aberto (item a item: descrição, valor, pontos, gravidade, órgão competente, artigo e o papel do responsável — "Proprietário" ou "Condutor", nunca um nome de pessoa), totais agregados, ocorrência de roubo/furto (tipo, data, município) e restrições judiciais ativas no Renajud (tribunal, número do processo, tipo de restrição). O provedor não devolve data nem local de cada multa individual — só o que está listado acima existe na resposta dele.
3. **Dados pessoais**: o provedor devolve, junto da ficha, nome e documento (CPF/CNPJ) do proprietário. `sanitizeAvancada()` em `lib/dados-avancados.ts` segue a mesma regra do provedor principal (item 3 acima): o **nome** do proprietário sai normalmente (necessidade legítima do despachante, não é o dado sensível aqui), mas o **CPF** nunca é exposto. Só o **CNPJ** sai junto do nome, e só quando o documento tem 14 dígitos (pessoa jurídica); documento de 11 dígitos (CPF de pessoa física) nunca é exposto. O campo `infrator` de cada multa também foi conferido: é só a categoria de quem responde pela multa, não um nome — validado com uma amostra real antes de liberar a listagem item a item.

### 5. Configurar na Vercel

Em **Project Settings > Environment Variables** do projeto `doc-car-app`, adicione as 11 variáveis acima. Depois de salvar, é preciso um **novo deploy** (as variáveis não afetam deploys já publicados) — basta mesclar qualquer PR em `main` para gerar um.

Sem essas variáveis configuradas, o app sobe normalmente mas login/cadastro, assinatura e consulta real mostram erro — é esperado até a configuração ser concluída.

## Deploy

O projeto está conectado à Vercel via este repositório GitHub: todo push no branch `main` gera um deploy automático. Não é necessário publicar manualmente — basta abrir um PR, revisar e fazer merge em `main`.

## Stack

- [Next.js](https://nextjs.org) (App Router) + TypeScript
- [Supabase](https://supabase.com) — autenticação e Postgres
- [Stripe](https://stripe.com) — assinatura recorrente
- Sem dependências externas de UI (CSS puro em `app/globals.css`)
- `npm run lint` (ESLint) e `npm run build` rodam automaticamente em cada PR via GitHub Actions (`.github/workflows/ci.yml`)
