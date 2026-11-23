-- Dados de exemplo para visualizar o catálogo funcionando localmente.

insert into bairros (nome) values
  ('Centro'),
  ('Vila Nova'),
  ('Jardim das Flores')
on conflict (cidade_id, lower(nome)) do nothing;

insert into categorias (nome, slug) values
  ('Lanches', 'lanches'),
  ('Marmitas', 'marmitas'),
  ('Açaí e Doces', 'acai-e-doces'),
  ('Salgados', 'salgados'),
  ('Pizzaria', 'pizzaria'),
  ('Sushi', 'sushi'),
  ('Hamburgueria', 'hamburgueria'),
  ('Bar', 'bar')
on conflict (nome) do nothing;

with b as (
  select id, nome from bairros
),
c as (
  select id, slug from categorias
)
insert into vendedores (nome, descricao, bairro_id, whatsapp, modo_atendimento, ativo)
select v.nome, v.descricao, b.id, v.whatsapp, v.modo_atendimento::modo_atendimento, true
from (
  values
    ('Lanchonete da Esquina', 'Cheeseburgers artesanais e batata rústica.', 'lanches', 'Centro', '5511999990001', 'ambos'),
    ('Marmitas da Dona Ivone', 'Marmitas caseiras com opção de feijoada aos sábados.', 'marmitas', 'Vila Nova', '5511999990002', 'retirada'),
    ('Açaí do Zé', 'Açaí na tigela com mix de frutas e granola.', 'acai-e-doces', 'Jardim das Flores', '5511999990003', 'entrega'),
    ('Salgados da Tia Fran', 'Coxinhas e risoles fritos na hora.', 'salgados', 'Centro', '5511999990004', 'ambos')
) as v(nome, descricao, cat_slug, bairro_nome, whatsapp, modo_atendimento)
join b on b.nome = v.bairro_nome;

insert into vendedor_categorias (vendedor_id, categoria_id)
select v.id, c.id
from vendedores v
join (
  values
    ('Lanchonete da Esquina', 'lanches'),
    ('Lanchonete da Esquina', 'hamburgueria'),
    ('Marmitas da Dona Ivone', 'marmitas'),
    ('Açaí do Zé', 'acai-e-doces'),
    ('Salgados da Tia Fran', 'salgados')
) as m(nome, slug) on m.nome = v.nome
join categorias c on c.slug = m.slug;

-- Cardápio de exemplo (para testar a busca por produto, no catálogo e dentro da loja).
insert into itens_cardapio (vendedor_id, nome, descricao, preco, ordem)
select v.id, i.nome, i.descricao, i.preco, i.ordem
from vendedores v
join (
  values
    ('Salgados da Tia Fran', 'Pastel de carne', 'Frito na hora', 8.00, 0),
    ('Salgados da Tia Fran', 'Pastel de queijo', null, 7.50, 1),
    ('Salgados da Tia Fran', 'Pastel de frango com catupiry', null, 9.00, 2),
    ('Salgados da Tia Fran', 'Coxinha de frango', null, 7.00, 3),
    ('Salgados da Tia Fran', 'Risoles de presunto e queijo', null, 6.50, 4),
    ('Salgados da Tia Fran', 'Brigadeiro de chocolate belga', 'Doce da casa', 4.00, 5),
    ('Lanchonete da Esquina', 'Cheeseburger clássico', 'Blend 150g, queijo e molho da casa', 22.00, 0),
    ('Lanchonete da Esquina', 'Hambúrguer de carne com bacon', null, 26.00, 1),
    ('Lanchonete da Esquina', 'Batata rústica', 'Com alecrim', 14.00, 2),
    ('Açaí do Zé', 'Açaí 500 ml', 'Banana, morango e granola', 19.00, 0),
    ('Açaí do Zé', 'Milkshake de chocolate', null, 16.00, 1),
    ('Marmitas da Dona Ivone', 'Marmita executiva', 'Arroz, feijão, carne e salada', 18.00, 0)
) as i(loja, nome, descricao, preco, ordem) on i.loja = v.nome;

-- Avaliações já publicadas (nota média e lista no perfil). Em produção elas nascem pendentes, por convite.
insert into avaliacoes (vendedor_id, nota, comentario, autor_nome, aprovada, codigo_verificacao)
select v.id, a.nota, a.comentario, a.autor, true, 'seed-' || md5(v.nome || a.nota || a.comentario)
from vendedores v
join (
  values
    ('Salgados da Tia Fran', 5, 'Pastel crocante e bem recheado. Chegou quentinho!', 'Marina'),
    ('Salgados da Tia Fran', 4, 'Coxinha ótima, só demorou um pouco no sábado.', null),
    ('Lanchonete da Esquina', 5, 'Melhor cheeseburger da cidade.', 'Rafa')
) as a(loja, nota, comentario, autor) on a.loja = v.nome;

-- "Destaque da casa" de exemplo (escolha do vendedor; o selo "Mais pedido" só nasce de toques reais em "Pedir").
update itens_cardapio i
set destaque = true
from vendedores v
where v.id = i.vendedor_id and v.nome = 'Salgados da Tia Fran' and i.nome in ('Pastel de carne', 'Coxinha de frango');

