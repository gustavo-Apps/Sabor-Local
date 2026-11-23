-- Versão 2.x: pedidos pelo site.
--
-- O cliente escolhe os produtos, informa entrega ou retirada, o meio de pagamento e observações; o site grava o pedido,
-- o vendedor acompanha e muda o status, e o cliente acompanha por um link, sem conta.
-- A plataforma NÃO processa nem recebe dinheiro: o "meio de pagamento" é só uma escolha informada no pedido, e o
-- pagamento continua direto entre cliente e vendedor.
--
-- Regras que ficam no banco (o site só mostra):
--  * o valor do pedido é calculado aqui (o cliente nunca manda preço) e o preço do item é "congelado" no pedido;
--  * loja fechada, de férias ou "não abre hoje" não recebe pedido; item indisponível não pode ser pedido;
--  * limites contra pedido falso (por IP e por telefone) e o vendedor pode recusar e bloquear um telefone;
--  * os dados pessoais do cliente (nome, telefone, endereço) saem do pedido 90 dias depois de encerrado.

-- ---------------------------------------------------------------------------
-- Configuração de cada loja (o vendedor liga quando quiser; o padrão é desligado)
-- ---------------------------------------------------------------------------

alter table vendedores
  add column aceita_pedidos boolean not null default false,
  add column pagamentos_aceitos text[] not null default array['pix', 'dinheiro', 'cartao'],
  add column taxa_entrega numeric(8, 2) not null default 0 check (taxa_entrega between 0 and 999),
  add constraint vendedores_pagamentos_ok
    check (pagamentos_aceitos <@ array['pix', 'dinheiro', 'cartao']::text[] and cardinality(pagamentos_aceitos) >= 1);

-- ---------------------------------------------------------------------------
-- Pedidos
-- ---------------------------------------------------------------------------

create table pedidos (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  numero int not null,                        -- 1, 2, 3... dentro de cada loja ("pedido 12")
  token_hash text not null unique,            -- sha256 do link de acompanhamento que só o cliente recebe
  modo text not null check (modo in ('entrega', 'retirada')),
  -- dados pessoais: ficam nulos depois da retenção
  cliente_nome text check (cliente_nome is null or char_length(cliente_nome) between 2 and 60),
  cliente_telefone text check (cliente_telefone is null or cliente_telefone ~ '^55[0-9]{10,11}$'),
  endereco text check (endereco is null or char_length(endereco) <= 200),
  observacoes text check (observacoes is null or char_length(observacoes) <= 300),
  pagamento text not null check (pagamento in ('pix', 'dinheiro', 'cartao')),
  troco_para numeric(10, 2) check (troco_para is null or troco_para > 0),
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  taxa_entrega numeric(8, 2) not null default 0 check (taxa_entrega >= 0),
  total numeric(10, 2) not null check (total >= 0),
  tem_item_sob_consulta boolean not null default false,  -- item sem preço: o valor final é combinado com a loja
  status text not null default 'novo'
    check (status in ('novo', 'em_preparo', 'saiu_para_entrega', 'pronto_para_retirada', 'concluido', 'cancelado')),
  motivo_cancelamento text check (motivo_cancelamento is null or char_length(motivo_cancelamento) <= 120),
  cancelado_por text check (cancelado_por is null or cancelado_por in ('loja', 'cliente', 'sistema')),
  avaliacao_id uuid references avaliacoes (id) on delete set null,
  avaliado boolean not null default false,
  ip_hash text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  encerrado_em timestamptz,
  unique (vendedor_id, numero)
);

create index pedidos_vendedor_idx on pedidos (vendedor_id, criado_em desc);
create index pedidos_status_idx on pedidos (vendedor_id, status);
create index pedidos_telefone_idx on pedidos (vendedor_id, cliente_telefone, criado_em);
create index pedidos_ip_idx on pedidos (ip_hash, criado_em);

create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pedidos (id) on delete cascade,
  item_id uuid references itens_cardapio (id) on delete set null,  -- o item pode sair do menu depois
  nome text not null,            -- nome e preço ficam "congelados" no pedido
  preco_unit numeric(10, 2),     -- nulo = sob consulta
  quantidade int not null check (quantidade between 1 and 20)
);

