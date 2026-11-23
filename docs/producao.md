# Colocando o Sabor Local em produção

[← Voltar ao índice da documentação](../README.md#documentação)

Passo a passo para publicar o site de verdade. O código já está pronto (páginas de Privacidade e Termos, exclusão de
conta, limpeza de dados, múltiplas cidades, bloqueios contra abuso). O que falta são **configurações nas suas contas**
(Supabase, Vercel, e-mail e domínio), que só você pode fazer. Siga na ordem e marque cada item.

> Antes de começar, tenha à mão: login do Supabase e da Vercel, a senha do banco de produção, e (opcional) um domínio.

## Visão geral

| # | Etapa | Onde | Quem |
|---|---|---|---|
| 1 | Backup e migrations | Terminal (`webapp/`) | você |
| 2 | Dados de base (cidade, bairros, ramos) | SQL Editor do Supabase | você |
| 3 | Configurar o Auth (e-mail, senhas, URLs) | Painel do Supabase | você |
| 4 | SMTP próprio | Painel do Supabase + provedor | você |
| 5 | Variáveis e deploy | Vercel | você |
| 6 | Domínio | Vercel + registrador | você |
| 7 | Primeiro administrador | Site + SQL Editor | você |
| 8 | Verificação automática | Terminal | `npm run verificar:producao` |
| 9 | Teste manual de ponta a ponta | Navegador | você |
| 10 | Backup contínuo e monitoramento | Supabase + serviço de uptime | você |

---

## 1. Backup e migrations

1. **Se o projeto já tem dados**, faça um backup antes (painel → Database → Backups, ou o `db dump` da seção 10).
2. No terminal, na pasta `webapp`:

```bash
npx supabase login
```
```bash
npx supabase link --project-ref SEU_PROJECT_REF
```
```bash
npx supabase migration list
```
```bash
npx supabase db push --dry-run
```
```bash
npx supabase db push
```

O `link` pede a **senha do banco** (Project Settings → Database). O `--dry-run` só mostra o que seria aplicado.
Devem entrar as migrations `0001` a `0028`, as que o remoto ainda não tiver.

3. Confira no painel (Database → Extensions) se **pg_cron** está ligado. A migration 0010 tenta agendar a limpeza diária
   de dados antigos (`limpar_dados_antigos()`); se a extensão estiver desligada, ligue-a e rode a migration de novo ou
   agende a função manualmente. Sem isso os prazos da Política de Privacidade não são cumpridos.

- [ ] Migrations aplicadas
- [ ] pg_cron ligado e job `limpar-dados-antigos` criado (Database → Cron, ou `select * from cron.job;`)

## 2. Dados de base

O `seed.sql` é só para desenvolvimento e **não deve ir para produção**. Use
[`webapp/supabase/producao/dados-base.sql`](../webapp/supabase/producao/dados-base.sql): troque o nome da cidade, o
estado, o `slug` e os bairros pelos reais e rode no **SQL Editor**. Pode rodar de novo sem duplicar.

- [ ] Cidade real, bairros e ramos criados (a consulta final do arquivo lista tudo)

Mais cidades depois: veja [`manual-de-expansao.md`](manual-de-expansao.md) (tudo pelo painel `/admin`, aba Cidades).

## 3. Auth no painel do Supabase

Em **Authentication**:

| Onde | Ajuste |
|---|---|
| Sign In / Providers → Email | Ligar **Confirm email** |
| Sign In / Providers → Password | **Minimum password length = 8** (igual ao `config.toml`) |
| URL Configuration | **Site URL** = o endereço público (ex.: `https://saborlocal.com.br`) |
| URL Configuration → Redirect URLs | Adicionar `https://saborlocal.com.br/**` (e o `*.vercel.app` se for usar) |
| Rate Limits | Conferir que o limite de logins por IP está ativo (o padrão é 30 por 5 minutos) |
| Attack Protection | Opcional: ligar CAPTCHA (Cloudflare Turnstile) se houver spam de cadastro |

O `supabase/config.toml` só vale para o ambiente **local**; nada disso é aplicado pelo `db push`.

- [ ] Confirmação de e-mail ligada
- [ ] Senha mínima 8
- [ ] Site URL e Redirect URLs corretos
- [ ] Limite de logins conferido

## 4. SMTP próprio (e-mail de confirmação)

O servidor de e-mail padrão do Supabase serve só para testes: envia pouquíssimos e-mails por hora e pode cair em spam.
Sem SMTP próprio, **vendedores não conseguem confirmar o cadastro**.

1. Crie conta em um provedor de e-mail transacional (Resend, Brevo, Mailgun, Amazon SES ou similar). Todos têm plano
   grátis suficiente para começar.
2. Verifique o domínio de envio no provedor (registros SPF e DKIM) para o e-mail não cair em spam.
3. No Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP** e preencha host, porta, usuário,
   senha e o remetente (ex.: `nao-responda@seudominio.com.br`).
4. Em Authentication → Rate Limits, ajuste o limite de e-mails por hora para o volume esperado.
5. **Modelo do e-mail de confirmação (recomendado).** O projeto já traz o e-mail em português e com a identidade do
   Sabor Local em `webapp/supabase/templates/confirmacao.html`. No Supabase: **Authentication → Emails → Templates →
   Confirm signup**, cole o conteúdo do arquivo no campo da mensagem e use o assunto
   `Confirme seu e-mail no Sabor Local`. O modelo precisa manter a variável `{{ .ConfirmationURL }}`, que é o link de
   confirmação. No ambiente local o mesmo modelo já vale (veja o e-mail no Mailpit, porta 54324).
6. **Modelo do e-mail "esqueci minha senha".** Em **Authentication → Emails → Templates → Reset password**, cole o
   conteúdo de `webapp/supabase/templates/recuperacao.html` e use o assunto `Crie uma nova senha no Sabor Local`. O link
   do e-mail leva a `/auth/callback?next=/redefinir-senha`: confira em **Authentication → URL Configuration** que o
   endereço do site está em *Redirect URLs* (`https://seu-site/**`).
7. **Modelo do e-mail de troca de e-mail.** Em **Authentication → Emails → Templates → Change email address**, cole
   `webapp/supabase/templates/troca-email.html` e use o assunto `Confirme o novo e-mail no Sabor Local`. O site ainda não tem uma
   tela de "trocar e-mail"; o modelo já fica pronto para quando houver (e cobre quem pedir a troca pelo Fale conosco e o admin
   fizer pelo painel do Supabase).
8. Quer outro texto ou outras cores? Edite o HTML (estilos inline, pois muitos leitores de e-mail ignoram CSS externo),
   rode `npx supabase stop && npx supabase start` e crie uma conta de teste para ver o resultado no Mailpit.

- [ ] SMTP configurado e e-mail de teste recebido (fora da caixa de spam)

## 5. Variáveis de ambiente e deploy na Vercel

> **Convite de avaliação:** o vendedor informa o e-mail do cliente e o **site** envia o link direto para ele; o vendedor
> nunca vê o link. Por isso o site precisa de um serviço de e-mail próprio (`RESEND_API_KEY` e `EMAIL_REMETENTE`, abaixo).
> O SMTP da seção 4 serve só para os e-mails de login do Supabase e é outra coisa. Em desenvolvimento, sem essas
> variáveis, o e-mail "sai" no terminal do servidor (modo log) e dá para testar o fluxo inteiro.

1. Importe o repositório. Em **Settings → General → Root Directory** escolha `webapp`.
2. Em **Settings → Environment Variables**, crie para **Production** (e Preview, se quiser):

| Variável | Valor | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://SEU_REF.supabase.co` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chave **publishable** (`sb_publishable_...`) | pode ser pública; o RLS protege os dados |
| `SUPABASE_SERVICE_ROLE_KEY` | chave **secret** (`sb_secret_...`) | **só servidor**; nunca com `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `https://saborlocal.com.br` | usada em QR codes, sitemap e e-mails |
| `NEXT_PUBLIC_RESPONSAVEL_NOME` | nome de quem responde pelo site | aparece na Política e nos Termos (LGPD) |
| `NEXT_PUBLIC_CONTATO_EMAIL` | e-mail de contato | aparece na Política, nos Termos (LGPD) e no Fale conosco, e alimenta o `/.well-known/security.txt`. **Crie um e-mail do projeto**, não use o pessoal nem o do trabalho |
| `RESEND_API_KEY` | chave da conta no [Resend](https://resend.com) | **só servidor** (marque como *Sensitive*). Envia o **convite de avaliação** ao e-mail do cliente. Sem ela, em produção o convite é recusado |
| `EMAIL_REMETENTE` | `Sabor Local <avisos@seudominio.com.br>` | domínio verificado no Resend (SPF e DKIM). Sem ele o envio não funciona |
| `NEXT_PUBLIC_CONTATO_WHATSAPP` | WhatsApp da equipe, só dígitos com 55 | opcional; aparece no Fale conosco e nos textos legais |

3. A Vercel pode avisar que `NEXT_PUBLIC_SUPABASE_ANON_KEY` "parece sensível": ignore, essa é a chave pública.
4. Faça o **deploy** (variáveis `NEXT_PUBLIC_*` só valem depois de um novo build).

> **Atenção com os deploys de Preview:** eles usam as variáveis que você definir para Preview. Se apontarem para o
> mesmo banco de produção, cada PR mexe em dados reais. Prefira um segundo projeto Supabase (grátis) para Preview ou
> deixe as variáveis só em Production.

- [ ] Root Directory = `webapp`
- [ ] Todas as variáveis criadas em Production
- [ ] Deploy concluído sem erro

## 6. Domínio

1. Compre/registre o domínio (Registro.br para `.com.br`).
2. Na Vercel: Settings → Domains → Add, e siga as instruções de DNS (registro `A`/`CNAME` indicado pela Vercel).
3. Depois que o domínio responder com HTTPS, **atualize** `NEXT_PUBLIC_SITE_URL` e o Site URL do Supabase para o
   domínio final e faça um novo deploy.

- [ ] Domínio apontando e com HTTPS
- [ ] `NEXT_PUBLIC_SITE_URL` e Site URL do Supabase atualizados

## 7. Primeiro administrador

1. Crie a **sua conta de vendedor** pelo site (aba "Criar conta" em `/login`) e confirme o e-mail.
2. No SQL Editor do Supabase:

```sql
insert into admins (user_id)
select id from auth.users where email = 'seu-email@exemplo.com'
on conflict do nothing;
```

3. Entre em `/painel`: aparece a faixa "Você é administrador" com o link para `/admin`.

- [ ] Administrador criado e `/admin` abre

## 8. Verificação automática

Com o site no ar, rode (é **somente leitura**, pode usar em produção):

```bash
npm run verificar:producao -- https://seu-site.com.br
```

Ele confere HTTPS, páginas públicas, redirecionamentos, cabeçalhos de segurança, `robots.txt` e `sitemap.xml` apontando
para o endereço certo, ausência de chaves secretas no HTML, arquivos sensíveis fora do ar, conexão com o banco e se a
Política de Privacidade tem contato. **FALHA** = corrigir antes de divulgar. **AVISO** = conferir.

> Os testes de força bruta (`tests/forca-bruta`) **não** devem ser apontados para produção. Eles só rodam contra o
> Supabase local, e a trava do `tests/helpers.mjs` impede o contrário.

- [ ] `verificar:producao` sem nenhuma FALHA

## 9. Teste manual de ponta a ponta

Em um celular, com contas de teste:

1. Criar conta de vendedor, receber o e-mail, confirmar e entrar.
2. Cadastrar o negócio (cidade, bairro, ramo, WhatsApp) e ver "aguardando aprovação".
3. No `/admin`, aprovar o vendedor; ver o perfil aparecendo na home.
4. No painel: horários, menu com foto, cardápio em PDF, "Não abro hoje".
5. Convidar um e-mail seu para avaliar (aba Clientes do painel), abrir o link recebido, avaliar e aprovar a avaliação no `/admin`.
6. Fazer uma denúncia e tratá-la no `/admin`.
7. Registrar um pagamento de destaque e ver o selo e a prioridade na home.
8. Abrir `/termos` e `/privacidade` e conferir o contato do responsável.
9. Excluir a conta de teste (aba Perfil → "Excluir minha conta") e confirmar que o perfil sumiu.
10. Em uma aba anônima, tentar abrir `/painel` e `/admin` (devem pedir login).

- [ ] Todos os passos funcionaram

## 10. Backup contínuo e monitoramento

**Backup do banco**

- Plano **Free do Supabase não tem backup automático**. Os planos pagos fazem backup diário (Database → Backups).
- Backup manual a qualquer momento (guarde o arquivo em local **privado**: ele contém dados pessoais, **nunca** o
  coloque no repositório nem em artefato público do GitHub):

```bash
npx supabase db dump --linked -f backup-$(date +%F).sql
```

- Os arquivos do Storage (cardápios, fotos) **não** vão nesse dump; baixe-os pelo painel (Storage) ou use o plano pago.
- Teste a restauração pelo menos uma vez, em um projeto novo, antes de precisar dela.
- Rotina sugerida: backup manual semanal (Free) até migrar para um plano com backup diário.

**Monitoramento**

- Um serviço de uptime grátis (UptimeRobot, Better Stack) chamando `https://seu-site/robots.txt` a cada 5 minutos e
  avisando por e-mail ou WhatsApp.
- **Free do Supabase pausa o projeto após 7 dias sem uso**: o uptime acima também evita isso.
- Logs: Vercel (aba Logs) e Supabase (Logs → API, Auth, Postgres).

**Limites do plano grátis (confira os valores atuais nos sites)**

| Serviço | Atenção |
|---|---|
| Supabase Free | pausa por inatividade, banco e storage pequenos, sem backup automático |
| Vercel Hobby | uso **não comercial**; ao cobrar o plano destaque, migre para o Pro |
| Provedor de e-mail | cota mensal de envios |

- [ ] Primeiro backup feito e guardado em local privado
- [ ] Monitor de uptime ativo

---

## Depois de publicar

- **Senha ou chave vazou?** Gere novas em Project Settings → API (e redefina a senha do banco), atualize na Vercel e
  faça um novo deploy.
- **Algo quebrou depois de um deploy?** Na Vercel, abra Deployments e use "Promote to Production" no deploy anterior.
  Migrations de banco não voltam sozinhas: escreva uma migration nova que desfaça a mudança.
- **Atualizar os textos legais:** edite `webapp/src/app/termos/page.tsx` e `privacidade/page.tsx` e troque
  `TERMOS_VERSAO` e `TERMOS_DATA` em `webapp/src/lib/legal.ts`. A versão aceita fica gravada no cadastro de cada
  vendedor.
- **Revisão jurídica:** os textos legais são um ponto de partida em linguagem simples. Peça a um advogado ou ao
  contador que os revise antes de divulgar, principalmente a base legal, os prazos de retenção e o foro.
