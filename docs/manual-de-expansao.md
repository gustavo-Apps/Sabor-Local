# Manual de expansão: levando o Sabor Local para uma nova cidade

[← Voltar ao índice da documentação](../README.md#documentação)

Este é o passo a passo para abrir uma cidade nova (Fase 4 do roadmap). O processo foi pensado para ser feito por uma
pessoa, de forma remota ou com um parceiro local, sem mexer em código. **Registre ao final o que funcionou e o que não
funcionou**: este documento deve melhorar a cada cidade aberta.

> Critério de sucesso do roadmap: uma cidade vizinha com a plataforma ativa e uma base inicial de vendedores cadastrada.

## 1. Escolher a cidade

Procure o mesmo perfil da cidade-piloto:

- Cidade pequena, **sem cobertura de iFood** e similares.
- Dezenas de vendedores de comida vivendo de boca a boca (lanches, marmitas, doces, salgados, pizzas).
- **Alguém de confiança na cidade**: parceiro, associação comercial, comunicação local ou um vendedor que indique os outros.
- Distância que permita apoio presencial no começo (visita para o cadastro assistido).

Anote: população aproximada, nº estimado de vendedores, bairros principais e quem será o parceiro local.

- [ ] Cidade escolhida e parceiro local definido

## 2. Cadastrar a cidade e os bairros (5 minutos)

1. Entre em `/admin` → aba **Cidades**.
2. **Nova cidade**: nome (ex.: Santa Maria), UF (RS). O endereço (slug) é gerado do nome.
3. Abra "Editar cidade e bairros" e **adicione os bairros**, um por um (peça a lista ao parceiro local).
4. A cidade já nasce **ativa**. Com mais de uma cidade ativa, o site mostra o **seletor de cidade** na página inicial e
   o vendedor escolhe a dele no cadastro.

Cuidados:
- Use o nome oficial e sem abreviar. O mesmo bairro não pode se repetir na mesma cidade (a comparação ignora maiúsculas).
- Dá para desativar uma cidade (ela some do seletor), mas o site sempre mantém pelo menos uma ativa.
- Não existe exclusão de cidade com bairros: desative em vez de apagar.

- [ ] Cidade e bairros cadastrados em `/admin`

## 3. Cadastro assistido dos primeiros 10 a 15 vendedores

Os primeiros vendedores não vão se cadastrar sozinhos; o cadastro assistido é o que dá partida na cidade.

**Abordagem (10 a 15 minutos por vendedor):**

1. Explique em uma frase: "É uma vitrine gratuita da cidade; o cliente vê seu cardápio e chama você no WhatsApp. Não cobramos
   comissão e você continua vendendo do seu jeito."
2. Peça o **WhatsApp**, o **bairro**, os **horários** e **fotos do cardápio** (pode ser uma foto da lista de preços).
3. Crie a conta com o vendedor (e-mail dele; o link de confirmação chega nesse e-mail) ou peça que ele crie na hora, pelo
   celular, em `/login`. Ele precisa **ler e aceitar** os Termos e a Política de Privacidade (checkbox do cadastro).
4. Preencha o perfil junto: cidade, bairro, ramos, descrição curta, horários e, se houver, o PDF ou a foto do cardápio.
5. Mostre o **botão "Não abro hoje"** e o **QR code** (aba Clientes), que ele pode imprimir.
6. Anote o contato dele e combine uma revisão em 2 semanas.

**Se o vendedor não tem e-mail:** crie um e-mail para ele ou use o seu como apoio **somente no início**, e oriente a trocar
depois (o vendedor precisa ser dono da conta para a LGPD e para recuperar o acesso).

Meta por cidade: **10 vendedores com perfil completo antes do lançamento** (nome, WhatsApp, bairro, horários, menu ou PDF).

- [ ] 10 perfis completos
- [ ] Todos aprovados em `/admin` → Vendedores (confira WhatsApp e conteúdo antes de aprovar)

## 4. Validação rápida (opcional, mas recomendada)

Antes de divulgar, faça 5 a 8 conversas curtas com moradores (incluindo quem chegou há pouco tempo à cidade):

- Como você descobre onde comer hoje?
- Você já deixou de pedir por não saber o que existe?
- Se visse um catálogo com horário, cardápio e WhatsApp, usaria? O que faltaria?

E com 3 a 5 vendedores já cadastrados: o que ficou confuso no painel? Ajuste os textos e anote para o produto.

## 5. Lançamento local

- **Grupos de WhatsApp** da cidade e dos bairros (peça ao parceiro local e aos próprios vendedores que compartilhem).
- **QR codes** impressos nos pontos de venda parceiros (cada vendedor gera o dele em `/painel` → Clientes).
- **Instagram/Facebook local**: poste "Descubra o que sua cidade tem de bom" com 3 a 4 vendedores em destaque.
- Mensagem pronta para os grupos: "Já conhece o Sabor Local? Cardápios, horários e WhatsApp de quem vende comida em
  *{cidade}* num só lugar: {link}".
- O link da cidade é `https://seu-site/?cidade={slug}`.

## 6. Acompanhar nas primeiras semanas

No `/admin` → **Resumo**:

| Indicador | Meta do roadmap (por mês, a partir do 6º) |
|---|---|
| Visitas ao catálogo | 500 ou mais |
| Toques no WhatsApp | 100 ou mais |
| Vendedores ativos | 25 a 30 |
| Avaliações publicadas | 50 ou mais |

> Os quatro indicadores acima são do **site inteiro**. Para a cidade nova, use o bloco **Por cidade** do mesmo Resumo:
> vendedores ativos, pendentes e suspensos, **perfis completos** (meta de 10 antes de divulgar), perfis em destaque,
> visitas aos perfis e toques no WhatsApp dos últimos 30 dias e avaliações publicadas. Cada cidade ganha uma situação:
> *Montando a base*, *Pronta para divulgar* (10 perfis completos), *Precisa de atenção* (4 semanas ou mais com menos de 5
> vendedores ativos, como no item 7 abaixo) ou *Pausada*. A visita ao catálogo (home) não tem cidade, por isso não entra aí.

Rotina semanal: aprovar vendedores novos, tratar denúncias e avaliações pendentes, lembrar quem está com cardápio ou
horário desatualizado (o aviso "Não abro hoje" e as datas especiais ajudam a evitar informação velha).

## 7. Quando uma cidade não decola

- Menos de 5 vendedores ativos depois de 4 semanas: reforce o parceiro local e visite os vendedores de maior movimento.
- Visitas baixas com muitos vendedores: o problema é divulgação; refaça os QR codes e os grupos.
- Muitos vendedores sem WhatsApp respondendo: converse com eles; um perfil que não responde derruba a confiança.
- Pause a cidade (desative em `/admin` → Cidades) em vez de apagar, e registre o motivo abaixo.

## 8. Checklist resumido de uma nova cidade

- [ ] Cidade escolhida e parceiro local definido
- [ ] Cidade e bairros cadastrados em `/admin`
- [ ] 10 vendedores com perfil completo, aprovados
- [ ] Conversas de validação feitas (opcional)
- [ ] QR codes impressos e grupos de WhatsApp avisados
- [ ] Indicadores acompanhados semanalmente nas 4 primeiras semanas
- [ ] Lições registradas abaixo

## Registro de lições aprendidas

Preencha a cada cidade aberta.

| Cidade | Data de abertura | Vendedores no mês 1 | O que funcionou | O que não funcionou |
|---|---|---|---|---|
| (cidade-piloto) | | | | |
