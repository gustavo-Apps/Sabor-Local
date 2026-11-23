-- "Monte o seu": produtos que o cliente monta (pizza, açaí, marmita, lanche...) em vez de pedir um item pronto.
--
-- O vendedor define, para cada produto:
--  * os TAMANHOS, cada um com um preço fixo e quantas escolhas inclui ("Média (30 cm)  R$ 54  até 2 sabores");
--  * de onde vêm as ESCOLHAS incluídas (sabores, acompanhamentos...): são os itens normais do menu de categorias que ele marcar;
--  * os ADICIONAIS pagos ("Bacon  + R$ 3"), com um máximo por pedido.
-- O preço é o do tamanho (as escolhas incluídas não mudam o valor) mais os adicionais. É tudo opcional e só da loja.
--
-- No pedido pelo site, a montagem vira uma linha com nome, preço e detalhes "congelados" (a loja vê "Pizza Grande (35 cm),
-- Sabores: Calabresa, Frango"). O valor é sempre calculado aqui: o cliente manda só ids.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table montaveis (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 40),                       -- "Pizza", "Açaí"
  descricao text check (descricao is null or char_length(descricao) <= 200),
  rotulo_escolhas text not null default 'Sabores' check (char_length(rotulo_escolhas) between 2 and 30),
  escolha_obrigatoria boolean not null default true,                                    -- exige ao menos 1 escolha (quando o tamanho inclui alguma)
  rotulo_adicionais text not null default 'Adicionais' check (char_length(rotulo_adicionais) between 2 and 30),
  max_adicionais int not null default 5 check (max_adicionais between 0 and 20),
  disponivel boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index montaveis_vendedor_idx on montaveis (vendedor_id, ordem);

create table montavel_tamanhos (
  id uuid primary key default gen_random_uuid(),
  montavel_id uuid not null references montaveis (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),                       -- "Média (30 cm)"
  preco numeric(8, 2) not null check (preco > 0 and preco <= 2000),
  max_escolhas int not null default 1 check (max_escolhas between 0 and 10),           -- quantos sabores esse tamanho inclui
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index montavel_tamanhos_idx on montavel_tamanhos (montavel_id, ordem);

-- As escolhas incluídas vêm dos itens destas categorias do menu.
create table montavel_categorias (
  montavel_id uuid not null references montaveis (id) on delete cascade,
  categoria_produto_id uuid not null references categorias_produto (id) on delete cascade,
  primary key (montavel_id, categoria_produto_id)
);

create table montavel_adicionais (
  id uuid primary key default gen_random_uuid(),
  montavel_id uuid not null references montaveis (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 40),                       -- "Bacon"
  preco numeric(8, 2) not null default 0 check (preco >= 0 and preco <= 500),          -- 0 = sem custo
  disponivel boolean not null default true,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index montavel_adicionais_idx on montavel_adicionais (montavel_id, ordem);

-- ---------------------------------------------------------------------------
-- Limpeza dos textos e limites (o que o navegador mandar é conferido aqui)
-- ---------------------------------------------------------------------------

create or replace function texto_limpo(p_texto text)
returns text
language sql
immutable
as $$
  select regexp_replace(trim(regexp_replace(coalesce(p_texto, ''), '[[:cntrl:]]', ' ', 'g')), '\s+', ' ', 'g');
$$;

create or replace function montaveis_preparar()
returns trigger
language plpgsql
as $$
begin
  new.nome := texto_limpo(new.nome);
  new.descricao := nullif(texto_limpo(new.descricao), '');
  new.rotulo_escolhas := texto_limpo(new.rotulo_escolhas);
  new.rotulo_adicionais := texto_limpo(new.rotulo_adicionais);
  if new.nome ~* '(https?:|www\.|@)' or new.rotulo_escolhas ~* '(https?:|www\.|@)' or new.rotulo_adicionais ~* '(https?:|www\.|@)'
     or coalesce(new.descricao, '') ~* '(https?:|www\.|@)' then
    raise exception 'nome_invalido' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if (select count(*) from montaveis where vendedor_id = new.vendedor_id) >= 5 then
      raise exception 'limite_montaveis' using errcode = '23514';
    end if;
    new.ordem := coalesce((select max(ordem) from montaveis where vendedor_id = new.vendedor_id), 0) + 1;
  end if;
  return new;
end;
$$;

create trigger montaveis_preparar
  before insert or update on montaveis
  for each row execute function montaveis_preparar();

create or replace function montavel_tamanhos_preparar()
returns trigger
language plpgsql
as $$
begin
  new.nome := texto_limpo(new.nome);
  if new.nome ~* '(https?:|www\.|@)' then raise exception 'nome_invalido' using errcode = '23514'; end if;
  if tg_op = 'INSERT' then
    if (select count(*) from montavel_tamanhos where montavel_id = new.montavel_id) >= 6 then
      raise exception 'limite_tamanhos' using errcode = '23514';
    end if;
    new.ordem := coalesce((select max(ordem) from montavel_tamanhos where montavel_id = new.montavel_id), 0) + 1;
  end if;
  return new;
end;
$$;

create trigger montavel_tamanhos_preparar
  before insert or update on montavel_tamanhos
  for each row execute function montavel_tamanhos_preparar();

create or replace function montavel_adicionais_preparar()
returns trigger
language plpgsql
as $$
begin
  new.nome := texto_limpo(new.nome);
  if new.nome ~* '(https?:|www\.|@)' then raise exception 'nome_invalido' using errcode = '23514'; end if;
  if tg_op = 'INSERT' then
    if (select count(*) from montavel_adicionais where montavel_id = new.montavel_id) >= 30 then
      raise exception 'limite_adicionais' using errcode = '23514';
    end if;
    new.ordem := coalesce((select max(ordem) from montavel_adicionais where montavel_id = new.montavel_id), 0) + 1;
  end if;
  return new;
end;
$$;

create trigger montavel_adicionais_preparar
  before insert or update on montavel_adicionais
  for each row execute function montavel_adicionais_preparar();

-- A categoria das escolhas tem que ser da mesma loja do produto.
create or replace function montavel_categorias_da_mesma_loja()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from montaveis m join categorias_produto c on c.vendedor_id = m.vendedor_id
    where m.id = new.montavel_id and c.id = new.categoria_produto_id
  ) then
    raise exception 'categoria_invalida' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger montavel_categorias_da_loja
  before insert or update on montavel_categorias
  for each row execute function montavel_categorias_da_mesma_loja();

-- ---------------------------------------------------------------------------
-- Quem vê e quem muda
-- ---------------------------------------------------------------------------

alter table montaveis enable row level security;
alter table montavel_tamanhos enable row level security;
alter table montavel_categorias enable row level security;
alter table montavel_adicionais enable row level security;

create policy "montaveis_select_public" on montaveis
  for select using (exists (select 1 from vendedores v where v.id = montaveis.vendedor_id and (v.ativo or v.owner_id = auth.uid())));
create policy "montaveis_manage_own" on montaveis
  for all
  using (exists (select 1 from vendedores v where v.id = montaveis.vendedor_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from vendedores v where v.id = montaveis.vendedor_id and v.owner_id = auth.uid()));
create policy "montaveis_admin_all" on montaveis
  for all using (is_admin()) with check (is_admin());

-- As três tabelas filhas seguem o produto: quem vê o produto vê os tamanhos, as categorias e os adicionais; só o dono muda.
create policy "montavel_tamanhos_select_public" on montavel_tamanhos
  for select using (exists (
    select 1 from montaveis m join vendedores v on v.id = m.vendedor_id
    where m.id = montavel_tamanhos.montavel_id and (v.ativo or v.owner_id = auth.uid())
  ));
create policy "montavel_tamanhos_manage_own" on montavel_tamanhos
  for all
  using (exists (
    select 1 from montaveis m join vendedores v on v.id = m.vendedor_id
    where m.id = montavel_tamanhos.montavel_id and v.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from montaveis m join vendedores v on v.id = m.vendedor_id
    where m.id = montavel_tamanhos.montavel_id and v.owner_id = auth.uid()
  ));
create policy "montavel_tamanhos_admin_all" on montavel_tamanhos
  for all using (is_admin()) with check (is_admin());

create policy "montavel_categorias_select_public" on montavel_categorias
  for select using (exists (
    select 1 from montaveis m join vendedores v on v.id = m.vendedor_id
    where m.id = montavel_categorias.montavel_id and (v.ativo or v.owner_id = auth.uid())
  ));
create policy "montavel_categorias_manage_own" on montavel_categorias
  for all
  using (exists (
    select 1 from montaveis m join vendedores v on v.id = m.vendedor_id
    where m.id = montavel_categorias.montavel_id and v.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from montaveis m join vendedores v on v.id = m.vendedor_id
    where m.id = montavel_categorias.montavel_id and v.owner_id = auth.uid()
  ));
create policy "montavel_categorias_admin_all" on montavel_categorias
  for all using (is_admin()) with check (is_admin());

create policy "montavel_adicionais_select_public" on montavel_adicionais
  for select using (exists (
    select 1 from montaveis m join vendedores v on v.id = m.vendedor_id
    where m.id = montavel_adicionais.montavel_id and (v.ativo or v.owner_id = auth.uid())
  ));
create policy "montavel_adicionais_manage_own" on montavel_adicionais
  for all
  using (exists (
    select 1 from montaveis m join vendedores v on v.id = m.vendedor_id
    where m.id = montavel_adicionais.montavel_id and v.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from montaveis m join vendedores v on v.id = m.vendedor_id
    where m.id = montavel_adicionais.montavel_id and v.owner_id = auth.uid()
  ));
create policy "montavel_adicionais_admin_all" on montavel_adicionais
  for all using (is_admin()) with check (is_admin());

create trigger montaveis_historico after insert or update or delete on montaveis
  for each row execute function log_historico();

-- ---------------------------------------------------------------------------
-- O que o pedido guarda de uma montagem
-- ---------------------------------------------------------------------------

alter table pedido_itens
  add column montavel_id uuid references montaveis (id) on delete set null,
  add column detalhes jsonb check (detalhes is null or jsonb_typeof(detalhes) = 'array');
-- detalhes: [{"rotulo": "Sabores", "opcoes": [{"nome": "Calabresa"}]}, {"rotulo": "Adicionais", "opcoes": [{"nome": "Bacon", "preco": 3}]}]

-- ---------------------------------------------------------------------------
-- Confere uma montagem do cliente e calcula o preço (só criar_pedido chama)
--   p_linha: {"montavel_id", "tamanho_id", "escolhas": [ids de itens], "adicionais": [ids]}
-- ---------------------------------------------------------------------------

create or replace function resolver_montagem(p_vendedor uuid, p_linha jsonb, p_hoje date)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  m montaveis%rowtype;
  t montavel_tamanhos%rowtype;
  v_montavel uuid;
  v_tamanho uuid;
  v_escolhas uuid[];
  v_adicionais uuid[];
  v_n int;
  v_opcoes jsonb;
  v_extras numeric(10, 2);
  v_detalhes jsonb := '[]'::jsonb;
begin
  -- formato: ids de verdade, listas pequenas e sem repetição
  begin
    v_montavel := (p_linha ->> 'montavel_id')::uuid;
    v_tamanho := (p_linha ->> 'tamanho_id')::uuid;
    if jsonb_typeof(coalesce(p_linha -> 'escolhas', '[]'::jsonb)) <> 'array'
       or jsonb_typeof(coalesce(p_linha -> 'adicionais', '[]'::jsonb)) <> 'array' then
      raise exception 'x';
    end if;
    select coalesce(array_agg(x::uuid), '{}'::uuid[]) into v_escolhas from jsonb_array_elements_text(coalesce(p_linha -> 'escolhas', '[]'::jsonb)) x;
    select coalesce(array_agg(x::uuid), '{}'::uuid[]) into v_adicionais from jsonb_array_elements_text(coalesce(p_linha -> 'adicionais', '[]'::jsonb)) x;
  exception when others then
    raise exception 'montagem_invalida';
  end;
  if v_montavel is null or v_tamanho is null
     or cardinality(v_escolhas) > 10 or cardinality(v_adicionais) > 20
     or (select count(distinct x) from unnest(v_escolhas) x) <> cardinality(v_escolhas)
     or (select count(distinct x) from unnest(v_adicionais) x) <> cardinality(v_adicionais) then
    raise exception 'montagem_invalida';
  end if;

  select * into m from montaveis where id = v_montavel and vendedor_id = p_vendedor and disponivel;
  if not found then raise exception 'montagem_indisponivel'; end if;
  select * into t from montavel_tamanhos where id = v_tamanho and montavel_id = m.id;
  if not found then raise exception 'montagem_indisponivel'; end if;

  -- escolhas incluídas: até o máximo do tamanho (e ao menos uma, se o vendedor exige e o tamanho inclui alguma)
  if cardinality(v_escolhas) > t.max_escolhas then raise exception 'montagem_invalida'; end if;
  if m.escolha_obrigatoria and t.max_escolhas > 0 and cardinality(v_escolhas) = 0 then raise exception 'montagem_invalida'; end if;

  if cardinality(v_escolhas) > 0 then
    select count(*), coalesce(jsonb_agg(jsonb_build_object('nome', i.nome) order by i.ordem, i.created_at), '[]'::jsonb)
      into v_n, v_opcoes
    from itens_cardapio i
    where i.id = any (v_escolhas)
      and i.vendedor_id = p_vendedor
      and (i.disponivel or (i.indisponivel_ate is not null and i.indisponivel_ate < p_hoje))
      and exists (
        select 1 from montavel_categorias mc
        where mc.montavel_id = m.id and mc.categoria_produto_id = i.categoria_produto_id
      );
    if v_n <> cardinality(v_escolhas) then raise exception 'montagem_indisponivel'; end if;
    v_detalhes := v_detalhes || jsonb_build_array(jsonb_build_object('rotulo', m.rotulo_escolhas, 'opcoes', v_opcoes));
  end if;

  -- adicionais pagos: até o máximo do produto
  v_extras := 0;
  if cardinality(v_adicionais) > m.max_adicionais then raise exception 'montagem_invalida'; end if;
  if cardinality(v_adicionais) > 0 then
    select count(*), coalesce(sum(a.preco), 0),
           coalesce(jsonb_agg(jsonb_build_object('nome', a.nome, 'preco', a.preco) order by a.ordem, a.created_at), '[]'::jsonb)
      into v_n, v_extras, v_opcoes
    from montavel_adicionais a
    where a.id = any (v_adicionais) and a.montavel_id = m.id and a.disponivel;
    if v_n <> cardinality(v_adicionais) then raise exception 'montagem_indisponivel'; end if;
    v_detalhes := v_detalhes || jsonb_build_array(jsonb_build_object('rotulo', m.rotulo_adicionais, 'opcoes', v_opcoes));
  end if;

  return jsonb_build_object(
    'montavel_id', m.id,
    'nome', m.nome || ' ' || t.nome,
    'preco', t.preco + v_extras,
    'detalhes', v_detalhes
  );
end;
$$;

revoke all on function resolver_montagem(uuid, jsonb, date) from public, anon, authenticated;
grant execute on function resolver_montagem(uuid, jsonb, date) to service_role;

-- ---------------------------------------------------------------------------
-- criar_pedido: agora aceita, além de {"item_id", "quantidade"}, montagens
--   {"montavel_id", "tamanho_id", "escolhas": [...], "adicionais": [...], "quantidade"}
-- ---------------------------------------------------------------------------

create or replace function criar_pedido(
  p_vendedor uuid,
  p_itens jsonb,
  p_modo text,
  p_nome text,
  p_telefone text,
  p_endereco text,
  p_pagamento text,
  p_troco numeric default null,
  p_observacoes text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v vendedores%rowtype;
  v_ip text := ip_da_requisicao();
  v_ip_hash text := case when ip_da_requisicao() is null then null else md5(ip_da_requisicao()) end;
  v_nome text := regexp_replace(trim(regexp_replace(coalesce(p_nome, ''), '[[:cntrl:]]', ' ', 'g')), '\s+', ' ', 'g');
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_end text := nullif(regexp_replace(trim(regexp_replace(coalesce(p_endereco, ''), '[[:cntrl:]]', ' ', 'g')), '\s+', ' ', 'g'), '');
  v_obs text := nullif(regexp_replace(trim(regexp_replace(coalesce(p_observacoes, ''), '[[:cntrl:]]', ' ', 'g')), '\s+', ' ', 'g'), '');
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  e jsonb;
  v_qtd int;
  v_item itens_cardapio%rowtype;
  v_montagem jsonb;
  v_vistos uuid[] := '{}';
  v_linhas jsonb := '[]'::jsonb;
  v_subtotal numeric(12, 2) := 0;
  v_sob_consulta boolean := false;
  v_taxa numeric(8, 2);
  v_total numeric(12, 2);
  v_troco numeric(10, 2) := null;
  v_numero int;
  v_token text;
  v_pedido uuid;
begin
  select * into v from vendedores where id = p_vendedor;
  if not found or not v.ativo or not v.aceita_pedidos then raise exception 'loja_nao_aceita_pedidos'; end if;
  if auth.uid() is not null and v.owner_id = auth.uid() then raise exception 'loja_propria'; end if;
  if not loja_aberta_agora(p_vendedor) then raise exception 'loja_fechada'; end if;

  -- dados do cliente
  if p_modo not in ('entrega', 'retirada') or (v.modo_atendimento::text <> 'ambos' and v.modo_atendimento::text <> p_modo) then
    raise exception 'modo_invalido';
  end if;
  if char_length(v_nome) not between 2 and 60 then raise exception 'nome_invalido'; end if;
  if v_tel ~ '^[0-9]{10,11}$' then v_tel := '55' || v_tel; end if;
  if v_tel !~ '^55[0-9]{10,11}$' then raise exception 'telefone_invalido'; end if;
  if substr(v_tel, 3, 2)::int < 11 then raise exception 'telefone_invalido'; end if;
  if p_modo = 'entrega' and (v_end is null or char_length(v_end) < 5) then raise exception 'endereco_obrigatorio'; end if;
  if char_length(coalesce(v_end, '')) > 200 then raise exception 'endereco_longo'; end if;
  if p_modo = 'retirada' then v_end := null; end if;
  if char_length(coalesce(v_obs, '')) > 300 then raise exception 'observacoes_longas'; end if;
  if p_pagamento is null or not (p_pagamento = any (v.pagamentos_aceitos)) then raise exception 'pagamento_invalido'; end if;

  -- itens: de 1 a 30 linhas, cada uma com quantidade de 1 a 20
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) not between 1 and 30 then
    raise exception 'itens_invalidos';
  end if;

  for e in select value from jsonb_array_elements(p_itens) loop
    begin
      if jsonb_typeof(e) <> 'object' then raise exception 'x'; end if;
      v_qtd := (e ->> 'quantidade')::int;
    exception when others then
      raise exception 'itens_invalidos';
    end;
    if v_qtd is null or v_qtd not between 1 and 20 then raise exception 'itens_invalidos'; end if;

    if e ? 'montavel_id' then
      -- montagem (pizza, açaí...): o preço sai do tamanho escolhido mais os adicionais
      v_montagem := resolver_montagem(p_vendedor, e, v_hoje);
      v_linhas := v_linhas || jsonb_build_array(jsonb_build_object(
        'item_id', null, 'montavel_id', v_montagem -> 'montavel_id', 'nome', v_montagem ->> 'nome',
        'preco', (v_montagem ->> 'preco')::numeric, 'quantidade', v_qtd, 'detalhes', v_montagem -> 'detalhes'
      ));
      v_subtotal := v_subtotal + (v_montagem ->> 'preco')::numeric * v_qtd;
    else
      -- item comum: só desta loja e disponível (um item "indisponível até uma data" volta a valer depois dela)
      if (e ->> 'item_id') is null then raise exception 'itens_invalidos'; end if;
      begin
        select * into v_item from itens_cardapio where id = (e ->> 'item_id')::uuid and vendedor_id = p_vendedor;
      exception when others then
        raise exception 'itens_invalidos';
      end;
      if not found or not (v_item.disponivel or (v_item.indisponivel_ate is not null and v_item.indisponivel_ate < v_hoje)) then
        raise exception 'item_indisponivel';
      end if;
      if v_item.id = any (v_vistos) then raise exception 'itens_invalidos'; end if;
      v_vistos := v_vistos || v_item.id;

      v_linhas := v_linhas || jsonb_build_array(jsonb_build_object(
        'item_id', v_item.id, 'montavel_id', null, 'nome', v_item.nome, 'preco', v_item.preco, 'quantidade', v_qtd, 'detalhes', null
      ));
      v_subtotal := v_subtotal + coalesce(v_item.preco, 0) * v_qtd;
      if v_item.preco is null then v_sob_consulta := true; end if;
    end if;
  end loop;

  v_taxa := case when p_modo = 'entrega' then v.taxa_entrega else 0 end;
  v_total := v_subtotal + v_taxa;
  if v_total > 5000 then raise exception 'pedido_grande'; end if;

  if p_pagamento = 'dinheiro' and p_troco is not null then
    if p_troco < v_total or p_troco > 10000 then raise exception 'troco_invalido'; end if;
    v_troco := p_troco;
  end if;

  -- contra pedido falso
  if exists (
    select 1 from clientes_bloqueados
    where vendedor_id = p_vendedor and telefone_hash = encode(sha256(convert_to(v_tel, 'UTF8')), 'hex')
  ) then
    raise exception 'cliente_bloqueado';
  end if;
  if v_ip_hash is not null and (
    select count(*) from pedidos where ip_hash = v_ip_hash and criado_em > now() - interval '1 hour'
  ) >= 5 then
    raise exception 'muitos_pedidos';
  end if;
  if (
    select count(*) from pedidos where vendedor_id = p_vendedor and cliente_telefone = v_tel and criado_em > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'muitos_pedidos';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_vendedor::text, 0));
  select coalesce(max(numero), 0) + 1 into v_numero from pedidos where vendedor_id = p_vendedor;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); -- 64 caracteres aleatórios

  insert into pedidos (
    vendedor_id, numero, token_hash, modo, cliente_nome, cliente_telefone, endereco, observacoes, pagamento, troco_para,
    subtotal, taxa_entrega, total, tem_item_sob_consulta, ip_hash
  ) values (
    p_vendedor, v_numero, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), p_modo, v_nome, v_tel, v_end, v_obs, p_pagamento, v_troco,
    v_subtotal, v_taxa, v_total, v_sob_consulta, v_ip_hash
  ) returning id into v_pedido;

  insert into pedido_itens (pedido_id, item_id, montavel_id, nome, preco_unit, quantidade, detalhes)
  select v_pedido, (l ->> 'item_id')::uuid, (l ->> 'montavel_id')::uuid, l ->> 'nome', (l ->> 'preco')::numeric,
         (l ->> 'quantidade')::int, case when jsonb_typeof(l -> 'detalhes') = 'array' then l -> 'detalhes' else null end
  from jsonb_array_elements(v_linhas) l;

  return json_build_object(
    'numero', v_numero, 'token', v_token, 'subtotal', v_subtotal, 'taxa_entrega', v_taxa, 'total', v_total,
    'tem_item_sob_consulta', v_sob_consulta
  );
