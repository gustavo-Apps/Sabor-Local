# Operação do dia a dia (para quem administra)

[← Voltar ao índice da documentação](../README.md#documentação)

Guia curto para a rotina de suporte e moderação. Tudo é feito no painel `/admin`. Para publicar o site, veja
[producao.md](producao.md); para abrir uma cidade, [manual-de-expansao.md](manual-de-expansao.md).

## Tornar-se administrador

Crie uma conta de vendedor normalmente pelo site (aba "Criar conta" em `/login`) e confirme o e-mail. Depois rode no
SQL Editor (no Studio local, `http://127.0.0.1:54323`, ou no painel do Supabase em produção):

```sql
insert into admins (user_id)
select id from auth.users where email = 'seu-email@exemplo.com'
on conflict do nothing;
```

Ao entrar em `/painel`, aparece a faixa "Você é administrador" com o link para `/admin`. Para tirar o acesso:
`delete from admins where user_id = (select id from auth.users where email = '...');`

## Rotina semanal

1. **Resumo:** o topo mostra o que precisa de atenção (vendedores para aprovar, denúncias abertas, avaliações pendentes).
2. **Vendedores:** aprove os novos (antes, dá para chamar no WhatsApp pelo próprio painel e conferir o conteúdo).
3. **Denúncias:** marque como resolvida, descarte, suspenda o vendedor ou remova a avaliação denunciada.
4. **Avaliações:** aprove ou remova as pendentes (o nome de quem avaliou, se informou, aparece ao lado; sem nome, é "anônimo").
   Toda avaliação chega por um convite enviado ao e-mail do cliente; o vendedor não vê o link, não pode convidar o próprio
   e-mail e só convida o mesmo e-mail uma vez a cada 30 dias.
5. **Cidades → Sugestões de bairro:** vendedores que não acharam o bairro na lista sugerem um. **Aprove** (cria o bairro),
   **junte** com um que já existe ou **recuse**. A decisão vale para todos que sugeriram o mesmo nome.
6. **Indicadores:** acompanhe as metas do roadmap (visitas, toques no WhatsApp, vendedores ativos, pagantes).

## Situações comuns

| Situação | O que fazer |
|---|---|
| Cliente achou erro numa página de vendedor | O perfil tem **Reportar um problema no site**, que leva ao Fale conosco com o endereço da página já preenchido (aparece em `/admin` → Feedback como "Página: ..."). **Denunciar** é outra coisa: é contra o vendedor ou a avaliação e cai na aba Denúncias |
| Vendedor reclama que "sumiu" do catálogo | `/admin` → Vendedores: veja se está suspenso ou com aviso de férias ativo; use **Limpar aviso** se for o caso |
| Algo foi alterado por engano | `/admin` → Histórico mostra quem mudou o quê e quando; filtre por vendedor com **Ver histórico** |
| Cliente diz que não recebeu o convite de avaliação | Peça para olhar o spam. O vendedor vê o convite na aba Clientes (com o e-mail mascarado) e pode **cancelar** e enviar outro. O link não é mostrado a ninguém, nem a você |
| Vendedor quer avaliação de um cliente sem e-mail | Não há como: o link só vai por e-mail, justamente para o vendedor não conseguir se avaliar |
| Dar ou renovar destaque | Vendedores → abra **Plano destaque: registrar pagamento**, escolha dias, valor e forma (Pix, dinheiro ou Cortesia). Renovar antes de vencer soma a partir do fim do período atual |
| Dar destaque de cortesia (parceria, teste) | Forma **Cortesia**, valor zero: dá destaque, mas não conta como pagante nem como receita |
| Tirar o destaque na hora | Link **Remover destaque agora** no mesmo formulário |
| Conferir os pagamentos recebidos | Aba **Financeiro** (lista e total) |
| Cidade nova ou bairro novo | Aba **Cidades**: criar a cidade e adicionar os bairros |
| Perfil com link de pedidos suspeito (golpe, site que não abre, conteúdo impróprio) | `/admin` → Vendedores: o link aparece no cartão do vendedor; clique em **Remover link de pedidos**. Fica no histórico. Se for golpe, suspenda também o vendedor |
| Vendedor pede para sair | Ele mesmo exclui a conta em `/painel` → Perfil → "Excluir minha conta" (apaga perfil, menu, arquivos e login) |

## Configurações: exigir ou não a sua aprovação

Em `/admin` → **Configurações** há dois interruptores, cada um com "Exigir aprovação" (o padrão) ou "Liberar direto":

| Interruptor | Exigir aprovação | Liberar direto |
|---|---|---|
| **Avaliações** | A avaliação só aparece no perfil depois que você aprovar | Aparece assim que o cliente envia (continua valendo só para quem recebeu o convite por e-mail) |
| **Criação de vendedores** | O perfil novo fica oculto até você aprovar | O perfil novo já aparece no catálogo assim que o vendedor salvar |

- A mudança vale só para o que **chegar depois**; o que já está na fila continua esperando você.
- Liberado não é sem controle: dá para **remover** qualquer avaliação, **suspender** qualquer vendedor e tirar logo, banner ou
  link de pedidos de um perfil, e as denúncias continuam chegando.
- A tela mostra quando foi a última alteração. O que muda no banco fica no registro de `configuracoes` (quem e quando).

## Logo e banner

O vendedor envia a logo (quadrada) e o banner (faixa larga) em `/painel` → Perfil. As imagens vão para o Storage, na pasta do
dono. Se aparecer algo impróprio ou que não é dele, vá em `/admin` → Vendedores: a imagem aparece no cartão do vendedor, com
**Remover logo** e **Remover banner** (o arquivo também é apagado). Se for caso de suspensão, suspenda o vendedor também.

## Pedidos pelo site (versão 2.x)

O vendedor liga em `/painel` → **Pedidos** ("Quero receber pedidos pelo site"), escolhe os meios de pagamento e a taxa de entrega.
Com isso, o perfil dele ganha **Adicionar** nos itens e o cartão do catálogo mostra "Pede pelo site", mas só **com a loja aberta**.

- **O site não cobra nem recebe dinheiro.** O meio de pagamento é só uma escolha informada; o acerto é direto com a loja.
- Fluxo: o cliente envia o pedido, a loja vê em Pedidos (o número vermelho na aba mostra os novos), muda o andamento (começar a
  preparar, saiu para entrega ou pronto para retirar, concluir) e o cliente acompanha por um link. Depois de concluído, ele pode avaliar.
- **Você, administrador, não vê nome, telefone nem endereço de clientes.** O Resumo mostra só números (pedidos, concluídos,
  cancelados, valor concluído e as lojas com mais pedidos). Dúvida de cliente se resolve com a própria loja.
- **Pedido falso ou trote:** a loja usa **Cancelar ou recusar este pedido** e **Recusar e bloquear este telefone** (o bloqueio vale só
  naquela loja e dá para desfazer em "Telefones bloqueados"). O site também limita pedidos por pessoa.
- **Privacidade:** nome, telefone e endereço saem do pedido 90 dias depois de ele ser encerrado; pedido novo que a loja não responde
  vence em 3 dias. A limpeza é a mesma rotina diária (`limpar_dados_antigos`).
- Se uma loja reclamar que "o pedido não entrou": confira se ela estava **aberta** (horário, data especial, férias ou "não abre hoje"),
  se o item estava disponível e se o cliente não passou do limite de pedidos por hora. O cliente vê a mensagem do motivo.
- Para desligar de vez (por exemplo, abuso), suspenda o vendedor em `/admin` → Vendedores; o perfil sai do ar e para de receber pedidos.

## Itens em destaque

- **Destaque da casa:** o vendedor escolhe até 3 itens (aba Menu). É escolha dele, e o site diz isso.
- **Mais pedido:** não se escolhe. Aparece sozinho em itens com pelo menos **5 toques** em "Pedir" de pessoas diferentes nos
  últimos 30 dias (a mesma pessoa conta uma vez por hora; o dono da loja não conta). O site não processa pedidos, então é
  medida de interesse, e por isso o selo não se chama "mais vendido".
- Item "Indisponível hoje" não ganha selo nem aparece na seção de destaques.

## Categorias do menu

Em `/painel` → **Menu**, o vendedor pode (se quiser) criar categorias como Bebidas, Salgados, Doces, Xis ou Cachorro quente e escolher a
de cada item. É opcional e individual: quem não cria nenhuma continua com o menu em lista única.

- No catálogo, o filtro **Tipo de produto** junta as categorias de todas as lojas pelo nome (sem acento, maiúsculas e plural simples).
  Se uma loja escrever "Bebida" e outra "Bebidas", vira um filtro só.
- Uma categoria só existe se tiver item: sem produto, ela não aparece no filtro do catálogo.
- Categoria com nome impróprio: o banco permite ao administrador apagá-la (`delete from categorias_produto where id = '...'`);
  os itens ficam sem categoria. Se virar problema frequente, vale criar uma tela para isso.

## Monte o seu (pizza, açaí, marmita...)

Em `/painel` → **Menu**, o vendedor pode criar produtos que o cliente **monta**: o preço depende do **tamanho** e o cliente escolhe o que
vai nele. É opcional e individual.

1. O vendedor cria **categorias** (ex.: "Pizzas salgadas", "Pizzas doces") e cadastra os sabores como itens delas (podem ficar sem preço).
2. Cria o produto (modelos prontos: Pizza, Açaí, Marmita, Sorvete) e adiciona os **tamanhos** com preço e "inclui" (quantas escolhas cabem).
3. Marca de **quais categorias** vêm as escolhas e, se quiser, cadastra **adicionais pagos**.

O perfil passa a mostrar o cartão **Monte o seu** no topo do cardápio. O painel mostra "Falta configurar" enquanto faltar tamanho ou
categoria, e o produto só aparece para o cliente quando dá para montar. Dúvidas comuns:

- **O produto não aparece no perfil:** confira se está **pausado**, se tem ao menos um tamanho e se as categorias marcadas têm itens
  **disponíveis** (sabor "Indisponível hoje" sai da escolha). Se o tamanho incluir 0 escolhas, não precisa de categoria.
- **O sabor aparece sem botão de pedir:** é de propósito. Sabor sem preço só se pede dentro do "Monte o seu".
- **Acabou um adicional:** botão **Acabou** na lista de adicionais; **Voltou** traz de volta.
- **Apagar o produto** apaga tamanhos, adicionais e vínculos, mas **não** apaga os itens do menu. Pedidos antigos continuam como estavam.
- **Nome impróprio:** o banco impede site e e-mail nos nomes; o administrador pode editar ou apagar qualquer produto montável
  (`delete from montaveis where id = '...'`).
- Dados dos exemplos: `supabase/seed.sql` cria a **Pizzaria do Bairro** (pedidos pelo site) e o **Açaí do Zé** (só WhatsApp).

## Meus pedidos (cliente)

Como o cliente **não tem conta**, o site guarda no **navegador dele** (e só lá) a lista dos pedidos que ele fez e dos carrinhos que ele começou e
não finalizou. O link **Meus pedidos** aparece no cabeçalho só para quem tem algo guardado; a página mostra **Em andamento**, **Pedidos não
finalizados** (com "Continuar pedido") e **Pedidos anteriores**, com o status vindo do banco. Enquanto a página está aberta, só os pedidos **em andamento** são consultados de novo (a cada 30 segundos); pedido concluído ou cancelado é consultado uma vez só.

- O pedido entra na lista quando a pessoa abre o link dele (logo depois de pedir, ou ao abrir o link mais tarde, inclusive vindo do WhatsApp).
- A lista **não é sincronizada**: quem limpa os dados do navegador, usa outro navegador ou troca de celular perde a lista (o link do pedido
  continua valendo). Quem reclamar "não acho meu pedido" no mesmo aparelho: peça para abrir **Meus pedidos** no mesmo navegador.
- Guarda no máximo 30 pedidos. Pedido que saiu do ar (apagado pela retenção) sai da lista sozinho. A pessoa pode tirar um pedido ou
  limpar a lista (aparelho compartilhado).
- O que fica guardado: o link secreto, a loja, o número e o valor. Nada de nome, telefone ou endereço.

## Métricas e a conta do vendedor

Quando o vendedor está **logado** e abre ou toca na **própria loja**, a visita e o toque não são contados (o banco descarta o
evento). Ele vê o selo "Sua loja" na lista e um aviso no perfil. Isso vale para a conta dele; se você, administrador, também for
dono de uma loja, vale para a sua loja. Para testar os números como cliente, abra a página **sem entrar** (janela anônima).

## Fale conosco (problemas, sugestões e dúvidas)

Qualquer pessoa escreve em `/feedback` (link **Fale conosco** no rodapé; no painel do vendedor, **Ajuda**). As mensagens
chegam em `/admin` → **Feedback**, com um número vermelho quando há novas.

**Nada vai para o GitHub sozinho.** Para cada mensagem:

1. **Leia.** Se for dúvida, responda pelo contato informado (se a pessoa deixou) e marque como **Recusar** ou **Aceitar**
   conforme o caso.
2. **Vale a pena?** Clique em **Abrir issue no GitHub**: o GitHub abre com título, texto e rótulo (`bug`, `enhancement` ou
   `question`) preenchidos. Confira, ajuste e envie. O contato de quem escreveu **não** vai junto, porque a issue pode
   virar pública.
   Para **responder** a quem deixou contato, use o botão **Responder**: ele abre o WhatsApp (ou o e-mail) com um texto-base que
   cita a mensagem; revise e envie. Se não aparecer o botão, a pessoa não deixou um contato válido.
3. Volte ao painel e clique em **Aceitar** (cole o link da issue, se quiser guardar). A mensagem passa a "aceita".
4. Quando a issue for resolvida, clique em **Marcar como resolvida**. Mensagens **recusadas** saem da lista.

Proteções: no máximo 5 mensagens por hora por pessoa, 1000 caracteres, e a fila para de aceitar novas se chegar a 300
sem leitura. Mensagens tratadas são apagadas em 12 meses; o contato some em 180 dias (veja a seção abaixo).

> O link da issue só funciona para quem tem acesso ao repositório. Enquanto ele for privado, só você abre as issues, e
> quem escreveu não as vê.

## Quando os Termos ou a Política mudarem

Depois de revisar os textos (e a revisão jurídica), mude `TERMOS_VERSAO` e `TERMOS_DATA` em `webapp/src/lib/legal.ts` (ex.:
`"2027-03"`). No próximo acesso ao painel, cada vendedor vê uma tela com a versão nova e só continua depois de marcar que leu e
aceita; a data e a versão do aceite ficam no perfil dele. O catálogo público não é afetado. Mudanças pequenas (erro de português)
não precisam de nova versão.

## Dados pessoais e retenção

**Pedido de cópia dos dados:** o próprio vendedor baixa em **Perfil → Baixar meus dados** (arquivo JSON com a conta, o perfil,
os horários, o menu, as avaliações recebidas, os pagamentos do destaque e o uso do perfil). Fica fora o que identifica
terceiros: denúncias recebidas e o código secreto das avaliações. Se alguém pedir por fora do site, peça que entre na conta e
baixe; se não conseguir entrar, confirme a identidade antes de qualquer envio. Para **excluir** a conta, o caminho é
**Perfil → Excluir minha conta**.

A limpeza de dados antigos é automática e diária (`limpar_dados_antigos()`), com os prazos da Política de Privacidade:
tentativas de login e de código e IPs em 7 dias, contato de quem denunciou 180 dias depois de a denúncia ser tratada,
métricas em 25 meses, histórico em 2 anos. Se o agendamento (`pg_cron`) estiver desligado, a limpeza **não roda**: veja
[producao.md](producao.md), seção 1.
