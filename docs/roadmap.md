# Roadmap do Sabor Local

[← Voltar ao índice da documentação](../README.md#documentação)

Plano de evolução do produto. O plano original de 12 meses está em
[projeto/Roadmap - Sabor Local.docx](<projeto/Roadmap - Sabor Local.docx>). Este arquivo reúne, em um só lugar, o status
de cada fase, a checklist item a item, a conformidade com o Termo de Abertura e o que vem a seguir.

**Neste arquivo:** [Onde estamos](#onde-estamos) · [O que falta](#o-que-falta) · [O que já foi feito](#o-que-já-foi-feito) ·
[Conformidade com o Termo](#conformidade-com-o-termo-de-abertura) · [Avaliação](#avaliação-do-projeto-outubro2026) ·
[Mercado](#integrações-e-diferenciais-de-mercado) · [Versão 0.9 e 1.0](#versionamento-de-09-a-10) ·
[Próxima fase](#próxima-fase) ·
[Versão 2.x](#versão-2x-pedidos-pelo-site-finalização-do-desenvolvimento)

> **Versão atual: beta.** O que está nas fases 0 a 4 e na "Próxima fase" compõe a beta. Os **pedidos pelo site**
> são a **versão 2.x** (seção "Versão 2.x" ao final): o código está pronto numa branch separada e só deve ir ao ar depois da beta
> validada com vendedores reais e do [aditivo ao Termo de Abertura](projeto/aditivo-termo-de-abertura-v2.md) aprovado.
>
> Princípio de design: cidade pequena, pessoas simples. Poucas opções, textos claros, botões grandes e tudo
> funcionando bem no celular. Cada item abaixo deve passar por esse filtro antes de entrar.

## Onde estamos

| Fase | Período previsto | Situação |
|---|---|---|
| **Fase 0** Descoberta e validação | Semanas 1–6 | Fora do código: entrevistas e teste do protótipo com moradores e vendedores. **Pendente** |
| **Fase 1** MVP | Semanas 7–14 | **Concluída**: catálogo, busca, "aberto agora", perfil, WhatsApp, avaliações com código de compra e aprovação de vendedores |
| **Fase 2** Lançamento e tração | Meses 4–6 | **Concluída no código**: painel do vendedor, métricas, QR code, SEO, administração. Falta testar com vendedores reais |
| **Fase 3** Monetização | Meses 7–9 | **Concluída no código**: plano destaque, pagamento manual (Pix/dinheiro/cortesia) e aba Financeiro. Falta testar o preço com vendedores |
| **Fase 4** Expansão regional | Meses 10–12 | **Concluída no código**: várias cidades e [manual de expansão](manual-de-expansao.md). Falta abrir a primeira cidade vizinha |
| **Versão 0.9** (beta fechada) | Agora | Escopo original pronto; falta publicar e validar. Critérios da **1.0** em [Versionamento](#versionamento-de-09-a-10) |
| **Próxima fase** (abaixo) | A definir | **Concluída no código** (itens 1 a 5). Falta testar com vendedores reais |
| **Versão 2.x**: pedidos pelo site (abaixo) | Depois da beta | **Iniciada no código** (branch `feat/pedidos-pelo-site`): etapas A a E entregues, mais o **"Monte o seu"** (pizza, açaí...; branch `feat/produto-por-tamanho`). Falta validar com vendedores reais e aprovar o [aditivo ao Termo](projeto/aditivo-termo-de-abertura-v2.md) |

Para publicar, siga [producao.md](producao.md). A rotina de quem administra está em [operacao.md](operacao.md).

## O que falta

Tudo o que ainda está em aberto, em um só lugar. O código das fases 1 a 4 está pronto; o que resta é validar com pessoas
reais e fazer as configurações de produção, que dependem das suas contas.

**Validar com pessoas reais**
- [ ] Testar com 3 a 5 vendedores reais e anotar o que confunde (ajustar textos e botões)
- [ ] Testar o preço do plano destaque com os vendedores mais engajados (o valor é digitado a cada registro; não há tabela de preços)
- [ ] Abrir a primeira cidade vizinha seguindo o [manual de expansão](manual-de-expansao.md) (critério do roadmap: cidade ativa com a base inicial de vendedores até o 12º mês)

**Produção, antes de divulgar** (passo a passo em [producao.md](producao.md))
- [ ] Configurar um SMTP próprio para o e-mail de confirmação, porque o padrão do Supabase limita o envio (seção 4)
- [ ] Rodar `webapp/supabase/producao/dados-base.sql` no SQL Editor de produção (seção 2)
- [ ] **Revisão jurídica** dos textos legais e definir `NEXT_PUBLIC_RESPONSAVEL_NOME` e `NEXT_PUBLIC_CONTATO_EMAIL` (o verificador avisa enquanto faltar)
- [ ] Domínio próprio e backup do banco (seções 6 e 10)
- [ ] Definir as variáveis de ambiente na Vercel (seção 5)
- [ ] Criar o administrador em produção (seção 7; o comando também está em [operacao.md](operacao.md))
- [ ] Confirmar em produção o limite de taxa do Auth (Auth → Rate Limits) e qual cabeçalho traz o IP real: rodar `webapp/tests/forca-bruta` em homologação, **nunca** em produção
- [ ] Rodar `npm run verificar:producao -- https://seu-site` depois do deploy e zerar as FALHAS (seção 8)

## O que já foi feito

Clique em uma fase para ver os itens concluídos.

<details>
<summary><strong>Fase 1: MVP</strong> (5 itens)</summary>

- [x] Catálogo, busca, filtro "aberto agora", perfil e WhatsApp
- [x] Avaliações enviadas com moderação
- [x] Aprovação de vendedores novos em `/admin` (o vendedor não consegue se auto-aprovar: trigger no banco)
- [x] Verificação de compra real (código por pedido, uso único, expira em 30 dias)
- [x] Freio contra spam: denúncias limitadas a 5 por hora por IP; avaliações só com código válido

</details>

<details>
<summary><strong>Fase 2: Lançamento e tração</strong> (10 itens)</summary>

- [x] Painel do vendedor com abas: Perfil, Horários, Menu, Cardápio e Clientes
- [x] Upload do cardápio em PDF ou foto (Supabase Storage)
- [x] Administração em `/admin`: resumo, vendedores, denúncias, avaliações e histórico
- [x] Seções de descoberta: destaque da semana, abertos agora, novidades e por bairro
- [x] Métricas: visitas ao catálogo, visitas a perfis e toques no WhatsApp
- [x] Foto por item do menu (comprimida no navegador antes do envio)
- [x] QR code por vendedor para imprimir (aba Clientes)
- [x] SEO básico: títulos por vendedor, `sitemap.xml`, `robots.txt` e dados estruturados
- [x] Horário por data específica, "não abro hoje", férias e histórico de alterações
- [x] Testes automatizados (validação, API, força bruta e rotas) rodando no CI a cada pull request. Ver [testes.md](testes.md)

</details>

<details>
<summary><strong>Fase 3: Monetização</strong> (2 itens)</summary>

- [x] Plano destaque: selo "Destaque" e prioridade na busca (quem tem destaque ativo aparece primeiro; o prazo é `destaque_ate`)
- [x] Cobrança manual: o admin registra o pagamento (Pix, dinheiro ou cortesia) em `/admin` e o destaque é estendido; controle na aba Financeiro

</details>

<details>
<summary><strong>Fase 4: Expansão regional</strong> (1 item)</summary>

- [x] Estrutura para várias cidades: tabela `cidades`, bairros por cidade, vendedor herda a cidade do bairro, seletor de cidade na home (aparece com 2 ou mais ativas), aba Cidades no `/admin` e [manual de expansão](manual-de-expansao.md)

</details>

<details>
<summary><strong>Produção: o que o código já resolve</strong> (2 itens)</summary>

- [x] Dados de base de produção prontos em `webapp/supabase/producao/dados-base.sql` (o `seed.sql` fica só no local)
- [x] Páginas `/privacidade` e `/termos`, aceite no cadastro (versão e data gravadas), exclusão da própria conta e limpeza automática de dados por prazo (`limpar_dados_antigos()`)

</details>

---

## Conformidade com o Termo de Abertura

O escopo previsto na seção 4.1 do [Termo de Abertura](<projeto/Termo de Abertura - Sabor Local.docx>) e como ficou:

<details>
<summary>Ver a tabela de conformidade (12 itens)</summary>

| Escopo do Termo (4.1) | Situação |
|---|---|
| Plataforma web sem instalar app | Feito |
| Perfil, horários, bairro, entrega/retirada | Feito (inclui datas especiais, "não abro hoje" e férias) |
| Cardápio com preços e **fotos** | Feito (itens com foto + arquivo PDF/foto do cardápio) |
| Busca por produto, categoria, bairro + "aberto agora" | Feito |
| WhatsApp com mensagem pré-preenchida | Feito (cliques são contados) |
| Avaliações com nota e comentário | Feito, com moderação em `/admin` |
| **Verificação de compra** | Feito: o vendedor gera um código por pedido; vale uma vez e expira em 30 dias |
| Descoberta: novidades, destaque da semana, por bairro | Feito (página inicial `/`). O destaque é concedido pelo admin (`destaque_ate`) |
| Vendedores "cadastrados e verificados" | Feito: perfil novo fica oculto até o admin aprovar |
| Moderação manual (risco de avaliações falsas) | Feito: aprovação, denúncias e histórico em `/admin` |
| Métricas das metas (visitas e cliques) | Feito: resumo em `/admin` e no painel de cada vendedor |
| Divulgação local (QR codes, Instagram) | QR code por vendedor feito; o restante é fora do código |

</details>

Fora do escopo, e mantido assim: logística de entrega, pagamento na
plataforma, app nativo, outras cidades.

Alterações em relação ao Termo, a registrar em versão revisada dele: login do
vendedor com usuário e senha, vendedor com vários ramos, painel de denúncias e, na versão 2.x, os pedidos pelo site
([aditivo](projeto/aditivo-termo-de-abertura-v2.md)).

---

## Avaliação do projeto (outubro/2026)

Balanço feito com o código das fases 1 a 4 pronto e o repositório ainda privado. É uma leitura do código, dos
documentos e dos testes; **nenhum vendedor ou cliente real usou o produto ainda**, então o que se diz sobre uso é
hipótese. Meta do autor: deixar o projeto **completo**, mesmo que não seja adotado.

**Situação:** código completo e testado (467 testes e CI no PR); segurança bem endereçada; produção ainda não
publicada; validação com pessoas, zero. A cobertura é de API, validação e força bruta, **sem teste de interface**.

### Por persona

| Persona | Pontos fortes | A melhorar |
|---|---|---|
| **Cliente** (morador, inclusive quem chegou há pouco) | Sem cadastro, busca por produto, "aberto agora", botão de WhatsApp | Item indisponível some em vez de aparecer esmaecido; PDF de cardápio é pesado no celular; falta um atalho "o que está aberto agora" |
| **Vendedor** (informal, pouco técnico) | Painel de 5 abas, "Não abro hoje", QR code, gratuito e sem comissão | Cadastro exige e-mail e confirmação (muitos não têm); sem métrica de visitas por canal; sem logo e banner |
| **Administrador / parceiro local** | Aprovação, denúncias, histórico, pagamentos manuais, manual de expansão | Indicadores são do site inteiro, não por cidade; preço do destaque digitado a cada vez; uma pessoa só; sem alerta de erro; backup por configurar |
| **Contribuidor / estudante** | README claro, banco local com um comando, testes e CI, licença MIT | Sem `CONTRIBUTING.md` e sem issues "good first issue"; ruído CRLF/LF no Windows |

### Melhorias a fazer, em ordem

- [ ] **1. Publicar e validar com 3 a 5 vendedores reais.** É o maior risco; nada reduz tanto quanto isso.
- [ ] **2. Cadastro assistido pelo admin**: criar o perfil em nome do vendedor que não tem e-mail, com troca de
  e-mail/dono depois (o vendedor precisa ser dono da conta para a LGPD e a recuperação de acesso).
- [ ] **3. Teste de interface** (Playwright) cobrindo login, cadastro e salvar perfil. O bug dos campos que se
  apagavam depois de um erro (corrigido em `LoginForms.tsx`) não era pego por nenhum teste.
- [ ] **4. Resumo do admin por cidade**, antes de abrir a segunda cidade.
- [ ] **5. Monitoramento e backup** (alerta de erro, monitor de disponibilidade, backup do banco), antes de divulgar.
- [ ] **6. Começar a "Próxima fase" por _Indisponível hoje_ e _Compartilhar_**: são pequenas e atacam as duas
  personas principais.
- [ ] **7. Acabar com o ruído de fim de linha**: um PR **só** com o `.gitattributes` (`* text=auto eol=lf`) e `git add --renormalize .`. Hoje ~100 arquivos estão gravados com CRLF, então o PR mexe em todos; por isso fica separado e deve sair logo depois dos PRs em andamento.
- [x] **8. Contribuição**: `CONTRIBUTING.md`, modelos de issue e de PR e `SECURITY.md`. Falta criar as primeiras issues rotuladas `good first issue` a partir deste roadmap.
- [ ] **9. Dados de demonstração** (`webapp/supabase/producao/dados-demo.sql`) só em ambiente de teste; **remover
  antes de divulgar** com `delete from vendedores where whatsapp like '550099%';`.

### Entregue (PR "Fale conosco", já mergeado)

- [x] **Fale conosco** (`/feedback`): problema, sugestão ou dúvida, com contato opcional. Limite de 5 por hora por pessoa,
  campo-isca contra robôs e fila máxima de 300 novas. Link no rodapé e **Ajuda** no painel do vendedor.
- [x] **Aba Feedback no `/admin`** com aprovação: nada vira issue sozinho. O botão **Abrir issue no GitHub** abre a página
  de nova issue já preenchida (sem o contato de quem escreveu); depois o admin aceita, recusa ou marca como resolvida.
  Não usa token do GitHub, então não há segredo novo para guardar.
- [x] **E-mail de confirmação em português** com a identidade do Sabor Local (`webapp/supabase/templates/confirmacao.html`),
  valendo no local e com passo a passo para colar em produção ([producao.md](producao.md), seção 4).
- [x] Página **404** e tela de **erro** em português, com saída para o catálogo e para o Fale conosco.
- [x] Selo **beta** no topo do site e `noindex` em login, painel e admin.
- [x] LGPD: Política de Privacidade e limpeza automática cobrem o Fale conosco (IP em 7 dias, contato em 180, mensagem
  tratada em 12 meses).
- [x] `SECURITY.md`, `/.well-known/security.txt`, `CONTRIBUTING.md`, modelos de issue e de PR, Dependabot.

### Entregue depois (branch `feat/horarios-multiplos-mobile`)

- [x] **Horário com até dois períodos por dia** (ex.: 08:00–12:00 e 18:00–22:00), com validação de sobreposição, limite
  no banco (migration 0012) e exibição na mesma linha no perfil público. O "aberto agora" já considerava vários períodos.
- [x] **Campo de hora para celular:** troca do relógio nativo (AM/PM, difícil no Samsung) por campo de texto com teclado
  numérico em 24 horas ("1800" vira 18:00), com dica de leitura e atalho **Copiar o horário de um dia para outros**.
  Vale também nas datas especiais.
- [ ] Datas especiais ainda aceitam um período só; dois períodos na mesma data exigiriam mudar `excecoes_horario`.

### Entregue depois (branch `feat/cinco-melhorias-v09`)

- [x] **Indisponível hoje** (Próxima fase, item 1): o item indisponível continua no perfil, esmaecido e com o selo, no fim da
  lista. Três estados: disponível, indisponível **só hoje** (volta sozinho no dia seguinte, sem tarefa agendada) e
  indisponível **sem previsão** (até o vendedor reativar). Migration 0013 (`indisponivel_ate`).

- [x] **Aba Compartilhar** (Próxima fase, item 2): o vendedor divulga o perfil pelo WhatsApp, Facebook, copiando o link ou pelo QR
  code, e vê **de onde vêm as visitas** (30 dias). O link leva `?origem=...`; o banco guarda só o rótulo, nunca dado
  pessoal. Migration 0014 (`eventos.origem`, `registrar_evento` com origem e `visitas_por_origem`).

- [x] **Resumo do admin por cidade**: no `/admin`, bloco "Por cidade" com vendedores ativos, pendentes e suspensos, perfis
  completos (meta de 10), destaques, visitas, toques e avaliações, e uma situação por cidade (montando a base, pronta, precisa
  de atenção ou pausada). Migration 0015 (`admin_resumo_cidades`, só para administradores).

### Entregue depois (branch `feat/avaliacao-convite-e-links`)

- [x] **Avaliação por convite** (o vendedor não vê nem gera o código): ele informa só o e-mail do cliente e o site envia um link
  único direto para esse e-mail. O banco guarda só o hash do link e o e-mail mascarado; o e-mail do próprio vendedor é recusado;
  1 convite por e-mail a cada 30 dias e 20 por dia; o convite vale 30 dias e uma vez. A moderação continua. Substitui os
  códigos que o vendedor gerava (o acesso dele a `codigos_pedido` foi removido). Migration 0017. Exige `RESEND_API_KEY` e
  `EMAIL_REMETENTE` em produção ([producao.md](producao.md)).

- [x] **Identificação da própria loja**: com o vendedor logado, a loja dele aparece na lista com o selo "Sua loja" e, no perfil,
  um aviso no lugar do botão de pedir. Visitas e toques do dono na própria loja **não entram nas métricas** (o banco descarta;
  migration 0018), então ele pode navegar e conferir o perfil sem distorcer os números.

- [x] **Link de pedidos próprio**: quem já tem site, cardápio online ou outro canal coloca o endereço (e o texto do botão) no
  perfil; ele aparece ao lado do "Pedir pelo WhatsApp". Só aceita `http(s)` com domínio, sem usuário e senha, até 300
  caracteres; o clique é contado (evento `link_pedido`) e o admin vê e pode remover o link de qualquer perfil.
  Migration 0019.

### Entregue depois (branch `feat/proxima-fase`)

- [x] **Busca no topo e busca no cardápio**: a busca ficou logo abaixo do título do catálogo, antes das seções de descoberta, com os
  botões **Tudo / Nome da loja / Produto**; ignora acento e maiúsculas e exige todas as palavras. No modo produto, o cartão
  mostra os itens que bateram (com o preço) e o perfil abre com o termo já preenchido. Perfis com 5 itens ou mais ganham uma
  **caixa de busca no cardápio** ("pastel", "chocolate", "carne").
- [x] **Nota média e total de avaliações** nos cartões e no perfil (só avaliações aprovadas), com a data e o nome de cada uma.
  View `avaliacoes_resumo` (migration 0021). O perfil sempre mostra a seção Avaliações, com aviso quando ainda não há nenhuma
  e, para o dono, o atalho para convidar clientes.
- [x] **Nome opcional de quem avalia**: campo "Seu nome (opcional)" no formulário do convite. Fica anônimo se vazio; recusa site,
  e-mail e telefone no lugar do nome; até 40 caracteres. Texto da Política de Privacidade atualizado. Migration 0022.
- [x] **Exigir ou não a aprovação do administrador** (`/admin` → Configurações), em dois interruptores independentes:
  **avaliações** e **criação de vendedores**. O padrão continua exigindo. Vale só para o que chegar depois. Migration 0022
  (tabela `configuracoes`, de linha única e só do administrador).
- [x] **Logo personalizada e banner** (Próxima fase, item 3): upload em `/painel` → Perfil, com corte ao centro e compressão no
  navegador; só aceita endereço do nosso Storage; aparece no cartão (logo), no topo do perfil (banner + logo) e na prévia ao
  compartilhar (Open Graph e Twitter). O administrador remove imagem imprópria em Vendedores (o arquivo também é apagado).
  Migration 0023.
- [x] **Bairros sempre atualizados** (item 4): o vendedor escolhe **"Não achei meu bairro"** e digita o nome; o perfil mostra
  "bairro (a confirmar)" até o administrador **aprovar**, **juntar** ou **recusar** na fila (`/admin` → Cidades). Nomes
  parecidos (acento, maiúsculas, pontuação) não duplicam, nem pelo admin; até 5 sugestões por vendedor por dia. O admin também
  **renomeia, desativa e junta** bairros (juntar move os vendedores). Migration 0024.
- [x] **Produtos em destaque** (item 5): **"Destaque da casa"** (escolha do vendedor, até 3, aba Menu) e **"Mais pedido"** (só por dados:
  toques no botão **Pedir** de cada item, que abre o WhatsApp com o item na mensagem). O selo exige 5 toques de pessoas
  diferentes em 30 dias, a mesma pessoa conta uma vez por hora e o dono não conta. Item indisponível não ganha selo. Seção
  "Destaques do cardápio" no topo do perfil (até 5) e relatório "Itens mais tocados" na aba Clientes. Migration 0025.

**Decisões tomadas nesta entrega** (revisar se não servirem):
- O selo de dados se chama **"Mais pedido"** (não "Mais vendido"), porque o site mede toques, não vendas.
- **Destaque da casa:** máximo de **3**; seção de destaques com no máximo **5**.
- **Sugestão de cidade nova** pelo vendedor **não** entrou: só o administrador cria cidades (a sugestão de bairro já nasce ligada
  à cidade do vendedor).
- Mudar o texto da Política de Privacidade (nome opcional do avaliador) **não** trocou `TERMOS_VERSAO`; trocar obriga todos os
  vendedores a aceitar de novo. Decidir junto com a revisão jurídica.

### Entregue depois (branch `feat/categorias-de-produtos`)

- [x] **Categorias de produto** (opcionais e de cada vendedor): na aba Menu o vendedor cria as categorias dele ("Bebidas", "Salgados",
  "Doces", "Xis", "Cachorro quente"...), com atalhos de nomes comuns, e escolhe a de cada item (ou deixa sem). Até 15 por loja, dá
  para renomear, subir e descer; apagar uma categoria **não apaga os itens**. No perfil público o menu aparece em **seções** e com
  botões para filtrar por categoria.
- [x] **Filtro "Tipo de produto" no catálogo**: junto da busca por produto. As categorias das lojas são juntadas por uma **chave** sem
  acento, maiúsculas, pontuação e plural simples ("Bebidas", "bebida" e "BEBIDA" viram um filtro só, com a contagem de lojas). Com
  um tipo escolhido, só ficam as lojas com produto nele e o cartão mostra esses produtos; combinado com o texto, o **mesmo item**
  precisa bater com os dois ("suco" + Bebidas). O link do cartão abre o perfil já filtrado. O seletor de "Categoria" dos negócios
  passou a se chamar **"Ramo"** para não confundir. Migration 0027 (inclui a categoria em "Baixar meus dados").

**Decisões tomadas** (revisar se não servirem):
- Cada loja cria as categorias que quiser; o catálogo só as junta pelo nome. Por isso há atalhos com nomes comuns: usar "Bebidas"
  em todas as lojas faz o filtro juntar os produtos.
- O plural só se resolve tirando o "s" final (palavras com mais de 3 letras). "Pão" e "Pães" ainda são categorias diferentes.
- O administrador pode apagar uma categoria imprópria (banco), mas ainda não há tela para isso.

### Entregue depois (branch `feat/produto-por-tamanho`)

- [x] **"Monte o seu"** (pizza, açaí, marmita, sorvete... qualquer produto montado): o preço depende do **tamanho** e o cliente
  escolhe o que vai nele, sem gambiarra com itens duplicados. O vendedor cria o produto em `/painel` → Menu (com modelos prontos:
  Pizza, Açaí, Marmita, Sorvete) e define: os **tamanhos**, cada um com **preço fixo** e **quantas escolhas inclui** ("Média (30 cm),
  R$ 54, até 2 sabores"; "Grande (35 cm), R$ 62, até 3"); **de quais categorias do menu vêm as escolhas** (os sabores são itens
  normais, podem ficar **sem preço**); e os **adicionais pagos** ("Borda recheada + R$ 10", "Granola", "Nutella + R$ 5") com um máximo
  por pedido. Os nomes são da loja ("Sabores", "Acompanhamentos", "Complementos"...) e dá para exigir ou não ao menos uma escolha.
  No perfil aparece, **no topo do cardápio**, o cartão **"Monte o seu"** com o botão **Montar pizza**: o cliente escolhe o tamanho,
  depois as opções com contador ("1 de 2", o resto trava no limite, sem erro) e os adicionais, vê o total na hora e toca em
  **Adicionar ao pedido**. Lojas que **não** recebem pedido pelo site usam o mesmo montador e o botão vira **Pedir pelo WhatsApp**
  com a montagem na mensagem. O produto some do perfil se estiver pausado, sem tamanho ou sem opção disponível; adicional "em falta"
  some da lista e o vendedor pode pausar o produto inteiro. Sabores sem preço **não** têm botão de pedir sozinhos.
  Migration 0028: tabelas `montaveis`, `montavel_tamanhos`, `montavel_categorias` e `montavel_adicionais` (limites de 5 produtos por
  loja, 6 tamanhos, 30 adicionais), `criar_pedido` aceita as montagens e o **banco confere tudo de novo e calcula o preço**
  (tamanho + adicionais; o cliente manda só ids). O pedido guarda nome, preço e escolhas "congelados"; a loja vê as escolhas no
  cartão do pedido, o cliente na página de acompanhamento e no resumo do WhatsApp. "Baixar meus dados" inclui os produtos.

**Decisões tomadas** (revisar se não servirem):
- O limite de escolhas é **por tamanho** (é como as pizzarias vendem), e o preço **não muda com o sabor**. Sabor mais caro
  ("sabor especial + R$ 5") **não** entrou: dá para simular com um adicional, mas não por sabor.
- Cada produto montado tem **uma** lista de escolhas (as categorias marcadas) e **uma** lista de adicionais. Etapas em sequência
  (ex.: escolher a massa, depois o recheio, depois a borda) ou adicional com quantidade (2x bacon) ficam para uma próxima versão.
- Os sabores são itens do menu em categorias: o vendedor mantém tudo numa lista só, e "Indisponível hoje" num sabor já o tira da escolha.
- A **meia a meia** (metade de cada) não tem preço diferente: vale o preço do tamanho, com 2 sabores.

**Ainda pendente:**
- [ ] Testar o "Monte o seu" com uma pizzaria e uma açaiteria reais (o texto e a ordem das telas foram pensados para o caso da pizzaria).
- [ ] "Mais pedido" para produtos montados (hoje só vale para itens comuns).

### Entregue depois (branch `feat/meus-pedidos`)

- [x] **Meus pedidos** (para o cliente acompanhar o que pediu sem conta, sugerido na issue 20): página `/meus-pedidos`, com link no
  cabeçalho para quem já pediu ou começou um pedido neste aparelho. Mostra **Em andamento**, **Pedidos não finalizados** (os carrinhos que
  ficaram pela metade, com "Continuar pedido" e "Esvaziar") e **Pedidos anteriores**; o status vem do banco e se atualiza sozinho. O pedido
  entra na lista quando a pessoa abre o link dele. Tudo guardado **só no navegador** (localStorage), no máximo 30 pedidos, com "Tirar da lista"
  e "Limpar a lista". Sem migration. A Política de Privacidade cita a lista.

**Decisões tomadas** (revisar se não servirem):
- Guarda só o link secreto, a loja, o número e o valor; o resto (status, itens) vem sempre do banco pelo link.
- A lista **não** sincroniza entre aparelhos: trocar de celular ou limpar o navegador a apaga.

**Futuro (anotado a pedido): conta opcional de cliente.** Hoje não há login de cliente e, por isso, o site não guarda o histórico dele no
servidor. Uma versão mais completa e robusta seria um **cadastro opcional** (e-mail ou telefone, só para quem quiser), com: histórico de
pedidos em qualquer aparelho, dados de entrega salvos, "pedir de novo", avisos de andamento por e-mail ou WhatsApp e avaliações ligadas à
conta. Exige: nova tabela de clientes e vínculo com `pedidos`, regras de privacidade (consentimento, exclusão e exportação, como já é para o
vendedor), proteção contra abuso no cadastro e revisão dos Termos e da Política. Enquanto isso, a lista no navegador cobre o essencial.

### Ideias anotadas de baixo custo (ainda não feitas)

- [x] **Responder pelo próprio painel**: botão "Responder" na mensagem do Fale conosco (abre `wa.me` ou `mailto:` com um
  texto-base que cita a mensagem), já que o contato fica só no admin. O contato só vira link se for claramente um e-mail
  ou um telefone brasileiro; texto estranho não vira link.
- [x] **"Esqueci minha senha"** (`/esqueci-senha` e `/redefinir-senha`, com e-mail de recuperação em português, resposta
  igual exista a conta ou não e o mesmo limite de tentativas do login). O e-mail de **troca de e-mail** também está em
  português (`troca-email.html`), mas só será usado quando existir uma tela de trocar e-mail (ainda não existe).
- [x] **Lembrete de versão dos Termos**: ao mudar `TERMOS_VERSAO` (em `lib/legal.ts`), o vendedor vê uma tela pedindo novo aceite
  no próximo acesso ao painel e só continua depois de aceitar; contas sem aceite registrado também. Migration 0020
  (`aceitar_termos`).
- [x] **CSP em modo `Report-Only`** para medir antes de bloquear (ver [seguranca.md](seguranca.md), item 8): o navegador relata
  violações para `/csp-report` e o servidor registra um resumo no log. Falta olhar o log em produção e então passar a bloquear.
- [x] **Link "Reportar um problema no site" no perfil do vendedor**, ao lado de Denunciar: abre o Fale conosco já com a página de
  origem preenchida (`?de=`), para o cliente avisar de erro no site sem confundir com denúncia contra o vendedor.
- [x] **Contador de mensagens do Fale conosco** no Resumo do admin: total, para ler, aceitas, recusadas, resolvidas e a % que
  foi aproveitada (mostra a saúde do canal). Conta o que ainda está guardado: mensagens tratadas saem em 12 meses.
- [x] **Exportar meus dados** (LGPD, direito de acesso e portabilidade): o vendedor baixa um arquivo JSON com a conta, o perfil, os
  horários, o menu, as avaliações recebidas, os pagamentos do destaque e o uso do perfil (aba Perfil, "Baixar meus dados").
  Fica de fora o que identifica terceiros (denúncias recebidas, código secreto das avaliações). Migration 0016
  (`exportar_meus_dados`) e rota `/painel/exportar`.
- [x] **Aviso de cookies (revisado, não é necessário hoje)**: só há cookies funcionais (sessão e `cidade`) e nenhum recurso de
  terceiros. A decisão e a regra para quando entrar métrica de terceiros estão em [seguranca.md](seguranca.md); testes
  automáticos acusam se uma página pública passar a carregar algo de fora ou gravar cookie sem escolha da pessoa.

### Segurança e abertura do repositório

A revisão de segurança, os riscos antes de tornar o repositório público e o checklist de abertura estão em
[seguranca.md](seguranca.md).

---

## Integrações e diferenciais de mercado

Comparação com sistemas de cardápio digital e de delivery (iFood, Anota AI, Goomer, Cardápio Web e similares), com o
Google e com o catálogo do WhatsApp Business. Só entra o que combina com o princípio do projeto: cidade pequena, gente
simples, **sem comissão** e com o WhatsApp como canal. Preços e planos de terceiros mudam: confira antes de decidir.

### Integrações externas

| Integração | O que dá | Esforço | Custo | Quando |
|---|---|---|---|---|
| **Google Maps e "como chegar"**, dados estruturados para o Google | Mapa no perfil e o vendedor aparece na busca | Baixo | Grátis | **Primeiro** |
| **Prévia ao compartilhar** (Open Graph, Web Share) | Link com foto e nome no WhatsApp e no Instagram | Baixo | Grátis | **Primeiro** (já está na Próxima fase) |
| **Login com Google** | Cadastro sem confirmar e-mail | Baixo (o Supabase já suporta) | Grátis | **Primeiro** |
| **Pix estático** (chave e "copia e cola" no perfil) | Cliente paga direto; admin cobra o destaque sem digitar | Baixo (sem API) | Grátis | **Primeiro** |
| **Pedido pronto no `wa.me`** | Mensagem com os itens já montada | Baixo | Grátis | Junto da v2.x leve |
| **Monitoramento** (Sentry, monitor de disponibilidade) | Alerta de erro e de queda | Baixo | Plano grátis | **Antes de divulgar** |
| **E-mail transacional** (Resend, Brevo) | Confirmação e recuperação de senha | Baixo | Plano grátis | **Obrigatório** em produção |
| **Análise de visitas sem cookies** (Plausible, Umami) | Origem das visitas | Baixo | Grátis ou barato | Depois |
| **Importar cardápio por foto/PDF com IA** | Itens preenchidos a partir da foto | Médio | Pago por uso | Diferencial, depois da validação |
| **Pagamento automático do destaque** (Mercado Pago, Asaas) | Acaba com o registro manual | Médio | Taxa por transação | Só se alguém pagar |
| **Aviso por WhatsApp ao vendedor** ("loja aprovada") | Menos suporte | Médio | Pago | Depois da validação |
| **Entrega por terceiros** | Entrega sob demanda | Alto | Variável | Fora de escopo (v2.x) |

### Funcionalidades que os concorrentes têm e o projeto não

- **Cliente:** montar o pedido e enviar pronto no WhatsApp (v2.x); favoritos e "pedir de novo" guardados no aparelho;
  "fecha em 40 min"; busca por prato com sinônimos; mapa e ordenação por proximidade (com bairro como alternativa);
  **instalar como app (PWA)**; avisos de promoção de quem segue (opt-in).
- **Vendedor:** cupom ou promoção do dia (banner no perfil); itens com adicionais, tamanhos e alérgenos; pausa
  programada e "voltar amanhã" nos itens; **relatório semanal pronto** por e-mail ou WhatsApp; link curto próprio
  (`/pizzaria-do-ze`) e QR code com a marca; importar o cardápio de planilha ou foto.
- **Administrador:** resumo por cidade; cadastro assistido; respostas prontas no feedback; moderação com regras
  (palavras proibidas, avaliação suspeita); exportação e backup dos dados.

### Diferenciais que os grandes não têm (a proposta do projeto)

Sem comissão e preço fixo baixo (plano destaque); **curadoria local** com parceiro por cidade e coleções ("marmitas do
centro", "aberto no domingo"); acessibilidade para quem tem pouca experiência digital, com atendimento humano; código
aberto e dados que o vendedor pode levar embora.

### Ordem sugerida

- [ ] **1.** Mapa e "como chegar", prévia de compartilhamento e dados estruturados para o Google
- [ ] **2.** Login com Google e "esqueci minha senha"
- [ ] **3.** Pix estático no perfil e mensagem de pedido pronta no `wa.me`
- [ ] **4.** Sentry e monitor de disponibilidade, antes de divulgar
- [ ] **5.** PWA e favoritos locais
- [ ] **6.** Importar cardápio por foto com IA, depois de validar com vendedores reais

---

## Versionamento: de 0.9 a 1.0

**Proposta (a confirmar):** tratar o estado atual como **v0.9 (beta fechada, com todas as funções do escopo
original prontas)** e reservar a **1.0** para o lançamento comercial, quando houver produto no ar, validado por vendedores
reais e com operação mínima segura. O `package.json` está em `0.1.0`; a versão só deve ser alterada junto de uma tag e de
um `CHANGELOG.md`.

| Versão | O que significa | Critério para chegar lá |
|---|---|---|
| **0.9** | Escopo original pronto, testado e documentado. Ninguém de fora usou | **Já atendido** (fases 1 a 4, 501 testes, CI, LGPD, Fale conosco) |
| **0.95** | Beta aberta em produção para poucos vendedores reais | Itens "Produção, antes de divulgar" do [O que falta](#o-que-falta) concluídos e 3 a 5 vendedores usando |
| **1.0** | Lançamento comercial: pode divulgar e cobrar | Critérios abaixo |

### O que falta para a 1.0 comercial

**Bloqueia o lançamento**
- [ ] No ar com domínio próprio, SMTP, backup, monitoramento e admin em produção ([producao.md](producao.md))
- [ ] **Revisão jurídica** dos Termos e da Política, com responsável e contato reais definidos
- [ ] **"Esqueci minha senha"** (hoje o vendedor que perde a senha não tem como recuperar)
- [ ] Pelo menos **uma cidade com 10 vendedores aprovados e ativos** e as correções das primeiras semanas feitas
- [ ] **Teste de interface** (Playwright) nos fluxos críticos: login, cadastro, perfil e menu
- [ ] Cadastro assistido pelo admin (a barreira de adoção mais provável)

**Precisa estar decidido, mas pode sair logo depois**
- [ ] Preço do plano destaque testado com vendedores (e como cobrar: Pix manual ou automático)
- [ ] Resumo do admin por cidade
- [ ] Primeiras funções da Próxima fase (Indisponível hoje e Compartilhar)

**Pode esperar a 1.x**
- [ ] Integrações da tabela acima fora da ordem sugerida, PWA, IA para importar cardápio, v2.x (pedidos pelo site)

---

## Próxima fase

Foco: dar mais vitrine e mais autonomia ao vendedor, e manter a base de bairros viva. São cinco entregas
independentes; a ordem sugerida vai das mais simples às mais dependentes de decisão.

### 1. Status "Indisponível hoje" nos produtos

**Objetivo:** o vendedor desativa um produto sem apagá-lo e o cliente entende que ele existe, mas hoje não tem.

**Já existe:** o botão "Tem hoje / Não tem hoje" na aba Menu do painel (coluna `itens_cardapio.disponivel`).
**O que falta:** hoje o perfil público **esconde** o item inativo. O pedido é mostrá-lo como "Indisponível hoje".

- Perfil público: listar o item esmaecido, com o selo "Indisponível hoje", no fim da lista ou no lugar original.
- Painel: renomear o botão para "Disponível" / "Indisponível hoje", com o mesmo texto no perfil.
- Opcional: "Voltar amanhã" (reativar sozinho à meia-noite), no mesmo estilo do "Não abro hoje" da loja.
- Busca: item indisponível continua achável pelo nome, mas sem prioridade.
- **Pronto quando:** inativar não apaga o item, o cliente vê "Indisponível hoje" e o vendedor reativa com um toque.

### 2. Aba "Compartilhar" para o vendedor

**Objetivo:** o vendedor divulga o link da loja com poucos toques, principalmente pelo celular.

- Nova aba no painel, ao lado de Clientes. Hoje o QR code fica em Clientes; o QR pode ser movido para cá.
- Botões grandes: **WhatsApp** (`wa.me` com mensagem pronta), **Facebook** (sharer), **Instagram/outros** pelo menu
  nativo do celular (Web Share API, `navigator.share`), **Copiar link** e **Baixar/imprimir QR code**.
- Mensagem pré-pronta e editável, por exemplo "Faça seu pedido na Pizzaria X: <link>".
- Link com marcação de origem (`?origem=whatsapp`) para medir de onde vêm as visitas (usa a tabela `eventos`).
- Prévia ao compartilhar: título, descrição e imagem do perfil (Open Graph); fica melhor depois da logo e do banner.
- **Pronto quando:** em um celular, o vendedor compartilha a loja no WhatsApp com 2 toques e vê quantas visitas vieram de cada canal.

### 3. Logo personalizada e banner

> **Entregue** na branch `feat/proxima-fase` (migration 0023). Detalhes na seção "Entregue depois" acima.

**Objetivo:** a loja ter identidade visual própria no site.

- Colunas `logo_url` e `banner_url` em `vendedores`; arquivos no bucket do Storage, na pasta do dono
  (mesma regra de isolamento do cardápio).
- Upload na aba Perfil, com compressão no navegador (como já é feito nas fotos dos itens), recorte quadrado para
  a logo e proporção larga para o banner, limite de tamanho e só imagens.
- Onde aparece: cartão no catálogo (logo), topo do perfil (banner + logo), prévia de compartilhamento.
- Sem arquivo: manter o visual atual (iniciais ou ícone), nunca uma imagem quebrada.
- Cuidados: texto alternativo, proporção fixa para a página não "pular", e o admin poder remover imagem imprópria
  (entra na moderação e nas denúncias).
- **Pronto quando:** o vendedor troca logo e banner pelo celular e o catálogo e o perfil refletem na hora.

### 4. Bairros e cidades sempre atualizados

> **Entregue** na branch `feat/proxima-fase` (migration 0024), exceto a sugestão de **cidade** nova pelo vendedor.

**Objetivo:** não depender só do admin para cadastrar bairros, sem deixar a lista virar bagunça.

- Vendedor **sugere** um bairro que não está na lista (campo "Não achei meu bairro"). A sugestão fica pendente.
- Admin vê as sugestões numa fila (nova aba ou seção) e **aprova** (cria o bairro), **junta** com um existente
  (evita "Centro" e "centro") ou **recusa**. Até aprovar, o perfil usa o texto sugerido como "bairro a confirmar".
- Prevenção de duplicata: comparar sem acento e sem diferença de maiúsculas antes de criar.
- Limite de sugestões por vendedor e por dia, e as mesmas proteções contra spam das denúncias.
- Ligação com a **Fase 4** (já feita): a tabela `cidades` existe e cada bairro pertence a uma cidade. A sugestão de bairro
  deve nascer ligada à cidade do vendedor; a de cidade nova segue o mesmo fluxo de aprovação (hoje só o admin cria cidades).
- Manutenção: tela do admin para renomear, juntar e desativar bairros (sem apagar os que têm vendedores).
- **Pronto quando:** um bairro novo sugerido por um vendedor chega à fila, é aprovado em um clique e aparece
  para todos os vendedores e filtros.

### 5. Produtos mais vendidos em destaque

> **Entregue** na branch `feat/proxima-fase` (migration 0025), pelo caminho recomendado: indicação do vendedor + toques em
> "Pedir" (opção 1). A opção 2 (itens marcados no código de avaliação) ficou sem uso, porque o convite por e-mail substituiu o código.

**Objetivo:** mostrar o que a casa tem de melhor, por dados e por escolha do vendedor.

**Dois critérios:**
- **Indicação do vendedor** (simples e já viável): marcar até N itens como "Destaque da casa" ou "Mais pedido".
- **Volume de vendas** (precisa de decisão): a plataforma **não processa pedidos nem pagamentos**, então não sabe
  o que foi vendido. Caminhos possíveis, do mais simples ao mais completo:
  1. Contar toques no item (um botão "Pedir este" que abre o WhatsApp com o item na mensagem) como medida de interesse.
  2. Ao gerar o **código de avaliação** de um pedido, o vendedor marca os itens vendidos; a soma por item vira o ranking.
  3. Pedir ao vendedor um número aproximado por semana (menos confiável).

  Recomendação: começar pela indicação do vendedor e pela opção 1; avaliar a 2 depois de ver o uso real.
  Quando existir o pedido pelo site (**versão 2.x**), o volume real passa a vir dos pedidos concluídos.

- Selo "Mais vendido" / "Destaque da casa" no item e uma seção "Mais pedidos" no topo do perfil (limite de 3 a 5).
- Regras claras para não enganar o cliente: o selo "Mais vendido" só aparece se vier de dados; a escolha do vendedor
  usa outro nome ("Destaque da casa").
- Respeitar a disponibilidade: item "Indisponível hoje" não ganha selo.
- Relatório simples para o vendedor: itens mais tocados nos últimos 30 dias.
- **Pronto quando:** o vendedor marca seus destaques em poucos toques e o cliente vê, no topo do perfil, os itens
  recomendados, com o motivo explicado.

### Ordem sugerida e dependências

1. **Indisponível hoje** (pequeno; só ajusta o que já existe).
2. **Compartilhar** (independente; ganha qualidade quando houver logo e banner).
3. **Logo e banner** (novas colunas e upload; melhora o compartilhamento).
4. **Bairros e cidades** (a tabela `cidades` já existe; falta a sugestão pelo vendedor e a fila de aprovação).
5. **Mais vendidos** (depende da decisão sobre como medir o volume).

### Fora desta fase (por enquanto)

Pedido/encomenda pelo site fica para a **versão 2.x** (seção abaixo). Processamento de pagamento, aplicativo
nativo e entrega própria continuam fora do escopo do Termo de Abertura.

### Riscos e perguntas em aberto

- **Medir vendas** sem processar pedidos: qual critério o vendedor aceita usar no dia a dia? Validar com 3 a 5 vendedores.
- **Imagens** aumentam custo de armazenamento e o risco de conteúdo impróprio: definir limite de tamanho e moderação.
- **Bairros** sugeridos à mão geram duplicatas: a junta de nomes precisa ser fácil para o admin.
- **Compartilhamento** depende da Web Share API, que não existe em todo navegador de desktop: manter sempre o
  botão "Copiar link" como alternativa.
- Cada entrega precisa de testes (unitários e de API) e passar no CI, como as anteriores.

---

## Versão 2.x: pedidos pelo site (finalização do desenvolvimento)

> **Não faz parte da beta.** A versão 2.x foi iniciada depois de concluída a "Próxima fase" e está na branch
> `feat/pedidos-pelo-site` (a partir da `feat/proxima-fase`). **Só deve ir ao ar** depois de a beta ser validada com vendedores
> reais e de o [aditivo ao Termo de Abertura](projeto/aditivo-termo-de-abertura-v2.md) ser aprovado.

> **Como será desenvolvida:** em uma **branch separada** (não na `feat/proxima-fase`), porque mexe em muita coisa: banco,
> painel do vendedor, perfil público, privacidade e testes. Os commits dessa versão não entram na branch da "Próxima fase".
> O botão **Pedir** do item (item 5 da "Próxima fase") **não** é pedido pelo site: só abre o WhatsApp com o item e conta o
> toque. Ele fica no commit próprio `Próxima fase, item 5` e pode ser tirado sem afetar o resto.

**Objetivo:** o cliente fazer **pedidos/encomendas diretamente pelo site**, sem depender de montar a mensagem à mão
no WhatsApp. O vendedor continua atendendo, entregando e recebendo como hoje; a plataforma passa a organizar o pedido.

**Escopo do pedido (o que o cliente informa):**

- Quantidade dos produtos
- Valor do pedido
- Meio de pagamento
- Entrega ou retirada
- Campo de observações

### Entregue na branch `feat/pedidos-pelo-site`

As cinco etapas abaixo estão no código, com testes (58 de API, 50 unitários) e a Política de Privacidade e os Termos atualizados.
O vendedor liga os pedidos em `/painel` → **Pedidos** (desligado por padrão).

- [x] **Etapa A, carrinho e itens:** "Adicionar" e quantidade em cada item (só com a loja aberta), faixa fixa com o resumo, valor
  calculado pelo **banco** (o site só manda id e quantidade), preço e nome do item "congelados" no pedido. Item "Indisponível hoje" não
  entra no pedido; item sem preço entra como **sob consulta** (o valor final se combina).
- [x] **Etapa B, dados do pedido:** entrega ou retirada (conforme a loja atende), nome, telefone, endereço, meio de pagamento
  aceito pela loja (Pix, dinheiro com troco, cartão), observações (300 caracteres) e **taxa de entrega** definida pelo vendedor.
- [x] **Etapa C, envio e acompanhamento:** o pedido é gravado e o vendedor o vê em `/painel` → Pedidos (contador de novos e
  atualização sozinha); o cliente é levado a uma página de acompanhamento e convidado a **avisar a loja pelo WhatsApp com o
  resumo pronto** (o canal principal continua sendo o WhatsApp). Status: novo, em preparo, saiu para entrega ou pronto para
  retirar, concluído, cancelado. O cliente cancela enquanto o pedido é novo. **Não aceita pedido com a loja fechada**, de férias ou
  "não abre hoje" (mesma regra do site, no banco).
- [x] **Etapa D, integração:** o link do pedido concluído permite **avaliar** (é a verificação de compra, sem o vendedor gerar código);
  o selo **"Mais pedido"** passa a vir dos pedidos concluídos (3 pedidos ou mais em 30 dias) e, sem pedidos, continua vindo dos
  toques em "Pedir"; números de pedidos no painel do vendedor e no resumo do admin; o histórico registra os pedidos (sem dado
  pessoal). Migration 0026.
- [x] **Etapa E, proteções:** limites (3 por hora por telefone e por loja, 5 por hora por origem), telefone, endereço e valores
  validados, **recusar e bloquear** um telefone (guarda só o código embaralhado e os 4 últimos dígitos), pedido novo sem resposta
  vence em 3 dias, nome, telefone e endereço saem do pedido 90 dias depois do encerramento, o administrador não lê dados de clientes.
  A tela de finalizar o pedido avisa, antes de coletar nome, telefone e endereço, para que servem, por quanto tempo ficam e onde está a Política de Privacidade (issue 29).

**Decisões tomadas** (revisar se não servirem):
- O pagamento continua **só informado** (premissa recomendada). Nenhum dinheiro passa pelo site.
- O link de acompanhamento é do cliente e **nunca vai para a loja** (nem no resumo do WhatsApp): quem tem o link cancela e avalia.
- O vendedor **não recebe e-mail nem notificação**: vê o pedido no painel (que se atualiza sozinho) e no resumo que o cliente manda
  pelo WhatsApp. Aviso por e-mail ou push fica para depois, se os vendedores pedirem.
- Valor máximo de R$ 5.000 por pedido e até 30 itens diferentes, 20 unidades de cada.
- `TERMOS_VERSAO` mudou para `2026-10-pedidos`: todo vendedor aceita de novo os Termos e a Política no próximo acesso.

**Ainda pendente** (fora do código ou de etapa futura):
- [ ] Aprovar o [aditivo ao Termo de Abertura](projeto/aditivo-termo-de-abertura-v2.md) (o `.docx` original não foi alterado).
- [ ] Testar com 3 a 5 vendedores reais antes de divulgar (o roadmap pede validar se o painel de pedidos é bem-vindo).
- [x] Opções por item (tamanho e sabores da pizza, adicionais): entregue como **"Monte o seu"** (seção abaixo, branch `feat/produto-por-tamanho`).
- [ ] Revisão jurídica dos novos trechos da Política e dos Termos.

### Mudança de escopo a registrar

O Termo de Abertura (seção 4.2) deixa **fora do escopo** o processamento de pagamentos e a logística de entrega, e
diz que alterações relevantes de escopo devem ser registradas em uma versão revisada do documento. Antes de iniciar
a versão 2.x, atualizar o Termo com a decisão abaixo. O texto está no
[aditivo ao Termo de Abertura](projeto/aditivo-termo-de-abertura-v2.md), aguardando aprovação.

**Premissa recomendada:** o "meio de pagamento" é só uma **escolha informada no pedido** (por exemplo Pix,
dinheiro, cartão na entrega). A plataforma **não processa nem recebe o dinheiro**: o pagamento continua direto entre
cliente e vendedor, como na premissa original. Cobrança online dentro do site seria outra decisão, fora desta fase.

### Etapas futuras

**Etapa A. Carrinho e itens do pedido**
- O cliente escolhe os produtos e a **quantidade** de cada um, direto no perfil do vendedor.
- O **valor do pedido** é calculado pelo site (soma de preço x quantidade), sem o cliente digitar valor.
- Só entram produtos disponíveis ("Indisponível hoje" não pode ser pedido). Produtos sem preço fixo (pizza por
  tamanho e sabores, por exemplo) precisam de uma regra: pedir "sob consulta" ou escolher o tamanho e os sabores.
- Preço do item "congelado" no pedido, para mudar o cardápio depois não alterar pedidos antigos.

**Etapa B. Dados do pedido**
- **Entrega ou retirada**, respeitando o que o vendedor oferece (`modo_atendimento`). Entrega pede endereço e
  telefone; retirada, só o nome e o telefone.
- **Meio de pagamento** entre os que o vendedor aceita (configuração do vendedor), incluindo "troco para quanto"
  quando for dinheiro.
- **Observações** em texto livre (ex.: "sem cebola", "campainha estragada"), com limite de tamanho.
- Taxa de entrega, se houver, definida pelo vendedor e somada ao valor.

**Etapa C. Envio e acompanhamento**
- Ao confirmar, o pedido é gravado no banco e o vendedor é avisado. Mantendo a simplicidade para quem não usa
  sistemas: abrir o **WhatsApp do vendedor com o resumo pronto** continua sendo o canal principal, e o site guarda o registro.
- Painel do vendedor com a lista de pedidos e **status simples**: novo, em preparo, saiu para entrega ou pronto
  para retirar, concluído, cancelado.
- O cliente acompanha o pedido por um link (sem criar conta).
- Cuidar do horário: não aceitar pedido com a loja fechada, de férias ou "não abre hoje".

**Etapa D. Integração com o que já existe**
- O pedido concluído gera o **código de avaliação** automaticamente (a verificação de compra deixa de depender de o
  vendedor gerar o código à mão).
- Os pedidos viram a fonte do **"mais vendido por volume"** da próxima fase, no lugar de estimativas.
- Métricas: pedidos por vendedor e por período no resumo do admin e no painel do vendedor.
- O histórico (auditoria) passa a registrar os pedidos.

**Etapa E. Proteções e qualidade**
- Validação de quantidade, valores, telefone, endereço e observações, com mensagens claras para corrigir, como no
  restante do site.
- Limite de pedidos por IP/telefone e proteção contra pedidos falsos (o vendedor precisa poder recusar e bloquear).
- Privacidade: o pedido guarda nome, telefone e endereço do cliente; entra na política de privacidade (LGPD), com
  prazo de retenção e exclusão.
- Testes de API, de força bruta e de rotas, e CI verde, como nas entregas anteriores.

### Riscos e perguntas em aberto da versão 2.x

- **Complexidade para o vendedor:** quem hoje só recebe mensagem no WhatsApp vai querer um painel de pedidos?
  Validar com vendedores reais antes de construir; o resumo no WhatsApp deve continuar suficiente.
- **Cardápios com preço por tamanho e sabores** (como a pizzaria de teste) exigem opções por item, não só quantidade.
- **Pagamento:** manter só a escolha informada ou aceitar Pix com confirmação? A segunda opção muda o escopo e a
  responsabilidade da plataforma.
- **Responsabilidade por entrega, atraso e cancelamento** continua com o vendedor; os termos de uso precisam dizer isso.
- **Custo e suporte** crescem com pedidos (notificações, disputas): planejar o apoio do admin.
