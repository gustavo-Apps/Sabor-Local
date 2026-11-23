-- Fases 1 e 2 do roadmap:
--  * aprovação de vendedores novos
--  * verificação de compra real (código por pedido)
--  * freio contra spam em denúncias
--  * exceções de horário por data, "não abro hoje" e férias
--  * métricas (visitas e cliques no WhatsApp)
--  * histórico (auditoria) e funções de apoio ao painel admin

-- ---------------------------------------------------------------------------
-- Vendedores: aprovação, status manual e validações
-- ---------------------------------------------------------------------------

alter table vendedores
  add column aprovado_em timestamptz,
  add column status_manual text not null default 'normal'
    check (status_manual in ('normal', 'fechado_hoje', 'ferias')),
  add column status_manual_ate date,
  add column status_manual_msg text check (char_length(status_manual_msg) <= 140);

-- Quem já estava no ar é considerado aprovado
update vendedores set aprovado_em = now() where ativo;

-- Perfil novo nasce oculto até o admin aprovar
alter table vendedores alter column ativo set default false;

alter table vendedores
  add constraint vendedores_nome_tam check (char_length(nome) between 2 and 60),
  add constraint vendedores_descricao_tam check (char_length(descricao) <= 300),
  add constraint vendedores_whatsapp_fmt check (whatsapp ~ '^[0-9]{10,13}$');

alter table itens_cardapio
  add constraint itens_nome_tam check (char_length(nome) between 1 and 80),
  add constraint itens_descricao_tam check (char_length(descricao) <= 200),
  add constraint itens_preco_faixa check (preco is null or preco between 0 and 99999);

alter table avaliacoes
  add constraint avaliacoes_comentario_tam check (char_length(comentario) <= 500);

-- O vendedor não pode se auto-aprovar nem mexer em destaque/dono
create or replace function proteger_campos_vendedor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- service_role, SQL editor, seed e administradores passam direto
  if auth.uid() is null or is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.ativo := false;
    new.aprovado_em := null;
    new.destaque_ate := null;
  else
    new.ativo := old.ativo;
    new.aprovado_em := old.aprovado_em;
    new.destaque_ate := old.destaque_ate;
    new.owner_id := old.owner_id;
  end if;
  return new;
end;
$$;

create trigger vendedores_proteger_campos
  before insert or update on vendedores
  for each row
  execute function proteger_campos_vendedor();

-- ---------------------------------------------------------------------------
-- Exceções de horário (data específica)
-- ---------------------------------------------------------------------------

create table excecoes_horario (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  data date not null,
  fechado boolean not null default false,
  abre time,
  fecha time,
  motivo text check (char_length(motivo) <= 100),
  created_at timestamptz not null default now(),
  unique (vendedor_id, data),
  constraint excecao_horas check (fechado or (abre is not null and fecha is not null))
);

alter table excecoes_horario enable row level security;

create policy "excecoes_select_public" on excecoes_horario
  for select using (
    exists (
      select 1 from vendedores v
      where v.id = excecoes_horario.vendedor_id and (v.ativo or v.owner_id = auth.uid())
    )
  );

create policy "excecoes_manage_own" on excecoes_horario
  for all using (
    exists (
      select 1 from vendedores v
      where v.id = excecoes_horario.vendedor_id and v.owner_id = auth.uid()
    )
  );

create policy "excecoes_admin_all" on excecoes_horario
  for all using (is_admin()) with check (is_admin());

create policy "horarios_admin_all" on horarios_funcionamento
  for all using (is_admin()) with check (is_admin());

create policy "itens_admin_all" on itens_cardapio
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Verificação de compra: código por pedido, gerado pelo vendedor
-- ---------------------------------------------------------------------------

create table codigos_pedido (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  codigo text not null unique,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '30 days',
  usado_em timestamptz
);

create index codigos_pedido_vendedor_idx on codigos_pedido (vendedor_id, criado_em desc);

alter table codigos_pedido enable row level security;

create policy "codigos_manage_own" on codigos_pedido
  for all using (
    exists (
      select 1 from vendedores v
      where v.id = codigos_pedido.vendedor_id and v.owner_id = auth.uid()
    )
  );

create policy "codigos_admin_all" on codigos_pedido
  for all using (is_admin()) with check (is_admin());

-- Avaliação só entra com um código válido, não usado e não expirado
drop policy "avaliacoes_insert_public" on avaliacoes;

