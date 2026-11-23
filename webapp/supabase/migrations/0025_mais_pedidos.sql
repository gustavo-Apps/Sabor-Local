-- Itens em destaque no perfil.
--  * "Destaque da casa": o vendedor escolhe (até 3 itens). É escolha dele, e o site diz isso.
--  * "Mais pedido": vem de dados. O cliente toca em "Pedir" no item (abre o WhatsApp com o item na mensagem) e
--    esse toque é contado; o ranking usa os toques dos últimos 30 dias. A plataforma não processa pedidos, então
--    "toques" é a medida de interesse, e por isso o selo se chama "Mais pedido", nunca "Mais vendido".

-- ---------------------------------------------------------------------------
-- Destaque da casa (escolha do vendedor), no máximo 3 por loja
-- ---------------------------------------------------------------------------

alter table itens_cardapio add column destaque boolean not null default false;

create or replace function itens_limite_destaque()
returns trigger
language plpgsql
as $$
begin
  if new.destaque and (
    select count(*) from itens_cardapio
    where vendedor_id = new.vendedor_id and destaque and id <> new.id
  ) >= 3 then
    raise exception 'limite_destaques' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger itens_destaque_limite
  before insert or update of destaque on itens_cardapio
  for each row
  execute function itens_limite_destaque();

-- ---------------------------------------------------------------------------
-- Toque em "Pedir este item"
-- ---------------------------------------------------------------------------

alter table eventos add column item_id uuid references itens_cardapio (id) on delete cascade;
create index eventos_item_idx on eventos (item_id, created_at) where item_id is not null;

alter table eventos drop constraint eventos_tipo_check;
alter table eventos add constraint eventos_tipo_check
  check (tipo in ('visita_site', 'visita_vendedor', 'whatsapp', 'link_pedido', 'pedir_item'));

drop function registrar_evento(text, uuid, text);

create function registrar_evento(p_tipo text, p_vendedor uuid default null, p_origem text default null, p_item uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := ip_da_requisicao();
  v_hash text;
  -- origem fora da lista vira "sem origem" (nunca derruba a visita)
  v_origem text := case when p_origem in ('whatsapp', 'facebook', 'instagram', 'link', 'qr') then p_origem else null end;
begin
  if p_tipo not in ('visita_site', 'visita_vendedor', 'whatsapp', 'link_pedido', 'pedir_item') then
    raise exception 'tipo_invalido';
  end if;
  if p_tipo <> 'visita_site' and not exists (select 1 from vendedores where id = p_vendedor) then
    raise exception 'vendedor_invalido';
  end if;
  -- o item precisa ser da loja informada (ninguém soma toque no item de outra loja)
  if p_tipo = 'pedir_item' and not exists (select 1 from itens_cardapio where id = p_item and vendedor_id = p_vendedor) then
    raise exception 'item_invalido';
  end if;

  -- O dono olhando a própria loja (logado) não é cliente: não conta visita nem toque,
  -- para as métricas dele refletirem só quem veio de fora.
  if p_tipo <> 'visita_site' and auth.uid() is not null
     and exists (select 1 from vendedores where id = p_vendedor and owner_id = auth.uid()) then
    return;
  end if;

  if v_ip is not null then
    v_hash := md5(v_ip);
    -- acima do limite, descarta em silêncio (não vale a pena avisar quem inunda)
    if (select count(*) from eventos where ip_hash = v_hash and created_at > now() - interval '1 minute') >= 60 then
      return;
    end if;
    -- a mesma pessoa tocando várias vezes no mesmo item conta uma vez por hora (o ranking não vira disputa de clique)
    if p_tipo = 'pedir_item' and exists (
      select 1 from eventos
      where ip_hash = v_hash and tipo = 'pedir_item' and item_id = p_item and created_at > now() - interval '1 hour'
    ) then
      return;
    end if;
  end if;

  insert into eventos (tipo, vendedor_id, ip_hash, origem, item_id)
  values (
    p_tipo,
    case when p_tipo = 'visita_site' then null else p_vendedor end,
    v_hash,
    case when p_tipo = 'visita_vendedor' then v_origem else null end,
    case when p_tipo = 'pedir_item' then p_item else null end
  );
end;
$$;

revoke all on function registrar_evento(text, uuid, text, uuid) from public;
grant execute on function registrar_evento(text, uuid, text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Ranking público: só quem passou de 5 toques nos últimos 30 dias, sem mostrar os números
-- ---------------------------------------------------------------------------

create or replace function itens_mais_pedidos(p_vendedor uuid)
returns table (item_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select e.item_id
  from eventos e
  join vendedores v on v.id = e.vendedor_id and v.ativo
  where e.vendedor_id = p_vendedor
    and e.tipo = 'pedir_item'
    and e.item_id is not null
    and e.created_at > now() - interval '30 days'
  group by e.item_id
  having count(*) >= 5
  order by count(*) desc
  limit 6;
$$;

revoke all on function itens_mais_pedidos(uuid) from public;
grant execute on function itens_mais_pedidos(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Relatório do vendedor: quais itens mais receberam toque (com os números, só para ele)
-- ---------------------------------------------------------------------------

create or replace function meus_itens_tocados(p_dias int default 30)
returns table (item_id uuid, nome text, toques bigint)
language sql
security definer
stable
set search_path = public
as $$
  select i.id, i.nome, count(*)
  from eventos e
  join itens_cardapio i on i.id = e.item_id
  join vendedores v on v.id = i.vendedor_id
  where v.owner_id = auth.uid()
    and e.tipo = 'pedir_item'
    and e.created_at > now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 365))
  group by i.id, i.nome
  order by count(*) desc, i.nome
  limit 10;
$$;

revoke all on function meus_itens_tocados(int) from public, anon;
grant execute on function meus_itens_tocados(int) to authenticated;
