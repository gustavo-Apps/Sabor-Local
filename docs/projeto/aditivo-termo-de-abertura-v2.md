# Aditivo ao Termo de Abertura: versão 2.x (pedidos pelo site)

[← Voltar ao índice da documentação](../../README.md#documentação)

Este aditivo registra a **mudança de escopo** que o [roadmap](../roadmap.md) exigia antes de iniciar a versão 2.x. Ele não altera o
arquivo original [Termo de Abertura - Sabor Local.docx](<Termo de Abertura - Sabor Local.docx>): complementa o documento até que
ele seja revisado e reassinado. O Termo diz (seção 12) que alterações relevantes de escopo devem ser registradas em versão revisada.

| Item | Descrição |
|---|---|
| Projeto | Sabor Local |
| Documento | Aditivo nº 1 ao Termo de Abertura |
| Assunto | Pedidos pelo site (versão 2.x) |
| Situação | **Proposto**, aguardando aprovação do gerente do projeto e do patrocinador |
| Data | ____ / ____ / ________ |

## 1. O que muda

O Termo (seção 4.1) previa o botão do WhatsApp com mensagem pré-preenchida como único caminho de pedido. A versão 2.x
**acrescenta** o pedido pelo site: o cliente monta o pedido no perfil do vendedor e o site o grava e o repassa.

**Passa a estar dentro do escopo:**

- Escolher produtos e quantidades no perfil do vendedor, com o **valor calculado pelo site** (preço do cardápio x quantidade, mais a
  taxa de entrega que o vendedor definir). O cliente nunca digita o valor.
- Informar entrega ou retirada, nome, telefone, endereço (na entrega), **meio de pagamento escolhido** (Pix, dinheiro com troco ou
  cartão na entrega ou na retirada) e observações.
- Gravar o pedido, avisar o vendedor, acompanhar o status (novo, em preparo, saiu para entrega ou pronto para retirar, concluído,
  cancelado) em painel simples, e o cliente acompanhar por um link, sem criar conta.
- Só aceitar pedido com a loja aberta e com item disponível; limitar pedidos por pessoa; o vendedor poder recusar e bloquear um telefone.
- O pedido concluído permitir a avaliação (verificação de compra) e alimentar o selo "Mais pedido".
- Números de pedidos por vendedor e período para o vendedor e para o administrador.
- Tratamento de dados pessoais do cliente (nome, telefone, endereço) com prazo de retenção.

## 2. O que continua fora do escopo

Mantém-se o que o Termo (seção 4.2) já excluía:

- **Processamento e recebimento de pagamentos pela plataforma.** O "meio de pagamento" é só uma escolha informada no pedido; o
  pagamento continua direto entre cliente e vendedor, como na premissa original. Cobrança online (por exemplo Pix com confirmação
  automática) seria outra decisão de escopo.
- **Logística de entrega própria.** Quem entrega é o vendedor. A plataforma não calcula frete por distância nem tem entregadores.
- **Aplicativo nativo.**
- Opções complexas por item (tamanho e sabores da pizza, adicionais): hoje o item sem preço fixo entra como "sob consulta" e o cliente
  descreve o resto nas observações. Opções por item ficam para uma etapa futura.

## 3. Premissas e restrições

- O pedido pelo site é **opcional por loja**: o vendedor liga quando quiser; desligado, o perfil continua só com o WhatsApp.
- O pedido pelo site **não substitui** o WhatsApp: após enviar, o cliente é convidado a avisar a loja pelo WhatsApp com o resumo pronto.
- A responsabilidade por preço, prazo, entrega, troca e cancelamento continua do vendedor (Termos de Uso, seção 5).
- Cidade pequena, pessoas simples: poucos passos, textos claros, tudo funcionando no celular.

## 4. Riscos novos e como são tratados

| Risco | Tratamento |
|---|---|
| Pedido falso ou trote | Limite por pessoa (3 por hora por telefone e por loja, 5 por hora por origem), pedido só com a loja aberta, recusar e bloquear telefone, pedido sem resposta vence em 3 dias |
| Dados pessoais de clientes (LGPD) | Só a loja do pedido lê nome, telefone e endereço; o administrador vê só números; dados pessoais saem 90 dias depois do encerramento; histórico sem dado pessoal; Política de Privacidade e Termos atualizados |
| Vendedor se avaliar sozinho | O link do pedido é só do cliente e nunca vai para a loja (nem no resumo do WhatsApp) |
| Preço alterado depois do pedido | Nome e preço do item ficam "congelados" no pedido |
| Valor manipulado pelo cliente | O banco recalcula o valor; o site só envia o id do item e a quantidade |
| Vendedor sem costume com painel | Pedido desligado por padrão; o resumo no WhatsApp continua suficiente; validar com 3 a 5 vendedores reais antes de divulgar |
| Responsabilidade por entrega e atraso | Continua do vendedor; os Termos de Uso dizem isso |

## 5. Critérios de sucesso do aditivo

- Pelo menos 3 vendedores reais usando os pedidos pelo site por 30 dias, sem pedido perdido (o vendedor vê todos).
- Pedidos concluídos gerando avaliações verificadas.
- Nenhum incidente com dados de clientes.
- Os vendedores que testaram dizem que o painel de pedidos é mais simples do que só o WhatsApp (ou então a versão volta a ser opcional e escondida).

## 6. Aprovação

Este aditivo autoriza o início da versão 2.x nas condições descritas. Alterações relevantes devem ser registradas em novo aditivo.

______________________________________
Gerente do projeto

______________________________________
Patrocinador / sócio

Data: ____ / ____ / ________
