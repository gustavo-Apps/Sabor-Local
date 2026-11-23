-- Categorias de produto: o vendedor (se quiser) organiza o próprio menu em categorias como "Bebidas", "Salgados", "Doces",
-- "Xis" ou "Cachorro quente" e coloca cada item na sua. É opcional e individual: cada loja tem as suas.
-- Serve para o cliente filtrar a busca por tipo de produto ("só as bebidas") e para o menu da loja aparecer em seções.
--
-- Para o filtro funcionar entre lojas, cada nome ganha uma "chave" sem acento, maiúsculas, pontuação e plural simples:
-- "Bebidas", "bebida" e "BEBIDA" têm a mesma chave e viram um único filtro no catálogo. A chave é calculada aqui no banco.

-- ---------------------------------------------------------------------------
-- Chave de comparação
-- ---------------------------------------------------------------------------

-- Reaproveita chave_bairro (sem acento, minúsculas, só letras e números) e tira o "s" final das palavras com mais de 3 letras.
create or replace function chave_categoria(p_nome text)
returns text
language sql
immutable
as $$
  select coalesce(string_agg(
           case when char_length(w) > 3 and right(w, 1) = 's' then left(w, char_length(w) - 1) else w end,
           ' ' order by ord), '')
  from unnest(string_to_array(chave_bairro(p_nome), ' ')) with ordinality as t(w, ord)
  where w <> '';
$$;

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create table categorias_produto (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 30),
  chave text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  unique (vendedor_id, chave)
);

create index categorias_produto_vendedor_idx on categorias_produto (vendedor_id, ordem);
create index categorias_produto_chave_idx on categorias_produto (chave);

alter table itens_cardapio
  add column categoria_produto_id uuid references categorias_produto (id) on delete set null; -- apagar a categoria não apaga o item

create index itens_categoria_idx on itens_cardapio (categoria_produto_id) where categoria_produto_id is not null;

-- Nome limpo, chave calculada aqui (o que o navegador mandar em "chave" é ignorado), até 15 categorias por loja
-- e a ordem de exibição sempre começa no fim da lista.
create or replace function categorias_produto_preparar()
returns trigger
language plpgsql
as $$
begin
  new.nome := regexp_replace(trim(regexp_replace(coalesce(new.nome, ''), '[[:cntrl:]]', ' ', 'g')), '\s+', ' ', 'g');
  if new.nome ~* '(https?:|www\.|@)' then raise exception 'nome_invalido' using errcode = '23514'; end if;
  new.chave := chave_categoria(new.nome);
  if new.chave = '' then raise exception 'nome_invalido' using errcode = '23514'; end if;

  if tg_op = 'INSERT' then
    if (select count(*) from categorias_produto where vendedor_id = new.vendedor_id) >= 15 then
      raise exception 'limite_categorias' using errcode = '23514';
    end if;
    new.ordem := coalesce((select max(ordem) from categorias_produto where vendedor_id = new.vendedor_id), 0) + 1;
  end if;
  return new;
end;
$$;

create trigger categorias_produto_preparar
  before insert or update of nome on categorias_produto
  for each row
  execute function categorias_produto_preparar();

-- O item só pode estar numa categoria da própria loja.
create or replace function itens_categoria_da_mesma_loja()
returns trigger
language plpgsql
as $$
begin
  if new.categoria_produto_id is not null and not exists (
    select 1 from categorias_produto where id = new.categoria_produto_id and vendedor_id = new.vendedor_id
  ) then
    raise exception 'categoria_invalida' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger itens_categoria_da_loja
  before insert or update of categoria_produto_id, vendedor_id on itens_cardapio
  for each row
  execute function itens_categoria_da_mesma_loja();

-- ---------------------------------------------------------------------------
-- Quem vê e quem muda
-- ---------------------------------------------------------------------------

alter table categorias_produto enable row level security;

-- Visitante vê as categorias de lojas no ar; o dono vê (e muda) as dele; o administrador mexe em qualquer uma.
create policy "categorias_produto_select_public" on categorias_produto
  for select using (
    exists (select 1 from vendedores v where v.id = categorias_produto.vendedor_id and (v.ativo or v.owner_id = auth.uid()))
  );

create policy "categorias_produto_manage_own" on categorias_produto
  for all
  using (exists (select 1 from vendedores v where v.id = categorias_produto.vendedor_id and v.owner_id = auth.uid()))
  with check (exists (select 1 from vendedores v where v.id = categorias_produto.vendedor_id and v.owner_id = auth.uid()));

create policy "categorias_produto_admin_all" on categorias_produto
  for all using (is_admin()) with check (is_admin());

create trigger categorias_produto_historico after insert or update or delete on categorias_produto
  for each row execute function log_historico();

-- ---------------------------------------------------------------------------
-- "Baixar meus dados" passa a incluir as categorias do menu
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
