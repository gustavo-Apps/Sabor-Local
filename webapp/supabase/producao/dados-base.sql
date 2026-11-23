-- Dados de base para o banco de PRODUÇÃO (o seed.sql NÃO vai para produção).
--
-- Como usar: abra o SQL Editor do Supabase (projeto de produção), troque os valores marcados
-- com "EDITE" e rode o arquivo inteiro. Pode rodar de novo: não duplica nada.
-- Antes disso, as migrations já precisam estar aplicadas (`npx supabase db push`).

-- ---------------------------------------------------------------------------
-- 1. Cidade. A migration criou a "Cidade piloto"; aqui ela vira a sua cidade real.
-- ---------------------------------------------------------------------------
update cidades
set nome = 'Sua Cidade',      -- EDITE: nome da cidade
    uf   = 'MG',              -- EDITE: estado (2 letras) ou null
    slug = 'sua-cidade'       -- EDITE: endereço curto, só letras minúsculas, números e hífen
where slug = 'cidade-piloto';

-- ---------------------------------------------------------------------------
-- 2. Bairros da cidade
-- ---------------------------------------------------------------------------
insert into bairros (nome, cidade_id)
select b.nome, c.id
from (values
  ('Centro'),                -- EDITE: um bairro por linha
  ('Vila Nova'),
  ('Jardim das Flores')
) as b(nome)
cross join (select id from cidades where slug = 'sua-cidade') as c   -- EDITE: o mesmo slug acima
on conflict (cidade_id, lower(nome)) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Ramos de atuação (usados no cadastro do vendedor e no filtro do catálogo)
-- ---------------------------------------------------------------------------
insert into categorias (nome, slug) values
  ('Pizzaria', 'pizzaria'),
  ('Lanches', 'lanches'),
  ('Hamburgueria', 'hamburgueria'),
  ('Marmitas', 'marmitas'),
  ('Salgados', 'salgados'),
  ('Açaí e Doces', 'acai-e-doces'),
  ('Sushi', 'sushi'),
  ('Bar', 'bar')
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Conferência: deve listar a sua cidade, os bairros e os ramos
-- ---------------------------------------------------------------------------
select c.nome as cidade, c.uf, c.slug, count(b.id) as bairros
from cidades c
left join bairros b on b.cidade_id = c.id
group by c.id
order by c.created_at;

select nome, slug from categorias order by nome;

-- ---------------------------------------------------------------------------
-- 5. Administrador (depois de criar a SUA conta pelo site): troque o e-mail e rode
-- ---------------------------------------------------------------------------
-- insert into admins (user_id)
-- select id from auth.users where email = 'seu-email@exemplo.com'
-- on conflict do nothing;
