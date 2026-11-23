-- Avaliação por convite: o código vai direto para o e-mail do cliente e o vendedor nunca o vê.
--
-- Antes, o vendedor gerava e lia o código (codigos_pedido): ele mesmo podia se avaliar. Agora:
--   * o vendedor só informa o e-mail do cliente; o servidor cria um link único e o envia para esse e-mail;
--   * o token nunca volta ao navegador do vendedor, e o banco guarda só o "hash" dele (não dá para recuperar);
--   * só o e-mail mascarado (m***@gmail.com) fica guardado para o vendedor reconhecer o convite;
--   * o e-mail do próprio vendedor é recusado, e um mesmo e-mail só recebe 1 convite por loja a cada 30 dias.
-- Continua valendo a moderação: toda avaliação nasce "pendente" até o administrador aprovar.

create table convites_avaliacao (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  email_hash text not null,       -- sha256 do e-mail em minúsculas: só para não repetir convite
  email_mascarado text not null,  -- "m***@gmail.com": o que o vendedor vê
  token_hash text not null unique, -- sha256 do token que vai no e-mail
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '30 days',
  usado_em timestamptz,
  cancelado_em timestamptz,
  avaliacao_id uuid references avaliacoes (id) on delete set null
);

create index convites_avaliacao_vendedor_idx on convites_avaliacao (vendedor_id, criado_em desc);
create index convites_avaliacao_email_idx on convites_avaliacao (vendedor_id, email_hash);

alter table convites_avaliacao enable row level security; -- sem policies: só as funções abaixo acessam