create or replace function enviar_avaliacao(
  p_vendedor uuid,
  p_nota int,
  p_comentario text,
  p_codigo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cod codigos_pedido%rowtype;
begin
  if p_nota is null or p_nota not between 1 and 5 then
    raise exception 'nota_invalida';
  end if;
  if char_length(coalesce(p_comentario, '')) > 500 then
    raise exception 'comentario_longo';
  end if;

  select * into v_cod
  from codigos_pedido
  where codigo = upper(trim(p_codigo)) and vendedor_id = p_vendedor
  for update;

  if not found then raise exception 'codigo_invalido'; end if;
  if v_cod.usado_em is not null then raise exception 'codigo_usado'; end if;
  if v_cod.expira_em < now() then raise exception 'codigo_expirado'; end if;

  update codigos_pedido set usado_em = now() where id = v_cod.id;

  insert into avaliacoes (vendedor_id, nota, comentario, codigo_verificacao)
  values (p_vendedor, p_nota, nullif(trim(p_comentario), ''), v_cod.codigo);
end;
$$;

revoke all on function enviar_avaliacao(uuid, int, text, text) from public;
grant execute on function enviar_avaliacao(uuid, int, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Denúncias com limite por IP (5 por hora)
-- ---------------------------------------------------------------------------

alter table denuncias add column ip_hash text;

drop policy "denuncias_insert_public" on denuncias;

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
  v_headers json;
  v_ip text;
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

  v_headers := nullif(current_setting('request.headers', true), '')::json;
  v_ip := trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1));
  if v_ip <> '' then
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

