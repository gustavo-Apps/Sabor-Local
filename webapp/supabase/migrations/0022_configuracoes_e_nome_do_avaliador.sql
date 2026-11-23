-- 1) Nome (opcional) de quem avalia.
-- 2) Configurações do site que só o administrador muda: exigir ou não a aprovação do admin para
--    avaliações novas e para vendedores novos. O padrão continua sendo exigir (nada muda até o admin decidir).

-- ---------------------------------------------------------------------------
-- Nome do avaliador (opcional, aparece na avaliação publicada)
-- ---------------------------------------------------------------------------

alter table avaliacoes
  add column autor_nome text
    constraint avaliacoes_autor_nome_tam check (autor_nome is null or char_length(autor_nome) between 1 and 40);

-- ---------------------------------------------------------------------------
-- Configurações (uma única linha)
-- ---------------------------------------------------------------------------

create table configuracoes (
  id boolean primary key default true check (id),
  avaliacoes_exigem_aprovacao boolean not null default true,
  vendedores_exigem_aprovacao boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

insert into configuracoes (id) values (true);

alter table configuracoes enable row level security;

-- Só o administrador lê e altera; não há insert nem delete (a linha única já existe).
create policy "configuracoes_admin_select" on configuracoes for select using (is_admin());
create policy "configuracoes_admin_update" on configuracoes for update using (is_admin()) with check (is_admin());

create or replace function carimbar_configuracoes()
returns trigger
language plpgsql
as $$
begin
  new.id := true;
  new.atualizado_em := now();
  new.atualizado_por := auth.uid();
  return new;
end;
$$;

create trigger configuracoes_carimbo
  before update on configuracoes
  for each row
  execute function carimbar_configuracoes();

-- ---------------------------------------------------------------------------
-- Vendedor novo: nasce ativo e aprovado só quando a aprovação está desligada
-- ---------------------------------------------------------------------------

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
    if (select vendedores_exigem_aprovacao from configuracoes) then
      new.ativo := false;
      new.aprovado_em := null;
    else
      new.ativo := true;
      new.aprovado_em := now();
    end if;
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

-- ---------------------------------------------------------------------------
-- Avaliação por convite: nome opcional e publicação direta quando a aprovação está desligada
-- ---------------------------------------------------------------------------

drop function avaliar_por_convite(text, int, text);

create or replace function avaliar_por_convite(p_token text, p_nota int, p_comentario text, p_nome text default null)
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
  -- sem caracteres de controle e com espaços simples: "  Maria   Silva " vira "Maria Silva"
  v_nome text := nullif(regexp_replace(trim(regexp_replace(coalesce(p_nome, ''), '[[:cntrl:]]', '', 'g')), '\s+', ' ', 'g'), '');
begin
  if p_nota is null or p_nota not between 1 and 5 then return 'nota_invalida'; end if;
  if char_length(coalesce(p_comentario, '')) > 500 then return 'comentario_longo'; end if;
  if char_length(coalesce(v_nome, '')) > 40 then return 'nome_longo'; end if;
  -- o nome é público: nada de endereço de site, e-mail ou telefone no lugar do nome
  if v_nome ~* '(https?:|www\.|@|[0-9]{5,})' then return 'nome_invalido'; end if;

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

  insert into avaliacoes (vendedor_id, nota, comentario, autor_nome, aprovada, codigo_verificacao)
  values (
    v_conv.vendedor_id, p_nota, nullif(trim(coalesce(p_comentario, '')), ''), v_nome,
    not (select avaliacoes_exigem_aprovacao from configuracoes),
    'convite-' || v_conv.id
  )
  returning id into v_av;

  update convites_avaliacao set usado_em = now(), avaliacao_id = v_av where id = v_conv.id;
  return 'ok';
end;
$$;

revoke all on function avaliar_por_convite(text, int, text, text) from public;
grant execute on function avaliar_por_convite(text, int, text, text) to anon, authenticated;

-- A página do convite avisa se a avaliação passa por conferência antes de aparecer.
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
  return json_build_object(
    'estado', 'ok',
    'vendedor_nome', v_nome,
    'moderada', (select avaliacoes_exigem_aprovacao from configuracoes)
  );
end;
$$;

revoke all on function convite_info(text) from public;
grant execute on function convite_info(text) to anon, authenticated;
