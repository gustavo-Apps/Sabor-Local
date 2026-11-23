# Como contribuir

O Sabor Local é um projeto aberto e uma boa forma de estudar **Next.js + Supabase** na prática. Toda ajuda é bem-vinda:
código, testes, textos, ideias e relatos de problemas.

## Para começar

1. Suba o projeto localmente: [README.md](README.md#rodando-localmente) (Node 24, Docker, um comando para o banco).
2. Leia o [roadmap](docs/roadmap.md): a seção **O que falta** e a **Próxima fase** mostram o que está em aberto.
3. Escolha algo pequeno para começar, por exemplo um item da Próxima fase ou uma melhoria de texto.

## Sem programar

- **Achou um problema ou tem uma ideia?** Use o formulário **Fale conosco** do site. A equipe lê e, se fizer sentido,
  abre a issue.
- **Texto confuso, erro de português, tela difícil de usar no celular?** Isso também é contribuição.

## Fluxo de trabalho

1. Crie uma branch a partir da `main` (`feat/nome-curto`, `fix/nome-curto` ou `docs/nome-curto`).
2. Faça mudanças pequenas e focadas, no estilo do código ao redor.
3. Rode na pasta `webapp`, antes de abrir o PR:

   ```bash
   npm run lint
   npm run typecheck
   npm run test:unit
   npm run test:api      # precisa do Supabase local no ar
   ```

   Os detalhes (o que cada pasta de testes cobre) estão em [docs/testes.md](docs/testes.md). O CI roda tudo de novo no PR.
4. Mudou o banco? Crie uma **nova migration** em `webapp/supabase/migrations` (nunca edite uma já aplicada) e teste com
   `npx supabase db reset`.
5. Abra o PR explicando **o que mudou e por quê**. Se mexe na tela, anexe uma captura.

## Regras do projeto

- **Pense em cidade pequena e em pessoas simples:** poucas opções, textos claros, botões grandes, tudo funcionando bem
  no celular.
- **Mensagens de erro dizem como corrigir**, não só que deu errado.
- **Segurança e privacidade primeiro:** toda tabela nova tem RLS; dado pessoal novo entra na
  [Política de Privacidade](webapp/src/app/privacidade/page.tsx) e na limpeza automática (`limpar_dados_antigos`).
- **Nada de segredos no repositório:** chaves ficam em `.env.local` (ignorado pelo Git). Falha de segurança, siga o
  [SECURITY.md](SECURITY.md).
- **Não envie material de terceiros** (cardápios, logos, fotos) sem autorização.

## Dúvidas

Abra uma issue ou fale com o autor: [github.com/gustavo-Apps](https://github.com/gustavo-Apps).
