# Testes do Sabor Local

[← Voltar ao índice da documentação](../README.md#documentação)

> Os comandos abaixo rodam na pasta `webapp`; os testes ficam em `webapp/tests`.

Sem dependências novas: usa o executor nativo do Node (`node --test`, Node 22+) e o
`@supabase/supabase-js` que o projeto já tem.

> **Segurança:** os testes de API e de força bruta criam e apagam usuários e disparam
> milhares de requisições. Eles **só rodam contra o Supabase local** (`127.0.0.1`/`localhost`);
> `helpers.mjs` se recusa a iniciar se a URL for outra. **Nunca** aponte para produção.

## Como rodar

```bash
npx supabase start          # banco local no ar (necessário, exceto para test:unit)
npm run test:unit           # só validações e máscaras (sem banco, 1 segundo)
npm run test:api            # API, RLS, Storage, RPCs
npm run test:forca-bruta    # ataques em massa (leva ~1 min)

# rotas HTTP do Next (precisa do app no ar)
npm run build && npx next start -p 3055
TEST_BASE_URL=http://localhost:3055 npm run test:http

npm test                    # tudo, em sequência
```

Sem servidor Next no ar, `test:http` pula os testes em vez de falhar.

Para apontar para outro Supabase local (ex.: porta diferente), defina
`TEST_SUPABASE_URL`, `TEST_SUPABASE_PUBLISHABLE_KEY`, `TEST_SUPABASE_SECRET_KEY`.

## Integração contínua (GitHub Actions)

O arquivo [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda a cada pull request e a cada push na `main`:

| Job | O que faz | Tempo |
|---|---|---|
| `qualidade` | `npm run lint`, `tsc --noEmit`, `test:unit` e `build` | ~2 min |
| `integracao` | sobe o Supabase local do zero (aplica as 10 migrations e o seed), roda `test:api`, `test:forca-bruta`, sobe o app e roda `test:http` | ~6 min |
| `CI OK` | só passa se os dois acima passarem | segundos |

**Para o PR só poder ser concluído com tudo verde**, no GitHub: *Settings → Branches → Add branch protection rule*
(branch `main`) → marque **Require status checks to pass before merging** e escolha **CI OK**.
Exija só o `CI OK` (os outros nomes podem mudar sem quebrar a regra).

Se o CI falhar, abra o job e veja o passo marcado em vermelho. Em falha da integração, o último passo imprime
`next.log`, o `supabase status` e os logs dos containers. Para reproduzir localmente o que o CI faz:
`npx supabase db reset` (banco do zero) e `npm test`.

## Verificação de produção (não é teste de ataque)

`npm run verificar:producao -- https://seu-site` faz poucas leituras comuns e confere HTTPS, páginas, redirecionamentos,
cabeçalhos, `robots.txt`/`sitemap.xml`, segredos no HTML e conexão com o banco. Pode ser usado em produção, ao contrário
das pastas `forca-bruta` e `api`, que só rodam contra o Supabase local. Ele também é coberto por `http/rotas.test.mjs`.

## O que cada pasta cobre

| Pasta | Foco | Como verifica |
|---|---|---|
| `unit/cidades.test.mjs` | Slug, validação de cidade e bairro, escolha da cidade, aceite dos Termos | Acento, símbolos, valores hostis |
| `unit/horarios.test.mjs` | Horário com dois períodos, máscara de hora em 24 horas e "aberto agora" | Sobreposição, turno que vira a noite, períodos fora de ordem, `800`/`1800` sem dois pontos, 100 mil dígitos |
| `unit/convite.test.mjs` | Convite de avaliação: e-mail, validações, nome do avaliador, interruptores do admin e envio | E-mail próprio e inválido, injeção de cabeçalho, HTML no nome da loja, Resend com `fetch` falso (sucesso, erro, queda), modo log e recusa em produção |
| `unit/minhaLoja.test.mjs` | "Esta é a minha loja" | Visitante, vendedor sem perfil, ids parecidos |
| `unit/linkPedido.test.mjs` | Link de pedidos próprio | `javascript:`, `data:`, IP, `localhost`, usuário e senha, porta, 300 caracteres, endereço dentro do texto do botão |
| `unit/resposta.test.mjs` | Responder pelo painel | Só e-mail ou telefone viram link; mensagem hostil não troca o destino |
| `unit/termos.test.mjs` | Novo aceite dos Termos | Versão nula, antiga e atual; formato aceito pelo banco |
| `unit/saudeCanal.test.mjs` | Saúde do Fale conosco | Taxa de aproveitamento, situação desconhecida, nomes herdados de objeto |
| `unit/csp.test.mjs` | CSP em modo só relatar | Política sem curinga, relatório sem parâmetros e sem o link secreto, texto livre fora do resumo |
| `unit/emails-modelos.test.mjs` | Modelos de e-mail do Supabase | Em português, com o link como botão e texto, sem imagem nem recurso de fora |
| `unit/senha.test.mjs` | Pedido de recuperação e nova senha | E-mail e usuário válidos e inválidos, tamanhos, só espaços, entradas hostis |
| `unit/itens.test.mjs` | "Indisponível hoje" | Virada do dia, data vencida, modo hostil, ordem do perfil |
| `unit/compartilhar.test.mjs` | Links de divulgação e mensagem | Origem desconhecida ou hostil, codificação do WhatsApp, mensagem curta e longa |
| `unit/metas.test.mjs` | Metas por cidade e leitura do resumo | Situação da cidade, 4 semanas, números inválidos e linhas sem identificação |
| `unit/exportacao.test.mjs` | Arquivo de "Baixar meus dados" | Remoção de chaves sensíveis em qualquer nível, nome em horário de Brasília, arquivo incompleto |
| `unit/feedback.test.mjs` | Link da issue do GitHub e filtros do Fale conosco | Caracteres especiais, título longo, issue de outro repositório, `?de=` externo ou com `\\` |
| `unit/destaque.test.mjs` | Validação do pagamento e ordem do catálogo | Destaque vencido, empate em ordem alfabética, 500 vendedores |
| `unit/busca.test.mjs` | Busca do catálogo e do cardápio | Sem acento e sem maiúsculas, todas as palavras, modos "nome da loja" x "produto" x "tudo", busca vazia |
| `unit/imagem.test.mjs` | Logo e banner | Recorte centralizado nas duas proporções, imagem minúscula, tipos aceitos, limite de 15 MB, caminho do arquivo no Storage |
| `unit/destaques.test.mjs` | "Destaque da casa" x "Mais pedido" | Item indisponível sem selo, sem repetir item, máximo de 5, mensagem do WhatsApp com o item (`&` e `#` no nome) |
| `unit/pedidos.test.mjs` | Pedido pelo site | Total com taxa e centavos, status e botões por modo, mensagem de erro sem código técnico, resumo do WhatsApp **sem o link do pedido**, validação do pedido e da configuração, entradas hostis |
| `unit/carrinho.test.mjs` | Carrinho do pedido | Limites de 20 por item e 30 linhas, texto guardado quebrado ou adulterado, `__proto__`, o banco recebe só id e quantidade |
| `unit/categoriasProduto.test.mjs` | Categorias do menu e filtro "Tipo de produto" | Seções na ordem do vendedor, itens sem categoria no fim, filtro juntando lojas pela chave, "suco" + Bebidas no mesmo item, modos Tudo / Nome da loja / Produto |
| `unit/montaveis.test.mjs` | "Monte o seu" (pizza, açaí...) | Preço do tamanho que não muda com o sabor, adicionais somados sem erro de centavo, limite de escolhas por tamanho dizendo quantas tirar, escolha obrigatória só nos tamanhos que incluem, chave do carrinho igual para a mesma montagem em qualquer ordem, descarte do que deixou de valer, o banco recebe só ids, texto dos detalhes e do WhatsApp, validação do cadastro, entradas hostis |
| `unit/meusPedidos.test.mjs` | "Meus pedidos" (lista no navegador) e carrinhos pela metade | Registro estragado ou adulterado (token, loja, número, valor, data), sem repetir, no máximo 30 do mais novo ao mais antigo, `__proto__`, HTML no nome da loja, carrinhos de todas as lojas, vazio ou quebrado não conta |
| `unit/validacao.test.mjs` | Mensagens de validação e máscara do WhatsApp | Confere o **texto exato** de cada mensagem (diz o que corrigir e como), limites de tamanho, datas impossíveis, preços, entradas hostis |
| `api/01-campos-inexistentes` | Campos/tabelas/funções que não existem; *mass assignment* | Colunas fantasma, `is_admin`, troca de dono, auto-aprovação, metadados `role`, JWT forjado |
| `api/02-validacao-banco` | Última barreira: o banco recusa dado inválido mesmo sem a tela | Violações de CHECK, enum, FK, duplicidade, payload de 1 MB |
| `api/03-autorizacao` | Isolamento entre visitante, vendedor A/B e admin; Storage | RLS em todas as tabelas, upload na pasta alheia, HTML/arquivo > 5 MB, `..` no caminho |
| `api/04-fluxos-rpc` | Avaliação por código, denúncia, métricas, histórico | Código usado/expirado/de outro vendedor, corrida de 10 usos simultâneos |
| `api/06-cidades` | Fase 4: várias cidades | Cidade herdada do bairro, unicidade de bairro por cidade, RLS de cidades, filtro por cidade |
| `api/07-privacidade-e-conta` | LGPD: aceite, retenção e exclusão | Prazos da `limpar_dados_antigos()`, exclusão completa da conta, o que é preservado |
| `api/08-feedback` | Fale conosco | Tipo e tamanhos inválidos, HTML e emoji, limite de 5 por hora, fila cheia, RLS (só admin lê e trata), retenção de IP e contato |
| `api/09-senha` | Troca de senha pela sessão | Nova senha entra e a antiga não, mesma senha, sem sessão, função de e-mail por usuário não pública |
| `api/10-item-indisponivel` | "Indisponível hoje" | Regra do banco (data só com item indisponível), quem pode mudar, o cliente enxerga o selo |
| `api/11-origem-visitas` | Origem das visitas | Origem fora da lista vira nula, chamada antiga, resumo só do próprio vendedor, janela de dias |
| `api/12-resumo-cidades` | Resumo do admin por cidade | Só administrador, contagens por cidade, perfil completo, soma fecha com o total de visitas |
| `api/13-exportar-dados` | "Baixar meus dados" (LGPD) | Só dados próprios, sem denúncias, código secreto, IP ou dados de outro vendedor |
| `api/14-convites-avaliacao` | Avaliação por convite | Só o servidor cria; o banco guarda só hashes; e-mail próprio; limites; uso único em paralelo; expiração; retenção |
| `api/15-metricas-sem-o-dono` | Métricas sem o dono | Visita e toque do dono não contam; cliente, outro vendedor e admin contam |
| `api/16-link-de-pedidos` | Link de pedidos próprio | Regras do banco, quem pode mexer, remoção pelo admin e histórico, evento `link_pedido` |
| `api/17-aceitar-termos` | Novo aceite dos Termos | Só o próprio registro, formato da versão, nenhum outro caminho de escrita |
| `api/18-resumo-avaliacoes` | Nota média e total | Só avaliações aprovadas, loja sem avaliação publicada fora da view, sem comentário na view |
| `api/19-configuracoes-e-nome` | Aprovação configurável e nome do avaliador | Só o administrador lê e muda, linha única, avaliação e vendedor novos com a aprovação ligada e desligada, nome opcional, limpo e sem site/e-mail/telefone, convite não gasto por nome ruim |
| `api/20-logo-e-banner` | Logo e banner | Só endereço do nosso Storage, só o dono troca, pasta isolada, SVG recusado |
| `api/21-sugestao-de-bairros` | Sugestão de bairro | Nome sem acento não duplica, limite diário, aprovar/juntar/recusar valendo para todos os que pediram o mesmo, só administrador, juntar bairros |
| `api/22-mais-pedidos` | Destaques e toques em "Pedir" | Limite de 3 por loja, item de outra loja, dono não conta, mesma pessoa uma vez por hora, 5 toques para virar "mais pedido", janela de 30 dias, relatório só do dono |
| `api/23-pedidos-pelo-site` | Pedidos pelo site | Loja aberta agora (fuso, virada da noite, data especial, férias), valor calculado e congelado, loja fechada, item indisponível, modo e pagamento, limites por telefone e por origem, recusar e bloquear, link do cliente, transições de status, quem lê dados de clientes (nem o admin), avaliação do pedido, "mais pedido" por volume, retenção de 90 dias |
| `api/24-categorias-de-produto` | Categorias de produto | Chave sem acento e plural, sem repetir na mesma loja (mas lojas diferentes podem), limite de 15, item só na categoria da própria loja, apagar categoria não apaga item, quem vê e quem muda (nem o admin vê além do que pode), baixar meus dados |
| `api/25-monte-o-seu` | "Monte o seu" | Cadastro (limites de 5 produtos, 6 tamanhos e 30 adicionais, preços e nomes inválidos), cada loja só mexe nos seus, categoria só da própria loja, visitante só lê produto de loja no ar, apagar em cascata, histórico, "Baixar meus dados"; pedido: preço do tamanho **igual para qualquer sabor**, adicionais somados, valor congelado com nome e escolhas, quantidade, mistura com item comum, taxa e troco; o banco recusa sabor demais, nenhum sabor quando é obrigatório, repetido, adicional demais, sabor de outra categoria ou loja, indisponível ou "em falta", produto pausado ou de outra loja, formato quebrado, preço enviado pelo cliente (ignorado), pedido grande demais |
| `api/05-plano-destaque` | Pagamento manual e destaque | Soma de períodos, 5 pagamentos simultâneos, cortesia, quem não é admin, valores inválidos |
| `forca-bruta/01-codigos-de-avaliacao` | Adivinhar códigos de avaliação | 500 palpites, IP forjado (`X-Forwarded-For`, `x-real-ip`, `cf-connecting-ip`), botnet |
| `forca-bruta/02-inundacao-e-fuzz` | Inflar métricas/denúncias, leituras em massa, fuzzing | 400 eventos, 200 denúncias, 300 consultas paralelas, 22 textos hostis, corpo de 20 MB |
| `forca-bruta/03-bloqueio-login` | Bloqueio de senha do app (10 erros/conta, 30/IP em 15 min) | Funções do banco + simulação de 500 tentativas paralelas |
| `forca-bruta/99-login` | Ataque direto ao Auth do Supabase | 300 senhas erradas, enumeração de contas por mensagem e por tempo |
| `http/rotas` | Rotas do Next | Redirecionamentos, *open redirect*, XSS, arquivos sensíveis, cabeçalhos, Server Actions forjadas, 300 pedidos simultâneos |

## Achados que estes testes já pegaram (e foram corrigidos)

1. **XSS no JSON-LD** do perfil: nome `</script><img ...>` fechava o `<script>` (o escape do `<` era um no-op).
2. **Limite por IP burlável**: o primeiro valor de `X-Forwarded-For` é forjável. Passou a usar `x-real-ip` / último valor da cadeia.
3. **Palpites de código sem limite**: agora 10 erros/hora por IP e 100/hora por vendedor.
4. **Login sem bloqueio no app**: o Auth local não barrou 300 senhas. Agora 10 erros/conta e 30/IP em 15 min.
5. Função de histórico quebrava ao inserir vendedor (`record "r" has no field`).
6. `X-Powered-By` anunciava o Next; faltavam cabeçalhos de segurança básicos.

## Limitações conhecidas (não dá para fechar só no app)

- **Tempo de resposta do Supabase Auth** é maior para conta existente (≈100 ms) do que para inexistente (≈15 ms),
  então quem ataca o Auth direto pode listar e-mails cadastrados. O site mitiga (tempo mínimo de 400 ms nas falhas).
- **Limite de taxa do Auth** (`sign_in_sign_ups`, 30/5 min/IP) **não foi aplicado no ambiente local**.
  Em produção, confirme no painel do Supabase (Auth → Rate Limits).
- **IP real em produção**: o limite por IP depende de `x-real-ip`/`X-Forwarded-For` chegarem corretos ao Postgres.
  Rode `npm run test:forca-bruta` contra um ambiente de homologação equivalente antes de divulgar. Se todo o tráfego
  chegar com o mesmo IP, o limite vira global (e o bloqueio de uma pessoa trava todas).
- O fluxo da Server Action `entrar` (tela → bloqueio → Auth) não é chamado ponta a ponta por HTTP; testamos suas peças
  (validação, funções de bloqueio, Auth). Um teste E2E com navegador seria o próximo passo.

## Convenções

- Cada arquivo cria os próprios dados com `Contexto` (em `helpers.mjs`) e limpa tudo no `after`.
- Os limites por IP persistem por 1 hora no banco; `zerarLimites()` os reinicia entre os testes.
- `--test-concurrency=1` é obrigatório: os arquivos compartilham o mesmo IP local e os mesmos contadores.
- Ao criar uma regra nova de validação, edite `src/lib/validacao.ts` e acrescente o caso em `unit/validacao.test.mjs`.