create index pedido_itens_pedido_idx on pedido_itens (pedido_id);
create index pedido_itens_item_idx on pedido_itens (item_id) where item_id is not null;

-- Telefones que o vendedor recusou e bloqueou. Guarda só o hash e os 4 últimos dígitos (para ele reconhecer).
create table clientes_bloqueados (
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  telefone_hash text not null,
  telefone_final text not null,
  criado_em timestamptz not null default now(),
  primary key (vendedor_id, telefone_hash)
);

alter table pedidos enable row level security;
alter table pedido_itens enable row level security;
alter table clientes_bloqueados enable row level security;

-- O dono da loja lê os pedidos dela. Ninguém grava direto: criar e mudar status só pelas funções abaixo.
-- O administrador não lê dados de clientes (só os números, pelas funções de resumo).
create policy "pedidos_select_own" on pedidos
  for select using (exists (select 1 from vendedores v where v.id = pedidos.vendedor_id and v.owner_id = auth.uid()));

create policy "pedido_itens_select_own" on pedido_itens
  for select using (
    exists (
      select 1 from pedidos p join vendedores v on v.id = p.vendedor_id
      where p.id = pedido_itens.pedido_id and v.owner_id = auth.uid()
    )
  );

create policy "bloqueados_select_own" on clientes_bloqueados
  for select using (exists (select 1 from vendedores v where v.id = clientes_bloqueados.vendedor_id and v.owner_id = auth.uid()));

create policy "bloqueados_delete_own" on clientes_bloqueados
  for delete using (exists (select 1 from vendedores v where v.id = clientes_bloqueados.vendedor_id and v.owner_id = auth.uid()));

-- Histórico (auditoria) do pedido: só o que não identifica o cliente (nada de nome, telefone ou endereço)
create or replace function log_historico_pedido()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into historico (user_id, entidade, entidade_id, vendedor_id, acao, dados)
  values (
    auth.uid(), 'pedidos', new.id, new.vendedor_id, lower(tg_op),
    jsonb_build_object('numero', new.numero, 'status', new.status, 'modo', new.modo, 'total', new.total)
  );
  return new;
end;
$$;

create trigger pedidos_historico
  after insert or update of status on pedidos
  for each row
  execute function log_historico_pedido();

-- ---------------------------------------------------------------------------
-- A loja está aberta agora? (mesma regra do site: férias / "não abre hoje" > data especial > horário semanal)
-- ---------------------------------------------------------------------------

create or replace function janela_aberta(p_abre time, p_fecha time, p_minutos int, p_virada boolean)
returns boolean
language sql
immutable
as $$
  select case
    when (extract(hour from p_fecha) * 60 + extract(minute from p_fecha)) <= (extract(hour from p_abre) * 60 + extract(minute from p_abre))
      then case
        -- janela que cruza a meia-noite (ex.: 18:00 às 02:00): a parte da noite vale hoje, a da madrugada vale na virada
        when p_virada then p_minutos < (extract(hour from p_fecha) * 60 + extract(minute from p_fecha))
        else p_minutos >= (extract(hour from p_abre) * 60 + extract(minute from p_abre))
      end
    else (not p_virada)
      and p_minutos >= (extract(hour from p_abre) * 60 + extract(minute from p_abre))
      and p_minutos < (extract(hour from p_fecha) * 60 + extract(minute from p_fecha))
  end;
$$;

create or replace function loja_aberta_agora(p_vendedor uuid, p_agora timestamptz default now())
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v vendedores%rowtype;
  v_local timestamp := p_agora at time zone 'America/Sao_Paulo';
  v_hoje date := (p_agora at time zone 'America/Sao_Paulo')::date;
  v_min int := (extract(hour from v_local) * 60 + extract(minute from v_local))::int;
  v_dia int := extract(dow from v_local)::int;
  v_ontem int := (extract(dow from v_local)::int + 6) % 7;
  e excecoes_horario%rowtype;