-- Tentativas de usar um link inválido (por IP embaralhado), para frear quem chuta links.
create table tentativas_convite (
  id bigint generated always as identity primary key,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index tentativas_convite_ip_idx on tentativas_convite (ip_hash, created_at);
alter table tentativas_convite enable row level security;

-- O vendedor não gera mais códigos: tira o acesso dele a codigos_pedido (só o admin, em casos de suporte).
drop policy "codigos_manage_own" on codigos_pedido;

-- ---------------------------------------------------------------------------
-- Criar o convite (só o servidor, com a chave de serviço, depois de conferir quem é o vendedor)
-- ---------------------------------------------------------------------------

create or replace function criar_convite_avaliacao(p_vendedor uuid, p_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_hash text;
  v_token text;
  v_dono text;
  v_masc text;
  v_id uuid;
  v_expira timestamptz;
begin
  if not exists (select 1 from vendedores where id = p_vendedor) then raise exception 'vendedor_invalido'; end if;
  if char_length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then raise exception 'email_invalido'; end if;

  -- o vendedor não pode convidar o próprio e-mail
  select lower(u.email) into v_dono from vendedores v join auth.users u on u.id = v.owner_id where v.id = p_vendedor;
  if v_dono is not null and v_dono = v_email then raise exception 'email_proprio'; end if;

  v_hash := encode(sha256(convert_to(v_email, 'UTF8')), 'hex');

  if exists (
    select 1 from convites_avaliacao
    where vendedor_id = p_vendedor and email_hash = v_hash and cancelado_em is null
      and criado_em > now() - interval '30 days'
  ) then raise exception 'convite_recente'; end if;

  if (select count(*) from convites_avaliacao where vendedor_id = p_vendedor and criado_em > now() - interval '24 hours') >= 20 then
    raise exception 'limite_diario';
  end if;
  if (select count(*) from convites_avaliacao
      where vendedor_id = p_vendedor and usado_em is null and cancelado_em is null and expira_em > now()) >= 50 then
    raise exception 'limite_pendentes';
  end if;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''); -- 64 caracteres aleatórios
  v_masc := left(split_part(v_email, '@', 1), 1) || '***@' || split_part(v_email, '@', 2);

  insert into convites_avaliacao (vendedor_id, email_hash, email_mascarado, token_hash)
  values (p_vendedor, v_hash, v_masc, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  returning id, expira_em into v_id, v_expira;

  return json_build_object('id', v_id, 'token', v_token, 'mascarado', v_masc, 'expira_em', v_expira);
end;
$$;

revoke all on function criar_convite_avaliacao(uuid, text) from public, anon, authenticated;
grant execute on function criar_convite_avaliacao(uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- O cliente abre o link: mostra para qual loja é e se ainda vale (não gasta o convite)
-- ---------------------------------------------------------------------------

create or replace function convite_info(p_token text)
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_conv convites_avaliacao%rowtype;
  v_nome text;
begin
  select * into v_conv from convites_avaliacao
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if not found or v_conv.cancelado_em is not null then
    return json_build_object('estado', 'invalido');
  end if;
  if v_conv.usado_em is not null then return json_build_object('estado', 'usado'); end if;
  if v_conv.expira_em < now() then return json_build_object('estado', 'expirado'); end if;

  select nome into v_nome from vendedores where id = v_conv.vendedor_id;
  return json_build_object('estado', 'ok', 'vendedor_nome', v_nome);
end;
$$;

revoke all on function convite_info(text) from public;
grant execute on function convite_info(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- O cliente envia a avaliação com o link recebido (cada link vale uma vez)
-- ---------------------------------------------------------------------------

create or replace function avaliar_por_convite(p_token text, p_nota int, p_comentario text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := ip_da_requisicao();
  v_hash text := case when ip_da_requisicao() is null then null else md5(ip_da_requisicao()) end;
  v_conv convites_avaliacao%rowtype;
  v_av uuid;
begin
  if p_nota is null or p_nota not between 1 and 5 then return 'nota_invalida'; end if;
  if char_length(coalesce(p_comentario, '')) > 500 then return 'comentario_longo'; end if;

  if v_ip is not null and (
    select count(*) from tentativas_convite where ip_hash = v_hash and created_at > now() - interval '1 hour'
  ) >= 10 then
    return 'muitas_tentativas';
  end if;

  select * into v_conv from convites_avaliacao
  where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;

  if not found or v_conv.cancelado_em is not null then
    insert into tentativas_convite (ip_hash) values (v_hash);
    return 'convite_invalido';
  end if;
  if v_conv.usado_em is not null then return 'convite_usado'; end if;
  if v_conv.expira_em < now() then return 'convite_expirado'; end if;

  insert into avaliacoes (vendedor_id, nota, comentario, codigo_verificacao)
  values (v_conv.vendedor_id, p_nota, nullif(trim(coalesce(p_comentario, '')), ''), 'convite-' || v_conv.id)
  returning id into v_av;

  update convites_avaliacao set usado_em = now(), avaliacao_id = v_av where id = v_conv.id;
  return 'ok';
end;
$$;

revoke all on function avaliar_por_convite(text, int, text) from public;
grant execute on function avaliar_por_convite(text, int, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- O vendedor acompanha os convites dele (sem token e sem e-mail completo) e pode cancelar os pendentes
-- ---------------------------------------------------------------------------

create or replace function meus_convites()
returns table (id uuid, email_mascarado text, criado_em timestamptz, expira_em timestamptz, estado text)
language sql
security definer
stable
set search_path = public
as $$
  select c.id, c.email_mascarado, c.criado_em, c.expira_em,
    case
      when c.usado_em is not null then 'avaliou'
      when c.cancelado_em is not null then 'cancelado'
      when c.expira_em < now() then 'expirado'
      else 'pendente'
    end
  from convites_avaliacao c
  join vendedores v on v.id = c.vendedor_id
  where v.owner_id = auth.uid()
  order by c.criado_em desc
  limit 30;
$$;

revoke all on function meus_convites() from public, anon;
grant execute on function meus_convites() to authenticated;

create or replace function cancelar_convite(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n int;
begin
  update convites_avaliacao c set cancelado_em = now()
  from vendedores v
  where c.id = p_id and v.id = c.vendedor_id and v.owner_id = auth.uid()
    and c.usado_em is null and c.cancelado_em is null;
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$$;

revoke all on function cancelar_convite(uuid) from public, anon;
grant execute on function cancelar_convite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Exportar meus dados: convites no lugar dos códigos (o vendedor não vê mais códigos)
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
    'menu', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', i.nome, 'descricao', i.descricao, 'preco', i.preco, 'foto_url', i.foto_url,
        'disponivel', i.disponivel, 'indisponivel_ate', i.indisponivel_ate
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

-- ---------------------------------------------------------------------------
-- Retenção: convites usados, cancelados ou vencidos saem em 90 dias; tentativas inválidas em 7 dias
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
