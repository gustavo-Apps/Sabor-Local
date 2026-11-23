# Sabor Local

[![CI](https://github.com/gustavo-Apps/projeto-cardapio-digital/actions/workflows/ci.yml/badge.svg)](https://github.com/gustavo-Apps/projeto-cardapio-digital/actions/workflows/ci.yml)
![Next.js](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3FCF8E?logo=supabase&logoColor=white)
[![Licença MIT](https://img.shields.io/badge/licen%C3%A7a-MIT-blue)](LICENSE)

Plataforma web de **descoberta gastronômica para cidades pequenas**, onde não há iFood e similares. O morador encontra
quem vende comida na cidade (cardápio, horário, bairro) e chama o vendedor direto pelo WhatsApp; o vendedor ganha uma
vitrine gratuita, sem comissão. O site **não vende, não entrega e não processa pagamentos**: isso continua entre cliente
e vendedor.

> **Versão beta.** Fases 0 a 4 do plano estão feitas no código; falta publicar em produção e validar com vendedores
> reais. A **versão 2.x (pedidos pelo site e "Monte o seu")** já está na `main`, mas só deve ir ao ar depois da beta validada.
> Status completo em [docs/roadmap.md](docs/roadmap.md).

## Em números

| | |
|---|---|
| Migrations do banco | 28 (schema, RLS em todas as tabelas, funções e limpeza LGPD) |
| Arquivos de teste | 56: unitários, API/RLS/Storage, força bruta e rotas HTTP |
| CI | 2 jobs em paralelo a cada PR + porta única `CI OK` para a proteção de branch |
| Dependências | Dependabot: npm toda semana, GitHub Actions todo mês |

## O que já faz

- **Cliente (sem cadastro):** catálogo por cidade com a **busca no topo** (por nome da loja, por produto ou pelos dois, sem
  diferença de acento), filtros de ramo, **tipo de produto** (Bebidas, Salgados, Doces...), bairro e "aberto agora"; perfil do vendedor com logo e banner, **busca dentro do
  cardápio**, destaques ("Destaque da casa" e "Mais pedido"), botão "Pedir" em cada item que abre o WhatsApp com o item na
  mensagem, **pedido pelo site** (versão 2.x: carrinho, entrega ou retirada, acompanhamento por link e avaliação do pedido),
  horários, nota média e avaliações por convite enviado ao e-mail do cliente (o vendedor não vê o link; o nome de quem avalia é
  opcional) e denúncias. Quem já tem site ou cardápio online coloca o link ao lado do WhatsApp.
- **Vendedor:** conta própria, "esqueci minha senha", painel simples (Perfil, Horários com até dois períodos por dia, Menu, Cardápio, Clientes e Compartilhar), "Não abro hoje" e férias,
  itens "Indisponível hoje" e "Destaque da casa" (até 3), **categorias do próprio menu** (opcionais), logo e banner, sugestão de bairro que não está na lista, convite de
  avaliação por e-mail, relatório dos itens mais tocados, baixar os próprios dados, datas especiais, QR code do perfil,
  métricas, plano destaque e exclusão da própria conta.
- **Fale conosco:** qualquer pessoa relata um problema, sugere ou pergunta; a equipe lê no `/admin` e decide o que vira issue no GitHub.
- **Administração (`/admin`):** aprovação de vendedores, denúncias, feedback e avaliações, cidades e bairros (fila de sugestões,
  renomear, juntar e desativar), pagamentos do destaque, histórico de alterações, indicadores das metas e **configurações**
  (exigir ou não a aprovação do administrador para avaliações novas e para vendedores novos).
- **Produção/LGPD:** Termos de Uso e Política de Privacidade, limpeza automática de dados por prazo, limites contra abuso.

## Tecnologias

[Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS · [Supabase](https://supabase.com) (Postgres, Auth e
Storage) · Vercel · GitHub Actions (CI). Testes com o executor nativo do Node.

## Rodando localmente

Pré-requisitos: Node 24 e Docker em execução. Tudo abaixo na pasta `webapp`.

```bash
cd webapp
npm install
npx supabase start        # Postgres + Auth + Storage + Studio locais; aplica as migrations e o seed
```

Copie `.env.local.example` para `.env.local` e preencha com as chaves que o `supabase start` imprimiu
(`npx supabase status` mostra de novo):

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave publishable>
SUPABASE_SERVICE_ROLE_KEY=<chave secret>
```

```bash
npm run dev               # http://localhost:3000
```

Sem o Supabase configurado o app abre com dados de exemplo. Outros comandos úteis:

```bash
npx supabase stop         # para os containers (mantém os dados)
npx supabase db reset     # recria o banco do zero (migrations + seed)
npm run seed:cliente-teste -- "caminho/do/cardapio.pdf"   # cria um vendedor de teste completo (só local)
```

O Studio (interface do banco) fica em http://127.0.0.1:54323 e os e-mails de confirmação chegam ao Mailpit em
http://127.0.0.1:54324. Para virar administrador localmente, veja [docs/operacao.md](docs/operacao.md).

## Variáveis de ambiente

| Variável | Onde | Observação |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | navegador + servidor | URL da API (`http://127.0.0.1:54321` no local) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | navegador + servidor | chave *publishable*; segura por causa do RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **só servidor** | chave *secret*, usada no login por usuário. Nunca com `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | navegador + servidor | URL pública do site (QR codes, sitemap, links de e-mail). Ex.: `https://saborlocal.com.br` |
| `NEXT_PUBLIC_RESPONSAVEL_NOME` | navegador + servidor | Quem responde pelos dados (LGPD); aparece na Política e nos Termos |
| `NEXT_PUBLIC_CONTATO_EMAIL` | navegador + servidor | E-mail de contato (LGPD); aparece na Política e nos Termos |
| `NEXT_PUBLIC_CONTATO_WHATSAPP` | navegador + servidor | Opcional: WhatsApp da equipe (só dígitos, com 55) para o botão "Falar com a equipe" |

A lista completa para produção, com onde configurar cada uma, está em [docs/producao.md](docs/producao.md).

## Testes

```bash
npm run test:unit         # rápido, sem banco
npm test                  # tudo (precisa do Supabase local; test:http precisa do app no ar)
```

Os testes de API e de força bruta **só rodam contra o Supabase local**. O CI do GitHub roda tudo a cada pull request.
Detalhes em [docs/testes.md](docs/testes.md).

## Estrutura do repositório

```
.
├── README.md                    este arquivo
├── CONTRIBUTING.md              como contribuir (fluxo, testes, regras)
├── SECURITY.md                  como avisar sobre uma falha de segurança
├── docs/                        toda a documentação (veja a tabela abaixo)
│   └── projeto/                 documentos originais do projeto (Termo de Abertura, Proposta, Roadmap em .docx)
├── webapp/                      o aplicativo
│   ├── src/app                  rotas: catálogo, perfil, login, painel, admin, termos, privacidade
│   ├── src/components           componentes de interface
│   ├── src/lib                  acesso a dados, validações, regras (horários, destaque, cidades)
│   ├── supabase/migrations      schema e funções do banco (0001 a 0028)
│   ├── supabase/seed.sql        dados de exemplo (só local)
│   ├── supabase/producao        dados de base para o banco de produção
│   ├── scripts                  cliente de teste e verificador de produção
│   └── tests                    unitários, API, força bruta e rotas HTTP
└── .github/                     CI, modelos de issue e de PR, Dependabot
```

## Documentação

| Documento | Para quê |
|---|---|
| [docs/roadmap.md](docs/roadmap.md) | **O que falta**, o que já foi feito, conformidade com o Termo, próxima fase e versão 2.x |
| [docs/producao.md](docs/producao.md) | Passo a passo para publicar (migrations, Auth, SMTP, Vercel, domínio, backup) |
| [docs/operacao.md](docs/operacao.md) | Dia a dia do administrador: aprovar, moderar, destaque, suporte |
| [docs/manual-de-expansao.md](docs/manual-de-expansao.md) | Como abrir uma cidade nova |
| [docs/seguranca.md](docs/seguranca.md) | Revisão de segurança e o que fazer antes de tornar o repositório público |
| [docs/testes.md](docs/testes.md) | Como rodar os testes, o que cada pasta cobre e as limitações conhecidas |
| [docs/projeto/](docs/projeto/) | Termo de Abertura, Proposta e Roadmap originais (.docx) |

## Contribuindo

O projeto é aberto e bom para estudar Next.js e Supabase na prática. O passo a passo está em [CONTRIBUTING.md](CONTRIBUTING.md). Quem não programa também ajuda: use o **Fale conosco**
do site. Falhas de segurança seguem o [SECURITY.md](SECURITY.md). Antes de abrir um pull request, rode `npm run lint`,
`npm run typecheck` e `npm test`; o CI exige tudo verde. Contato do autor: [github.com/gustavo-Apps](https://github.com/gustavo-Apps).

## Licença

O código está sob a licença [MIT](LICENSE). Os documentos de projeto em `docs/projeto/` (.docx) são do autor e estão
no repositório só para consulta; a licença MIT não se aplica a eles.