begin
  select * into v from vendedores where id = p_vendedor;
  if not found or not v.ativo then return false; end if;

  if v.status_manual <> 'normal' and (v.status_manual_ate is null or v.status_manual_ate >= v_hoje) then
    return false;
  end if;

  select * into e from excecoes_horario where vendedor_id = p_vendedor and data = v_hoje;
  if found then
    if e.fechado then return false; end if;
    return janela_aberta(e.abre, e.fecha, v_min, false);
  end if;

  return exists (
    select 1 from horarios_funcionamento h
    where h.vendedor_id = p_vendedor
      and (
        (h.dia_semana = v_dia and janela_aberta(h.abre, h.fecha, v_min, false))
        or (h.dia_semana = v_ontem and janela_aberta(h.abre, h.fecha, v_min, true))
      )
  );
end;
$$;

revoke all on function janela_aberta(time, time, int, boolean) from public, anon, authenticated;
grant execute on function janela_aberta(time, time, int, boolean) to service_role;
revoke all on function loja_aberta_agora(uuid, timestamptz) from public, anon, authenticated;
grant execute on function loja_aberta_agora(uuid, timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- O cliente faz o pedido (sem conta)
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
  v_linhas int;
  v_validas int;
  v_distintos int;
  v_encontradas int;
  v_itens jsonb;
  v_subtotal numeric(12, 2);
  v_sob_consulta boolean;
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

  -- itens: [{"item_id": "...", "quantidade": 2}, ...]
  begin
    if jsonb_typeof(p_itens) <> 'array' then raise exception 'itens_invalidos'; end if;
    select count(*), count(distinct (e ->> 'item_id')::uuid),
           count(*) filter (where (e ->> 'quantidade')::int between 1 and 20)
      into v_linhas, v_distintos, v_validas
    from jsonb_array_elements(p_itens) e;
  exception when others then
    raise exception 'itens_invalidos';
  end;
  if v_linhas not between 1 and 30 or v_distintos <> v_linhas or v_validas <> v_linhas then raise exception 'itens_invalidos'; end if;

  -- só entram itens desta loja e disponíveis (um item "indisponível até uma data" volta a valer depois dela)
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id', i.id, 'nome', i.nome, 'preco', i.preco, 'quantidade', (e ->> 'quantidade')::int
         )), '[]'::jsonb),
         count(*),
         coalesce(sum(coalesce(i.preco, 0) * (e ->> 'quantidade')::int), 0),
         coalesce(bool_or(i.preco is null), false)
    into v_itens, v_encontradas, v_subtotal, v_sob_consulta
  from jsonb_array_elements(p_itens) e
  join itens_cardapio i on i.id = (e ->> 'item_id')::uuid and i.vendedor_id = p_vendedor
  where i.disponivel or (i.indisponivel_ate is not null and i.indisponivel_ate < v_hoje);
  if v_encontradas <> v_linhas then raise exception 'item_indisponivel'; end if;

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
    v_subtotal, v_taxa, v_total, coalesce(v_sob_consulta, false), v_ip_hash
  ) returning id into v_pedido;

  insert into pedido_itens (pedido_id, item_id, nome, preco_unit, quantidade)
  select v_pedido, (l ->> 'item_id')::uuid, l ->> 'nome', (l ->> 'preco')::numeric, (l ->> 'quantidade')::int
  from jsonb_array_elements(v_itens) l;

  return json_build_object(
    'numero', v_numero, 'token', v_token, 'subtotal', v_subtotal, 'taxa_entrega', v_taxa, 'total', v_total,
    'tem_item_sob_consulta', coalesce(v_sob_consulta, false)
  );
end;
$$;

revoke all on function criar_pedido(uuid, jsonb, text, text, text, text, text, numeric, text) from public;
grant execute on function criar_pedido(uuid, jsonb, text, text, text, text, text, numeric, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- O cliente acompanha (pelo link, sem conta) e pode cancelar enquanto a loja não começou
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
      select json_agg(json_build_object('nome', i.nome, 'preco_unit', i.preco_unit, 'quantidade', i.quantidade) order by i.nome)
      from pedido_itens i where i.pedido_id = p.id
    ), '[]'::json)
  );
end;
$$;

revoke all on function pedido_por_token(text) from public;
grant execute on function pedido_por_token(text) to anon, authenticated;