-- Pedidos pelo site de exemplo: a Tia Fran abre todo dia das 07h às 23h e recebe pedidos (taxa de entrega de R$ 4).
insert into horarios_funcionamento (vendedor_id, dia_semana, abre, fecha)
select v.id, d, '07:00', '23:00'
from vendedores v, generate_series(0, 6) d
where v.nome = 'Salgados da Tia Fran';

update vendedores set aceita_pedidos = true, taxa_entrega = 4 where nome = 'Salgados da Tia Fran';

-- Categorias do menu de exemplo (opcionais e de cada loja) e algumas bebidas, para o filtro "Tipo de produto" do catálogo.
-- "Bebidas" e "bebida" têm a mesma chave, então viram um único filtro entre as lojas.
insert into itens_cardapio (vendedor_id, nome, descricao, preco, ordem)
select v.id, i.nome, null, i.preco, i.ordem
from vendedores v
join (
  values
    ('Salgados da Tia Fran', 'Suco de laranja', 6.00, 6),
    ('Salgados da Tia Fran', 'Refrigerante lata', 6.50, 7),
    ('Lanchonete da Esquina', 'Refrigerante lata', 6.00, 3),
    ('Lanchonete da Esquina', 'Suco natural', 8.00, 4),
    ('Açaí do Zé', 'Água de coco', 7.00, 2)
) as i(loja, nome, preco, ordem) on i.loja = v.nome;

insert into categorias_produto (vendedor_id, nome)
select v.id, c.nome
from vendedores v
join (
  values
    ('Salgados da Tia Fran', 'Salgados', 1),
    ('Salgados da Tia Fran', 'Doces', 2),
    ('Salgados da Tia Fran', 'Bebidas', 3),
    ('Lanchonete da Esquina', 'Lanches', 1),
    ('Lanchonete da Esquina', 'Porções', 2),
    ('Lanchonete da Esquina', 'bebida', 3),
    ('Açaí do Zé', 'Açaí', 1),
    ('Açaí do Zé', 'Bebidas', 2)
) as c(loja, nome, pos) on c.loja = v.nome
order by v.nome, c.pos;

update itens_cardapio i
set categoria_produto_id = cp.id
from vendedores v,
  (values
    ('Salgados da Tia Fran', 'Pastel de carne', 'Salgados'),
    ('Salgados da Tia Fran', 'Pastel de queijo', 'Salgados'),
    ('Salgados da Tia Fran', 'Pastel de frango com catupiry', 'Salgados'),
    ('Salgados da Tia Fran', 'Coxinha de frango', 'Salgados'),
    ('Salgados da Tia Fran', 'Risoles de presunto e queijo', 'Salgados'),
    ('Salgados da Tia Fran', 'Brigadeiro de chocolate belga', 'Doces'),
    ('Salgados da Tia Fran', 'Suco de laranja', 'Bebidas'),
    ('Salgados da Tia Fran', 'Refrigerante lata', 'Bebidas'),
    ('Lanchonete da Esquina', 'Cheeseburger clássico', 'Lanches'),
    ('Lanchonete da Esquina', 'Hambúrguer de carne com bacon', 'Lanches'),
    ('Lanchonete da Esquina', 'Batata rústica', 'Porções'),
    ('Lanchonete da Esquina', 'Refrigerante lata', 'Bebida'),
    ('Lanchonete da Esquina', 'Suco natural', 'Bebida'),
    ('Açaí do Zé', 'Açaí 500 ml', 'Açaí'),
    ('Açaí do Zé', 'Milkshake de chocolate', 'Bebidas'),
    ('Açaí do Zé', 'Água de coco', 'Bebidas')
  ) as m(loja, item, cat),
  categorias_produto cp
where v.id = i.vendedor_id and v.nome = m.loja and i.nome = m.item
  and cp.vendedor_id = v.id and cp.chave = chave_categoria(m.cat);

-- "Monte o seu" de exemplo.
-- Pizzaria do Bairro (recebe pedidos pelo site): pizza média R$ 54 com até 2 sabores e grande R$ 62 com até 3, qualquer que seja o sabor.
insert into vendedores (nome, descricao, bairro_id, whatsapp, modo_atendimento, ativo)
select 'Pizzaria do Bairro', 'Pizzas salgadas e doces. Pagamento por Pix, cartão ou dinheiro.', b.id, '5511999990005', 'ambos', true
from bairros b where b.nome = 'Centro';

insert into vendedor_categorias (vendedor_id, categoria_id)
select v.id, c.id from vendedores v, categorias c where v.nome = 'Pizzaria do Bairro' and c.slug = 'pizzaria';

insert into horarios_funcionamento (vendedor_id, dia_semana, abre, fecha)
select v.id, d, '18:00', '23:30' from vendedores v, generate_series(0, 6) d where v.nome = 'Pizzaria do Bairro';

update vendedores set aceita_pedidos = true, taxa_entrega = 6 where nome = 'Pizzaria do Bairro';

