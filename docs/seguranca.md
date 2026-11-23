# Segurança e abertura do repositório

[← Voltar ao índice da documentação](../README.md#documentação)

Este repositório começou **com um histórico novo** em novembro de 2026, a partir do código revisado; o histórico anterior ficou em um repositório privado. Este documento registra a revisão feita em outubro de 2026 e o que foi decidido
ou feito **antes de torná-lo público**. A revisão foi feita sobre o código, as migrations e o histórico do Git; não
foi um teste de invasão.

## Resultado da revisão

**O que está bem**

- Nenhuma chave, senha ou token no código nem no histórico (busca por JWT, `sb_secret_`, chaves privadas e URLs de
  banco). Só existe `webapp/.env.local.example`, com valores de exemplo; `.env*` está no `.gitignore`.
- A chave secreta (`SUPABASE_SERVICE_ROLE_KEY`) só é lida em `src/lib/supabase/admin.ts`, código de servidor.
- **Todas as 18 tabelas** têm RLS ligado. Toda função `security definer` define `search_path`. As funções do admin
  checam `is_admin()` por dentro, e as de uso interno (`email_por_username`, bloqueio de login, limpeza) são só do
  `service_role`.
- `npm audit --omit=dev`: 0 vulnerabilidades.
- Limites contra abuso (login, palpite de código, denúncia, avaliação), IP real sem confiar no primeiro
  `X-Forwarded-For`, mensagem de login que não revela se o usuário existe, redirecionamento do callback restrito ao
  próprio domínio, JSON-LD com `<` escapado e cabeçalhos básicos (`X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`).

## O que decidir ou corrigir antes de abrir

| # | Item | Risco | O que fazer |
|---|---|---|---|
| 1 | ~~Commit antigo com o PDF do cardápio de terceiros~~ **Resolvido**: o repositório público começou com histórico novo; o antigo, com o commit órfão, ficou privado | Material de terceiros público | — |
| 2 | ~~E-mail do trabalho nos commits~~ **Resolvido**: o histórico novo usa o e-mail `noreply` do GitHub | Exposição do e-mail e vínculo com a empresa | Manter o `noreply` em `git config user.email` |
| 3 | **Documentos de negócio** em `docs/projeto/` (Proposta para sócios e investidores, estimativa de investimento) | Estratégia e valores ficam públicos | Decidir se ficam; se não, tirar da árvore e do histórico |
| 4 | ~~Dados de um negócio real no `seed-cliente-teste.mjs`~~ **Resolvido**: o script cria a "Pizzaria Exemplo", fictícia, e a versão antiga não veio para o histórico novo | Uso de dados de terceiros sem autorização | — |
| 5 | ~~Senha de teste no código~~ **Feito**: o script usa `TESTE_SENHA` ou gera uma senha aleatória e a imprime no fim | Baixo: só roda em localhost | — |
| 6 | ~~Sem política de segurança~~ **Feito**: `SECURITY.md` na raiz e `/.well-known/security.txt` no site (aparece quando `NEXT_PUBLIC_CONTATO_EMAIL` está definido) | Quem achar uma falha precisa saber a quem avisar | Definir o e-mail **do projeto** em produção e ligar o relato privado de vulnerabilidade no GitHub (Settings → Code security → Private vulnerability reporting) |
| 7 | **Dependabot configurado** (`.github/dependabot.yml`); *secret scanning* e *push protection* dependem de ligar no GitHub | Dependência vulnerável ou segredo no commit passa despercebido | Ligar os dois em Settings → Code security |
| 8 | **CSP em modo "só relatar"** (`Content-Security-Policy-Report-Only`, em `next.config.ts` e `src/lib/csp.ts`): o navegador avalia a política e envia violações para `/csp-report`, que registra um resumo no log do servidor (`[csp]`), sem endereços com parâmetros e sem o link secreto de avaliação | Ainda **não bloqueia** nada | Em produção, navegue pelo site e confira o log por violações por uns dias; corrija o que aparecer e troque o cabeçalho por `Content-Security-Policy`. O passo seguinte é trocar `'unsafe-inline'` por *nonce* |
| 9 | **Proteção da branch `main`** | Push direto ou merge sem CI | Exigir PR e CI verde (Settings → Branches) |
| 10 | ~~A licença MIT cobre o código, não os `.docx`~~ **Feito**: a seção Licença do README diz isso | Dúvida sobre o que pode ser reutilizado | — |

## Pontos do próprio produto a vigiar (valem com o repositório privado)

- **Cadastro com usuário já existente** informa que o usuário existe (necessário para a UX); o limite de tentativas
  reduz a enumeração, mas não a elimina.
- **O convite de avaliação** vai por e-mail com um link de 64 caracteres: o vendedor não o vê e não consegue convidar o próprio
  e-mail da conta, mas pode convidar um e-mail que ele controle (outro endereço, um amigo). Os limites e a moderação reduzem o
  efeito; não há como eliminá-lo sem confirmar a compra de verdade. Sobre o antigo código de compra: confirme os valores em
  homologação.
- **Limite de e-mails do Auth** do Supabase: sem SMTP próprio, um atacante pode esgotar os envios e travar novos
  cadastros. Configure o SMTP e os limites (producao.md, seção 4).
- **Storage público** (`cardapios`): qualquer pessoa com o link lê o arquivo. Não guardar nada que não seja para
  ser público, e manter o limite de 5 MB e os tipos permitidos.
- **Falta monitoramento**: sem alerta de erro nem de disponibilidade, um ataque ou uma falha passa despercebido.

## Cookies e rastreadores: por que não há faixa de cookies

Revisado em outubro de 2026. O site usa **só o que é necessário**: o cookie de sessão de quem entra (login) e o cookie `cidade`
(guarda a cidade escolhida). Não há Google Analytics, Meta Pixel, fontes nem scripts de terceiros, e as métricas de visita são
próprias, sem cookie e sem identificar a pessoa. Por isso **não é preciso pedir consentimento**, e a Política de Privacidade (seção 3)
diz isso.

**Regra para não esquecer:** se um dia entrar qualquer ferramenta de terceiros que grave cookies ou envie dados do visitante
(análise de visitas, mapa embutido, vídeo, chat, pixel de anúncio), é preciso **antes** de lançar: (1) pedir o consentimento com
uma faixa que deixe recusar sem perder o acesso, (2) listar a ferramenta e o que ela coleta na Política, e (3) liberar o endereço
dela na CSP. Os testes `tests/http` falham se uma página pública passar a carregar script ou recurso de fora ou a gravar cookie
sem a pessoa ter escolhido algo, justamente para esta decisão não passar despercebida.

## Checklist de abertura

- [x] Itens 1, 2, 4 e 5 da tabela resolvidos; item 3 (documentos de negócio) **a decidir**
- [x] `SECURITY.md` criado (falta o e-mail do projeto e ligar o relato privado)
- [ ] Dependabot (arquivo criado), secret scanning e push protection ligados no GitHub
- [ ] Proteção da `main` com CI obrigatório
- [x] Varredura de segredos no histórico completo (novembro de 2026: JWT, chaves `sb_*`, tokens de GitHub/AWS/Google/Stripe/Resend, URLs de banco e strings de alta entropia em todas as branches): **nenhum achado**. Vale repetir com `gitleaks detect` antes de abrir
- [x] `README.md` e `docs/` relidos: sem nomes, caminhos locais nem e-mails pessoais (só o e-mail do trabalho nos **metadados** dos commits, item 2)
- [ ] Só então mudar a visibilidade em Settings → General → Danger Zone