create or replace function cancelar_pedido_cliente(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos%rowtype;
begin
  select * into p from pedidos
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;
  if not found then return 'pedido_invalido'; end if;
  if p.status <> 'novo' then return 'nao_pode_cancelar'; end if; -- depois que a loja começou, só ela cancela

  update pedidos
  set status = 'cancelado', cancelado_por = 'cliente', motivo_cancelamento = 'Cancelado pelo cliente',
      atualizado_em = now(), encerrado_em = now()
  where id = p.id;
  return 'ok';
end;
$$;

revoke all on function cancelar_pedido_cliente(text) from public;
grant execute on function cancelar_pedido_cliente(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- O vendedor muda o status (novo > em preparo > saiu para entrega / pronto para retirada > concluído, ou cancelado)
-- ---------------------------------------------------------------------------

create or replace function mudar_status_pedido(p_pedido uuid, p_status text, p_motivo text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos%rowtype;
  v_pronto text;
  v_motivo text := nullif(left(regexp_replace(trim(regexp_replace(coalesce(p_motivo, ''), '[[:cntrl:]]', ' ', 'g')), '\s+', ' ', 'g'), 120), '');
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;

  select p2.* into p from pedidos p2
  join vendedores v on v.id = p2.vendedor_id
  where p2.id = p_pedido and v.owner_id = auth.uid()
  for update of p2;
  if not found then return 'pedido_invalido'; end if;

  v_pronto := case when p.modo = 'entrega' then 'saiu_para_entrega' else 'pronto_para_retirada' end;

  if not (
    (p.status = 'novo' and p_status in ('em_preparo', v_pronto, 'cancelado'))
    or (p.status = 'em_preparo' and p_status in (v_pronto, 'cancelado'))
    or (p.status in ('saiu_para_entrega', 'pronto_para_retirada') and p_status in ('concluido', 'cancelado'))
  ) then
    return 'transicao_invalida';
  end if;

  update pedidos
  set status = p_status,
      atualizado_em = now(),
      encerrado_em = case when p_status in ('concluido', 'cancelado') then now() else null end,
      cancelado_por = case when p_status = 'cancelado' then 'loja' else null end,
      motivo_cancelamento = case when p_status = 'cancelado' then v_motivo else null end
  where id = p.id;
  return 'ok';
end;
$$;

revoke all on function mudar_status_pedido(uuid, text, text) from public, anon;
grant execute on function mudar_status_pedido(uuid, text, text) to authenticated;

-- Recusar e bloquear: cancela o pedido (se ainda aberto) e impede novos pedidos daquele telefone nesta loja.
create or replace function recusar_e_bloquear_pedido(p_pedido uuid, p_motivo text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos%rowtype;
  v_motivo text := nullif(left(regexp_replace(trim(regexp_replace(coalesce(p_motivo, ''), '[[:cntrl:]]', ' ', 'g')), '\s+', ' ', 'g'), 120), '');
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;

  select p2.* into p from pedidos p2
  join vendedores v on v.id = p2.vendedor_id
  where p2.id = p_pedido and v.owner_id = auth.uid()
  for update of p2;
  if not found then return 'pedido_invalido'; end if;
  if p.cliente_telefone is null then return 'sem_telefone'; end if;

  insert into clientes_bloqueados (vendedor_id, telefone_hash, telefone_final)
  values (p.vendedor_id, encode(sha256(convert_to(p.cliente_telefone, 'UTF8')), 'hex'), right(p.cliente_telefone, 4))
  on conflict do nothing;

  if p.status in ('novo', 'em_preparo', 'saiu_para_entrega', 'pronto_para_retirada') then
    update pedidos
    set status = 'cancelado', cancelado_por = 'loja', motivo_cancelamento = coalesce(v_motivo, 'Pedido recusado'),
        atualizado_em = now(), encerrado_em = now()
    where id = p.id;
  end if;
  return 'ok';
end;
$$;

revoke all on function recusar_e_bloquear_pedido(uuid, text) from public, anon;
grant execute on function recusar_e_bloquear_pedido(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Avaliação do pedido concluído: o link do pedido é a verificação de compra (sem o vendedor gerar código nenhum)
-- ---------------------------------------------------------------------------

create or replace function avaliar_por_pedido(p_token text, p_nota int, p_comentario text, p_nome text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  p pedidos%rowtype;
  v_av uuid;
  v_nome text := nullif(regexp_replace(trim(regexp_replace(coalesce(p_nome, ''), '[[:cntrl:]]', '', 'g')), '\s+', ' ', 'g'), '');
begin
  if p_nota is null or p_nota not between 1 and 5 then return 'nota_invalida'; end if;
  if char_length(coalesce(p_comentario, '')) > 500 then return 'comentario_longo'; end if;
  if char_length(coalesce(v_nome, '')) > 40 then return 'nome_longo'; end if;
  if v_nome ~* '(https?:|www\.|@|[0-9]{5,})' then return 'nome_invalido'; end if;

  select * into p from pedidos
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;
  if not found then return 'pedido_invalido'; end if;
  if p.status <> 'concluido' then return 'pedido_nao_concluido'; end if;
  if p.avaliado then return 'pedido_ja_avaliado'; end if;

  insert into avaliacoes (vendedor_id, nota, comentario, autor_nome, aprovada, codigo_verificacao)
  values (
    p.vendedor_id, p_nota, nullif(trim(coalesce(p_comentario, '')), ''), v_nome,
    not (select avaliacoes_exigem_aprovacao from configuracoes),
    'pedido-' || p.id
  )
  returning id into v_av;

  update pedidos set avaliado = true, avaliacao_id = v_av where id = p.id;
  return 'ok';
end;
$$;

revoke all on function avaliar_por_pedido(text, int, text, text) from public;
grant execute on function avaliar_por_pedido(text, int, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Números: do vendedor e do administrador (sem dados de clientes)
-- ---------------------------------------------------------------------------

create or replace function meus_pedidos_resumo(p_dias int default 30)
returns json
language sql
security definer
stable
set search_path = public
as $$
  select json_build_object(
    'pedidos', count(*),
    'novos', count(*) filter (where p.status = 'novo'),
    'abertos', count(*) filter (where p.status in ('novo', 'em_preparo', 'saiu_para_entrega', 'pronto_para_retirada')),
    'concluidos', count(*) filter (where p.status = 'concluido'),
    'cancelados', count(*) filter (where p.status = 'cancelado'),
    'valor_concluido', coalesce(sum(p.total) filter (where p.status = 'concluido'), 0)
  )
  from pedidos p
  join vendedores v on v.id = p.vendedor_id
  where v.owner_id = auth.uid()
    and p.criado_em > now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 365));
$$;

revoke all on function meus_pedidos_resumo(int) from public, anon;
grant execute on function meus_pedidos_resumo(int) to authenticated;

create or replace function admin_pedidos_resumo(p_dias int default 30)
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_desde timestamptz := now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 365));
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;

  return json_build_object(
    'lojas_aceitando', (select count(*) from vendedores where ativo and aceita_pedidos),
    'pedidos', (select count(*) from pedidos where criado_em > v_desde),
    'concluidos', (select count(*) from pedidos where criado_em > v_desde and status = 'concluido'),
    'cancelados', (select count(*) from pedidos where criado_em > v_desde and status = 'cancelado'),
    'valor_concluido', (select coalesce(sum(total), 0) from pedidos where criado_em > v_desde and status = 'concluido'),
    'lojas', coalesce((
      select json_agg(l order by l.pedidos desc)
      from (
        select v.id, v.nome, count(*) as pedidos,
               count(*) filter (where p.status = 'concluido') as concluidos,
               coalesce(sum(p.total) filter (where p.status = 'concluido'), 0) as valor_concluido
        from pedidos p join vendedores v on v.id = p.vendedor_id
        where p.criado_em > v_desde
        group by v.id, v.nome
        order by count(*) desc
        limit 5
      ) l
    ), '[]'::json)
  );
end;
$$;

revoke all on function admin_pedidos_resumo(int) from public, anon;
grant execute on function admin_pedidos_resumo(int) to authenticated;

-- ---------------------------------------------------------------------------
-- "Mais pedido" passa a vir dos pedidos concluídos (volume real). Sem pedidos, continua valendo o toque em "Pedir".
-- ---------------------------------------------------------------------------

create or replace function itens_mais_pedidos(p_vendedor uuid)
returns table (item_id uuid)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not exists (select 1 from vendedores where id = p_vendedor and ativo) then return; end if;

  -- volume real: itens de pelo menos 3 pedidos concluídos diferentes nos últimos 30 dias, do mais pedido para o menos
  return query
    select pi.item_id
    from pedido_itens pi
    join pedidos p on p.id = pi.pedido_id
    where p.vendedor_id = p_vendedor
      and p.status = 'concluido'
      and p.encerrado_em > now() - interval '30 days'
      and pi.item_id is not null
    group by pi.item_id
    having count(distinct p.id) >= 3
    order by sum(pi.quantidade) desc
    limit 6;
  if found then return; end if;

  -- sem volume suficiente: toques em "Pedir" de pessoas diferentes (regra da migration 0025)
  return query
    select e.item_id
    from eventos e
    where e.vendedor_id = p_vendedor
      and e.tipo = 'pedir_item'
      and e.item_id is not null
      and e.created_at > now() - interval '30 days'
    group by e.item_id
    having count(*) >= 5
    order by count(*) desc
    limit 6;
end;
$$;

revoke all on function itens_mais_pedidos(uuid) from public;
grant execute on function itens_mais_pedidos(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retenção (LGPD): pedido sem resposta vence, dado pessoal do cliente sai depois de 90 dias do encerramento
-- ---------------------------------------------------------------------------

create or replace function limpar_dados_antigos()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb := '{}'::jsonb;
  n bigint;
begin
  delete from tentativas_codigo where created_at < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('tentativas_codigo', n);

  delete from tentativas_login where created_at < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('tentativas_login', n);

  update eventos set ip_hash = null where ip_hash is not null and created_at < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('eventos_ip_removido', n);

  update denuncias set ip_hash = null where ip_hash is not null and created_at < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('denuncias_ip_removido', n);

  update denuncias set contato = null
  where contato is not null and status <> 'aberta' and created_at < now() - interval '180 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('denuncias_contato_removido', n);

  update feedbacks set ip_hash = null where ip_hash is not null and created_at < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('feedbacks_ip_removido', n);

  update feedbacks set contato = null
  where contato is not null and status <> 'novo' and created_at < now() - interval '180 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('feedbacks_contato_removido', n);

  delete from feedbacks where status <> 'novo' and created_at < now() - interval '12 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('feedbacks_apagados', n);

  delete from tentativas_convite where created_at < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('tentativas_convite', n);

  delete from convites_avaliacao
  where criado_em < now() - interval '90 days' and (usado_em is not null or cancelado_em is not null or expira_em < now());
  get diagnostics n = row_count; r := r || jsonb_build_object('convites_apagados', n);

  -- pedidos pelo site
  update pedidos
  set status = 'cancelado', cancelado_por = 'sistema', motivo_cancelamento = 'Sem resposta da loja',
      atualizado_em = now(), encerrado_em = now()
  where status = 'novo' and criado_em < now() - interval '3 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('pedidos_vencidos', n);

  update pedidos set ip_hash = null where ip_hash is not null and criado_em < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('pedidos_ip_removido', n);

  update pedidos
  set cliente_nome = null, cliente_telefone = null, endereco = null, observacoes = null, troco_para = null
  where encerrado_em is not null and encerrado_em < now() - interval '90 days'
    and (cliente_nome is not null or cliente_telefone is not null or endereco is not null or observacoes is not null or troco_para is not null);
  get diagnostics n = row_count; r := r || jsonb_build_object('pedidos_dados_pessoais_removidos', n);

  delete from pedidos where criado_em < now() - interval '25 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('pedidos_apagados', n);

  delete from eventos where created_at < now() - interval '25 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('eventos_apagados', n);

  delete from historico where created_at < now() - interval '2 years';
  get diagnostics n = row_count; r := r || jsonb_build_object('historico_apagado', n);

  delete from codigos_pedido
  where criado_em < now() - interval '90 days' and (usado_em is not null or expira_em < now());
  get diagnostics n = row_count; r := r || jsonb_build_object('codigos_apagados', n);

  return r;
end;
$$;

revoke all on function limpar_dados_antigos() from public, anon, authenticated;
grant execute on function limpar_dados_antigos() to service_role;