insert into categorias_produto (vendedor_id, nome)
select v.id, c.nome
from vendedores v
join (values ('Pizzas salgadas', 1), ('Pizzas doces', 2), ('Bebidas', 3)) as c(nome, pos) on true
where v.nome = 'Pizzaria do Bairro'
order by c.pos;

-- Os sabores são itens normais do menu, sem preço: o preço é o do tamanho.
insert into itens_cardapio (vendedor_id, nome, descricao, preco, ordem, categoria_produto_id)
select v.id, i.nome, i.descricao, i.preco, i.ordem, cp.id
from vendedores v
join (
  values
    ('Calabresa', 'Calabresa fatiada, cebola e azeitona', null::numeric, 1, 'Pizzas salgadas'),
    ('Frango com catupiry', null, null, 2, 'Pizzas salgadas'),
    ('Mussarela', 'Mussarela e tomate', null, 3, 'Pizzas salgadas'),
    ('Portuguesa', 'Presunto, ovo, cebola, ervilha e azeitona', null, 4, 'Pizzas salgadas'),
    ('Quatro queijos', null, null, 5, 'Pizzas salgadas'),
    ('Chocolate com morango', null, null, 6, 'Pizzas doces'),
    ('Banana com canela', null, null, 7, 'Pizzas doces'),
    ('Refrigerante 2 L', null, 14.00, 8, 'Bebidas')
) as i(nome, descricao, preco, ordem, categoria) on true
join categorias_produto cp on cp.vendedor_id = v.id and cp.chave = chave_categoria(i.categoria)
where v.nome = 'Pizzaria do Bairro';

insert into montaveis (vendedor_id, nome, descricao, rotulo_escolhas, max_adicionais)
select id, 'Pizza', 'Massa fininha, assada no forno a lenha.', 'Sabores', 2 from vendedores where nome = 'Pizzaria do Bairro';

insert into montavel_tamanhos (montavel_id, nome, preco, max_escolhas)
select m.id, t.nome, t.preco, t.max_escolhas
from montaveis m
join vendedores v on v.id = m.vendedor_id and v.nome = 'Pizzaria do Bairro'
join (values ('Média (30 cm)', 54.00, 2), ('Grande (35 cm)', 62.00, 3)) as t(nome, preco, max_escolhas) on true
where m.nome = 'Pizza';

insert into montavel_categorias (montavel_id, categoria_produto_id)
select m.id, cp.id
from montaveis m
join categorias_produto cp on cp.vendedor_id = m.vendedor_id and cp.nome in ('Pizzas salgadas', 'Pizzas doces')
join vendedores v on v.id = m.vendedor_id and v.nome = 'Pizzaria do Bairro'
where m.nome = 'Pizza';

insert into montavel_adicionais (montavel_id, nome, preco)
select m.id, a.nome, a.preco
from montaveis m
join vendedores v on v.id = m.vendedor_id and v.nome = 'Pizzaria do Bairro'
join (values ('Borda recheada', 10.00), ('Bacon', 3.00), ('Ovo', 2.00)) as a(nome, preco) on true
where m.nome = 'Pizza';

-- Açaí do Zé (só WhatsApp): tamanho com preço fixo, complementos incluídos e adicionais pagos.
insert into categorias_produto (vendedor_id, nome)
select id, 'Complementos' from vendedores where nome = 'Açaí do Zé';

insert into itens_cardapio (vendedor_id, nome, descricao, preco, ordem, categoria_produto_id)
select v.id, i.nome, null, null, i.ordem, cp.id
from vendedores v
join (values ('Granola', 10), ('Leite em pó', 11), ('Banana', 12), ('Morango', 13), ('Paçoca', 14)) as i(nome, ordem) on true
join categorias_produto cp on cp.vendedor_id = v.id and cp.nome = 'Complementos'
where v.nome = 'Açaí do Zé';

insert into montaveis (vendedor_id, nome, descricao, rotulo_escolhas, escolha_obrigatoria, max_adicionais)
select id, 'Açaí', 'Monte o seu açaí na tigela.', 'Complementos', false, 3 from vendedores where nome = 'Açaí do Zé';

insert into montavel_tamanhos (montavel_id, nome, preco, max_escolhas)
select m.id, t.nome, t.preco, t.max_escolhas
from montaveis m
join vendedores v on v.id = m.vendedor_id and v.nome = 'Açaí do Zé'
join (values ('300 ml', 15.00, 3), ('500 ml', 20.00, 4)) as t(nome, preco, max_escolhas) on true
where m.nome = 'Açaí';

insert into montavel_categorias (montavel_id, categoria_produto_id)
select m.id, cp.id
from montaveis m
join vendedores v on v.id = m.vendedor_id and v.nome = 'Açaí do Zé'
join categorias_produto cp on cp.vendedor_id = m.vendedor_id and cp.nome = 'Complementos'
where m.nome = 'Açaí';

insert into montavel_adicionais (montavel_id, nome, preco)
select m.id, a.nome, a.preco
from montaveis m
join vendedores v on v.id = m.vendedor_id and v.nome = 'Açaí do Zé'
join (values ('Nutella', 5.00), ('Leite condensado', 2.00), ('Castanha', 4.00)) as a(nome, preco) on true
where m.nome = 'Açaí';