end;
$$;

revoke all on function criar_pedido(uuid, jsonb, text, text, text, text, text, numeric, text) from public;
grant execute on function criar_pedido(uuid, jsonb, text, text, text, text, text, numeric, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- O cliente que acompanha o pedido também vê os detalhes da montagem
-- ---------------------------------------------------------------------------

create or replace function pedido_por_token(p_token text)
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  p pedidos%rowtype;
  v vendedores%rowtype;
begin
  select * into p from pedidos where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if not found then return json_build_object('estado', 'invalido'); end if;
  select * into v from vendedores where id = p.vendedor_id;

  return json_build_object(
    'estado', 'ok',
    'numero', p.numero, 'status', p.status, 'modo', p.modo, 'pagamento', p.pagamento, 'troco_para', p.troco_para,
    'nome', p.cliente_nome, 'telefone', p.cliente_telefone, 'endereco', p.endereco, 'observacoes', p.observacoes,
    'subtotal', p.subtotal, 'taxa_entrega', p.taxa_entrega, 'total', p.total, 'tem_item_sob_consulta', p.tem_item_sob_consulta,
    'motivo_cancelamento', p.motivo_cancelamento, 'cancelado_por', p.cancelado_por,
    'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em,
    'pode_avaliar', (p.status = 'concluido' and not p.avaliado),
    'avaliado', p.avaliado,
    'moderada', (select avaliacoes_exigem_aprovacao from configuracoes),
    'loja', json_build_object('id', v.id, 'nome', v.nome, 'whatsapp', v.whatsapp),
    'itens', coalesce((
      select json_agg(
        json_build_object('nome', i.nome, 'preco_unit', i.preco_unit, 'quantidade', i.quantidade, 'detalhes', i.detalhes)
        order by i.nome, i.preco_unit, i.id
      )
      from pedido_itens i where i.pedido_id = p.id
    ), '[]'::json)
  );
end;
$$;

revoke all on function pedido_por_token(text) from public;
grant execute on function pedido_por_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- "Baixar meus dados" passa a incluir os produtos montáveis
-- ---------------------------------------------------------------------------

create or replace function exportar_meus_dados()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil perfis_vendedor%rowtype;
  v_vend vendedores%rowtype;
  v_usuario record;
begin
  if v_uid is null then raise exception 'sem_login'; end if;

  select * into v_perfil from perfis_vendedor where user_id = v_uid;
  select * into v_vend from vendedores where owner_id = v_uid limit 1;
  select email, created_at, last_sign_in_at into v_usuario from auth.users where id = v_uid;

  return jsonb_build_object(
    'gerado_em', now(),
    'sobre_este_arquivo',
      'Dados da sua conta no Sabor Local (Lei 13.709/2018, LGPD). Não inclui denúncias recebidas, o link secreto dos convites de avaliação, o e-mail completo dos clientes convidados nem dados de outras pessoas.',
    'conta', jsonb_build_object(
      'email', v_usuario.email,
      'usuario', v_perfil.username,
      'criada_em', v_usuario.created_at,
      'ultimo_acesso', v_usuario.last_sign_in_at,
      'termos_aceitos_em', v_perfil.termos_aceitos_em,
      'termos_versao', v_perfil.termos_versao
    ),
    'perfil', case when v_vend.id is null then null else
      (to_jsonb(v_vend) - 'owner_id' - 'bairro_id' - 'cidade_id')
      || jsonb_build_object(
        'bairro', (select nome from bairros where id = v_vend.bairro_id),
        'cidade', (select nome from cidades where id = v_vend.cidade_id)
      ) end,
    'ramos', coalesce((
      select jsonb_agg(c.nome order by c.nome)
      from vendedor_categorias vc join categorias c on c.id = vc.categoria_id
      where vc.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'horarios', coalesce((
      select jsonb_agg(jsonb_build_object('dia_semana', h.dia_semana, 'abre', h.abre, 'fecha', h.fecha) order by h.dia_semana, h.abre)
      from horarios_funcionamento h where h.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'datas_especiais', coalesce((
      select jsonb_agg(jsonb_build_object('data', e.data, 'fechado', e.fechado, 'abre', e.abre, 'fecha', e.fecha, 'motivo', e.motivo) order by e.data)
      from excecoes_horario e where e.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'categorias_do_menu', coalesce((
      select jsonb_agg(c.nome order by c.ordem, c.created_at)
      from categorias_produto c where c.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'menu', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', i.nome, 'descricao', i.descricao, 'preco', i.preco, 'foto_url', i.foto_url,
        'disponivel', i.disponivel, 'indisponivel_ate', i.indisponivel_ate,
        'categoria', (select c.nome from categorias_produto c where c.id = i.categoria_produto_id)
      ) order by i.ordem, i.created_at)
      from itens_cardapio i where i.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'monte_o_seu', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', m.nome, 'descricao', m.descricao, 'disponivel', m.disponivel,
        'nome_das_escolhas', m.rotulo_escolhas, 'escolha_obrigatoria', m.escolha_obrigatoria,
        'nome_dos_adicionais', m.rotulo_adicionais, 'max_adicionais', m.max_adicionais,
        'categorias_das_escolhas', coalesce((
          select jsonb_agg(c.nome order by c.ordem)
          from montavel_categorias mc join categorias_produto c on c.id = mc.categoria_produto_id
          where mc.montavel_id = m.id
        ), '[]'::jsonb),
        'tamanhos', coalesce((
          select jsonb_agg(jsonb_build_object('nome', t.nome, 'preco', t.preco, 'max_escolhas', t.max_escolhas) order by t.ordem)
          from montavel_tamanhos t where t.montavel_id = m.id
        ), '[]'::jsonb),
        'adicionais', coalesce((
          select jsonb_agg(jsonb_build_object('nome', a.nome, 'preco', a.preco, 'disponivel', a.disponivel) order by a.ordem)
          from montavel_adicionais a where a.montavel_id = m.id
        ), '[]'::jsonb)
      ) order by m.ordem)
      from montaveis m where m.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'avaliacoes_recebidas', coalesce((
      select jsonb_agg(jsonb_build_object('nota', a.nota, 'comentario', a.comentario, 'publicada', a.aprovada, 'data', a.created_at) order by a.created_at)
      from avaliacoes a where a.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'convites_de_avaliacao', coalesce((
      select jsonb_agg(jsonb_build_object(
        'criado_em', c.criado_em, 'email_mascarado', c.email_mascarado,
        'situacao', case when c.usado_em is not null then 'avaliou' when c.cancelado_em is not null then 'cancelado' when c.expira_em < now() then 'expirado' else 'pendente' end
      ) order by c.criado_em)
      from convites_avaliacao c where c.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'pagamentos_do_destaque', coalesce((
      select jsonb_agg(jsonb_build_object(
        'valor', g.valor, 'forma', g.forma, 'dias', g.dias, 'destaque_de', g.destaque_de,
        'destaque_ate', g.destaque_ate, 'observacao', g.observacao, 'registrado_em', g.created_at
      ) order by g.created_at)
      from pagamentos g where g.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'uso_do_perfil', jsonb_build_object(
      'visitas_ao_perfil', (select count(*) from eventos where vendedor_id = v_vend.id and tipo = 'visita_vendedor'),
      'toques_no_whatsapp', (select count(*) from eventos where vendedor_id = v_vend.id and tipo = 'whatsapp')
    ),
    'historico_de_alteracoes', coalesce((
      select jsonb_agg(jsonb_build_object('data', h.created_at, 'o_que', h.entidade, 'acao', h.acao) order by h.created_at)
      from historico h where h.vendedor_id = v_vend.id and h.entidade <> 'denuncias'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function exportar_meus_dados() from public, anon;
grant execute on function exportar_meus_dados() to authenticated;
