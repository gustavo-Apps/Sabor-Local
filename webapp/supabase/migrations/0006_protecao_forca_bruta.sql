-- Proteção contra tentativa em massa (força bruta / inundação):
--  * palpites de código de avaliação: no máximo 10 erros por hora por IP
--    (e 100 por hora por vendedor, quando o IP não vem na requisição)
--  * métricas: no máximo 60 eventos por minuto por IP

-- IP de quem chamou. NÃO use o primeiro valor de X-Forwarded-For: o cliente
-- consegue forjá-lo (o proxy só ACRESCENTA o IP verdadeiro no fim da lista).
-- Ordem de confiança: x-real-ip (o proxy sobrescreve) > último valor do XFF.
-- cf-connecting-ip NÃO é usado: sem Cloudflare na frente, o cliente o forja.
-- ATENÇÃO: confirme em produção qual cabeçalho traz o IP real (rode
-- tests/forca-bruta contra um ambiente de homologação).
create or replace function ip_da_requisicao()
returns text
language sql
stable
as $$
  with h as (select nullif(current_setting('request.headers', true), '')::json as j)
  select nullif(trim(coalesce(
    j ->> 'x-real-ip',
    (string_to_array(coalesce(j ->> 'x-forwarded-for', ''), ','))[
      array_length(string_to_array(coalesce(j ->> 'x-forwarded-for', ''), ','), 1)
    ]
  )), '') from h;
$$;

-- Tentativas de código erradas (precisam sobreviver à resposta, por isso a
-- função devolve um texto em vez de levantar exceção, o que desfaria o registro)
create table tentativas_codigo (
  id bigint generated always as identity primary key,
  vendedor_id uuid not null,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index tentativas_codigo_ip_idx on tentativas_codigo (ip_hash, created_at);
create index tentativas_codigo_vendedor_idx on tentativas_codigo (vendedor_id, created_at);
alter table tentativas_codigo enable row level security;

drop function enviar_avaliacao(uuid, int, text, text);

create function enviar_avaliacao(
  p_vendedor uuid,
  p_nota int,
  p_comentario text,
  p_codigo text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cod codigos_pedido%rowtype;
  v_ip text := ip_da_requisicao();
  v_hash text;
  v_erro text;
begin
  v_hash := case when v_ip is null then null else md5(v_ip) end;

  if p_nota is null or p_nota not between 1 and 5 then return 'nota_invalida'; end if;
  if char_length(coalesce(p_comentario, '')) > 500 then return 'comentario_longo'; end if;
  if char_length(coalesce(p_codigo, '')) > 20 then return 'codigo_invalido'; end if;

  -- trava quem já errou demais
  if v_hash is not null and (
    select count(*) from tentativas_codigo
    where ip_hash = v_hash and created_at > now() - interval '1 hour'
  ) >= 10 then
    return 'muitas_tentativas';
  end if;
  if (
    select count(*) from tentativas_codigo
    where vendedor_id = p_vendedor and created_at > now() - interval '1 hour'
  ) >= 100 then
    return 'muitas_tentativas';
  end if;

  select * into v_cod
  from codigos_pedido
  where codigo = upper(trim(p_codigo)) and vendedor_id = p_vendedor
  for update;

  v_erro := case
    when not found then 'codigo_invalido'
    when v_cod.usado_em is not null then 'codigo_usado'
    when v_cod.expira_em < now() then 'codigo_expirado'
  end;

  if v_erro is not null then
    insert into tentativas_codigo (vendedor_id, ip_hash) values (p_vendedor, v_hash);
    return v_erro;
  end if;

  update codigos_pedido set usado_em = now() where id = v_cod.id;

  insert into avaliacoes (vendedor_id, nota, comentario, codigo_verificacao)
  values (p_vendedor, p_nota, nullif(trim(p_comentario), ''), v_cod.codigo);

  return 'ok';
end;
$$;

revoke all on function enviar_avaliacao(uuid, int, text, text) from public;
grant execute on function enviar_avaliacao(uuid, int, text, text) to anon, authenticated;

-- Métricas: limite por IP
alter table eventos add column ip_hash text;
create index eventos_ip_idx on eventos (ip_hash, created_at);

create or replace function registrar_evento(p_tipo text, p_vendedor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := ip_da_requisicao();
  v_hash text;
begin
  if p_tipo not in ('visita_site', 'visita_vendedor', 'whatsapp') then
    raise exception 'tipo_invalido';
  end if;
  if p_tipo <> 'visita_site' and not exists (select 1 from vendedores where id = p_vendedor) then
    raise exception 'vendedor_invalido';
  end if;

  if v_ip is not null then
    v_hash := md5(v_ip);
    -- acima do limite, descarta em silêncio (não vale a pena avisar quem inunda)
    if (select count(*) from eventos where ip_hash = v_hash and created_at > now() - interval '1 minute') >= 60 then
      return;
    end if;
  end if;

  insert into eventos (tipo, vendedor_id, ip_hash)
  values (p_tipo, case when p_tipo = 'visita_site' then null else p_vendedor end, v_hash);
end;
$$;

-- Denúncias: mesmo cálculo de IP seguro (a versão da 0005 usava o primeiro valor do XFF)
create or replace function enviar_denuncia(
  p_vendedor uuid,
  p_avaliacao uuid,
  p_motivo motivo_denuncia,
  p_descricao text,
  p_contato text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := ip_da_requisicao();
  v_hash text;
begin
  if not exists (select 1 from vendedores where id = p_vendedor) then
    raise exception 'vendedor_invalido';
  end if;
  if p_avaliacao is not null and not exists (
    select 1 from avaliacoes where id = p_avaliacao and vendedor_id = p_vendedor
  ) then
    raise exception 'avaliacao_invalida';
  end if;

  if v_ip is not null then
    v_hash := md5(v_ip);
    if (
      select count(*) from denuncias
      where ip_hash = v_hash and created_at > now() - interval '1 hour'
    ) >= 5 then
      raise exception 'muitas_denuncias';
    end if;
  end if;

  insert into denuncias (vendedor_id, avaliacao_id, motivo, descricao, contato, ip_hash)
  values (
    p_vendedor, p_avaliacao, p_motivo,
    nullif(left(trim(p_descricao), 500), ''),
    nullif(left(trim(p_contato), 100), ''),
    v_hash
  );
end;
$$;