revoke all on function enviar_denuncia(uuid, uuid, motivo_denuncia, text, text) from public;
grant execute on function enviar_denuncia(uuid, uuid, motivo_denuncia, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Métricas: visitas e cliques no WhatsApp
-- ---------------------------------------------------------------------------

create table eventos (
  id bigint generated always as identity primary key,
  vendedor_id uuid references vendedores (id) on delete cascade,
  tipo text not null check (tipo in ('visita_site', 'visita_vendedor', 'whatsapp')),
  created_at timestamptz not null default now()
);

create index eventos_tipo_data_idx on eventos (tipo, created_at);
create index eventos_vendedor_data_idx on eventos (vendedor_id, created_at);

alter table eventos enable row level security;

create policy "eventos_select_own" on eventos
  for select using (
    exists (
      select 1 from vendedores v
      where v.id = eventos.vendedor_id and v.owner_id = auth.uid()
    )
  );

create policy "eventos_admin_select" on eventos
  for select using (is_admin());

create or replace function registrar_evento(p_tipo text, p_vendedor uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_tipo not in ('visita_site', 'visita_vendedor', 'whatsapp') then
    raise exception 'tipo_invalido';
  end if;
  if p_tipo <> 'visita_site' and not exists (select 1 from vendedores where id = p_vendedor) then
    raise exception 'vendedor_invalido';
  end if;
  insert into eventos (tipo, vendedor_id)
  values (p_tipo, case when p_tipo = 'visita_site' then null else p_vendedor end);
end;
$$;

revoke all on function registrar_evento(text, uuid) from public;
grant execute on function registrar_evento(text, uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Histórico (auditoria)
-- ---------------------------------------------------------------------------

create table historico (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid,
  entidade text not null,
  entidade_id uuid,
  vendedor_id uuid, -- sem FK de propósito: o histórico sobrevive à exclusão
  acao text not null,
  dados jsonb
);

create index historico_vendedor_idx on historico (vendedor_id, created_at desc);
create index historico_data_idx on historico (created_at desc);

alter table historico enable row level security;

create policy "historico_admin_select" on historico
  for select using (is_admin());

create or replace function log_historico()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if tg_op = 'DELETE' then r := old; else r := new; end if;

  insert into historico (user_id, entidade, entidade_id, vendedor_id, acao, dados)
  values (
    auth.uid(),
    tg_table_name,
    r.id,
    (case when tg_table_name = 'vendedores'
          then to_jsonb(r) ->> 'id'
          else to_jsonb(r) ->> 'vendedor_id' end)::uuid,
    lower(tg_op),
    to_jsonb(r)
  );
  return r;
end;
$$;

create trigger vendedores_historico after insert or update or delete on vendedores
  for each row execute function log_historico();
create trigger itens_historico after insert or update or delete on itens_cardapio
  for each row execute function log_historico();
create trigger excecoes_historico after insert or update or delete on excecoes_horario
  for each row execute function log_historico();
create trigger avaliacoes_historico after insert or update or delete on avaliacoes
  for each row execute function log_historico();
create trigger denuncias_historico after insert or update or delete on denuncias
  for each row execute function log_historico();

-- Horários são regravados em bloco; o app registra um único evento
create or replace function registrar_historico(p_vendedor uuid, p_acao text, p_dados jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (
    is_admin() or exists (select 1 from vendedores where id = p_vendedor and owner_id = auth.uid())
  ) then
    raise exception 'sem_permissao';
  end if;
  insert into historico (user_id, entidade, vendedor_id, acao, dados)
  values (auth.uid(), 'horarios_funcionamento', p_vendedor, p_acao, p_dados);
end;
$$;

revoke all on function registrar_historico(uuid, text, jsonb) from public;
grant execute on function registrar_historico(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Funções do painel admin (checam is_admin() por dentro)
-- ---------------------------------------------------------------------------

create or replace function admin_resumo()
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;

  return json_build_object(
    'visitas_site_30d', (select count(*) from eventos where tipo = 'visita_site' and created_at > now() - interval '30 days'),
    'visitas_vendedor_30d', (select count(*) from eventos where tipo = 'visita_vendedor' and created_at > now() - interval '30 days'),
    'cliques_whatsapp_30d', (select count(*) from eventos where tipo = 'whatsapp' and created_at > now() - interval '30 days'),
    'vendedores_ativos', (select count(*) from vendedores where ativo),
    'vendedores_pendentes', (select count(*) from vendedores where not ativo and aprovado_em is null),
    'vendedores_suspensos', (select count(*) from vendedores where not ativo and aprovado_em is not null),
    'denuncias_abertas', (select count(*) from denuncias where status = 'aberta'),
    'avaliacoes_pendentes', (select count(*) from avaliacoes where not aprovada),
    'avaliacoes_total', (select count(*) from avaliacoes where aprovada)
  );
end;
$$;

create or replace function admin_vendedores()
returns table (
  id uuid,
  nome text,
  whatsapp text,
  ativo boolean,
  aprovado_em timestamptz,
  status_manual text,
  status_manual_ate date,
  created_at timestamptz,
  username text,
  email text,
  bairro text,
  itens bigint,
  visitas_30d bigint,
  cliques_30d bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;

  return query
  select
    v.id, v.nome, v.whatsapp, v.ativo, v.aprovado_em, v.status_manual, v.status_manual_ate,
    v.created_at, p.username, u.email::text, b.nome,
    (select count(*) from itens_cardapio i where i.vendedor_id = v.id),
    (select count(*) from eventos e where e.vendedor_id = v.id and e.tipo = 'visita_vendedor' and e.created_at > now() - interval '30 days'),
    (select count(*) from eventos e where e.vendedor_id = v.id and e.tipo = 'whatsapp' and e.created_at > now() - interval '30 days')
  from vendedores v
  left join bairros b on b.id = v.bairro_id
  left join perfis_vendedor p on p.user_id = v.owner_id
  left join auth.users u on u.id = v.owner_id
  order by (not v.ativo and v.aprovado_em is null) desc, v.created_at desc;
end;
$$;

create or replace function admin_historico(p_vendedor uuid default null, p_limite int default 100)
returns table (
  id bigint,
  created_at timestamptz,
  acao text,
  entidade text,
  vendedor_id uuid,
  vendedor_nome text,
  ator text,
  dados jsonb
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;

  return query
  select
    h.id, h.created_at, h.acao, h.entidade, h.vendedor_id, v.nome,
    coalesce(p.username, u.email::text, 'visitante/sistema'),
    h.dados
  from historico h
  left join vendedores v on v.id = h.vendedor_id
  left join perfis_vendedor p on p.user_id = h.user_id
  left join auth.users u on u.id = h.user_id
  where p_vendedor is null or h.vendedor_id = p_vendedor
  order by h.created_at desc
  limit least(coalesce(p_limite, 100), 500);
end;
$$;

revoke all on function admin_resumo() from public;
revoke all on function admin_vendedores() from public;
revoke all on function admin_historico(uuid, int) from public;
grant execute on function admin_resumo() to authenticated;
grant execute on function admin_vendedores() to authenticated;
grant execute on function admin_historico(uuid, int) to authenticated;
