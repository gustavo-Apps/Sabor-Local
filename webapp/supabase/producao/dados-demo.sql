-- Sabor Local: vendedores FICTÍCIOS para ambiente de teste/beta.
--
-- Rode no SQL Editor do Supabase DEPOIS de ter aplicado as migrations e o dados-base.sql
-- (precisa existir ao menos 1 bairro e os ramos). Pode rodar de novo: não duplica.
--
-- Todos têm WhatsApp que começa com 550099 (DDD inexistente), é assim que se reconhecem.
-- Não têm dono (sem conta de login) e já nascem aprovados e visíveis.
--
-- REMOVER depois (apaga também menu, horários e ramos, por cascata):
--   delete from vendedores where whatsapp like '550099%';

do $$
declare
  v_bairros uuid[];
  v_vend uuid;
  r record;
  i int := 0;
begin
  select array_agg(b.id order by b.nome) into v_bairros
  from bairros b
  where b.cidade_id = cidade_padrao();

  if v_bairros is null then
    raise exception 'Nenhum bairro na cidade padrão. Rode o dados-base.sql antes.';
  end if;

  for r in
    select * from (values
      ('Pizzaria Demo do Bairro', 'Pizzas artesanais no forno a lenha. Dados fictícios de teste.',
       '550099000001', 'entrega',  array['pizzaria'],               '18:00', '23:00',
       '[["Pizza média (30 cm)", "Até 2 sabores", 45.00],
         ["Pizza grande (35 cm)", "Até 3 sabores", 58.00],
         ["Calabresa", "Molho, mussarela, calabresa e cebola", 0],
         ["Mussarela", "Molho, mussarela, tomate e orégano", 0],
         ["Frango com catupiry", "Molho, frango desfiado e catupiry", 0],
         ["Portuguesa", "Presunto, ovo, cebola, pimentão e azeitona", 0],
         ["Chocolate com morango", "Pizza doce", 0],
         ["Borda recheada", "Adicional de catupiry ou cheddar", 8.00],
         ["Refrigerante 2L", "", 12.00],
         ["Suco de laranja 500 ml", "", 9.00]]'::jsonb),
      ('Lanchonete Demo', 'Lanches, porções e sucos. Dados fictícios de teste.',
       '550099000002', 'ambos',    array['lanches','hamburgueria'], '17:30', '23:30',
       '[["X-Burger", "Pão, hambúrguer, queijo, alface e tomate", 22.00],
         ["X-Bacon", "Pão, hambúrguer, queijo e bacon crocante", 28.00],
         ["X-Salada", "Pão, hambúrguer, queijo, alface, tomate e milho", 24.00],
         ["X-Tudo", "Hambúrguer, ovo, bacon, presunto, queijo e salada", 34.00],
         ["Cachorro-quente", "Duas salsichas, purê, vinagrete e batata palha", 16.00],
         ["Batata frita", "Porção média", 18.00],
         ["Onion rings", "Porção com 10 anéis", 20.00],
         ["Refrigerante lata", "", 6.00],
         ["Suco natural", "Laranja, limão ou abacaxi", 9.00]]'::jsonb),
      ('Marmitas da Dona Demo', 'Comida caseira, marmita do dia. Dados fictícios de teste.',
       '550099000003', 'entrega',  array['marmitas'],               '11:00', '14:00',
       '[["Marmita pequena", "Arroz, feijão, mistura e salada", 18.00],
         ["Marmita grande", "Arroz, feijão, duas misturas e salada", 24.00],
         ["Frango grelhado", "Mistura do dia", 0],
         ["Bife acebolado", "Mistura do dia", 0],
         ["Strogonoff de frango", "Acompanha batata palha", 0],
         ["Feijoada (sábado)", "Marmita grande com couve e laranja", 28.00],
         ["Suco 300 ml", "", 5.00],
         ["Sobremesa do dia", "Pudim ou mousse", 6.00]]'::jsonb),
      ('Doces e Açaí Demo', 'Açaí no copo, bolos e brigadeiros. Dados fictícios de teste.',
       '550099000004', 'retirada', array['acai-e-doces'],           '14:00', '21:00',
       '[["Açaí 300 ml", "Com 3 acompanhamentos", 15.00],
         ["Açaí 500 ml", "Com 4 acompanhamentos", 21.00],
         ["Açaí 1 litro", "Com 6 acompanhamentos", 38.00],
         ["Adicional: leite em pó", "", 2.00],
         ["Adicional: morango", "", 3.00],
         ["Brigadeiro (un.)", "", 3.50],
         ["Bolo no pote", "Chocolate, cenoura ou ninho com morango", 10.00],
         ["Torta de limão (fatia)", "", 9.00],
         ["Milkshake 400 ml", "Chocolate, morango ou baunilha", 16.00]]'::jsonb),
      ('Sushi Demo', 'Combinados e temakis. Dados fictícios de teste.',
       '550099000005', 'ambos',    array['sushi','bar'],            '19:00', '23:30',
       '[["Combinado 20 peças", "Uramaki, hossomaki e nigiri", 49.90],
         ["Combinado 40 peças", "Ideal para 2 pessoas", 92.00],
         ["Temaki salmão", "", 27.00],
         ["Temaki skin", "", 22.00],
         ["Hot roll (10 peças)", "Salmão empanado com molho tarê", 26.00],
         ["Sashimi de salmão (8 fatias)", "", 34.00],
         ["Yakisoba", "Carne, frango ou misto", 32.00],
         ["Cerveja long neck", "", 9.00],
         ["Caipirinha", "Limão, morango ou maracujá", 16.00]]'::jsonb)
    ) as t(nome, descricao, whatsapp, modo, ramos, abre, fecha, menu)
  loop
    i := i + 1;

    select id into v_vend from vendedores where whatsapp = r.whatsapp;
    if v_vend is null then
      insert into vendedores (nome, descricao, whatsapp, modo_atendimento, bairro_id, ativo, aprovado_em)
      values (r.nome, r.descricao, r.whatsapp, r.modo::modo_atendimento,
              v_bairros[1 + (i - 1) % array_length(v_bairros, 1)], true, now())
      returning id into v_vend;

      insert into vendedor_categorias (vendedor_id, categoria_id)
      select v_vend, c.id from categorias c where c.slug = any (r.ramos);

      -- terça a domingo
      insert into horarios_funcionamento (vendedor_id, dia_semana, abre, fecha)
      select v_vend, d, r.abre::time, r.fecha::time from unnest(array[0,2,3,4,5,6]) as d;
    end if;

    -- itens: completa o que faltar (preço 0 no JSON = "sob consulta", fica sem preço)
    insert into itens_cardapio (vendedor_id, nome, descricao, preco, ordem)
    select v_vend, e ->> 0, nullif(e ->> 1, ''), nullif((e ->> 2)::numeric, 0), ord::int
    from jsonb_array_elements(r.menu) with ordinality as t(e, ord)
    where not exists (
      select 1 from itens_cardapio x where x.vendedor_id = v_vend and x.nome = e ->> 0
    );
  end loop;
end $$;

-- Conferência
select v.nome, v.whatsapp, b.nome as bairro, v.ativo,
       (select count(*) from itens_cardapio i where i.vendedor_id = v.id) as itens
from vendedores v
join bairros b on b.id = v.bairro_id
where v.whatsapp like '550099%'
order by v.whatsapp;
