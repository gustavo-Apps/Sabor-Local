-- Bairros sempre atualizados: o vendedor sugere o bairro que não achou e o administrador aprova, junta com um
-- existente ou recusa. Até lá, o perfil mostra o texto sugerido como "bairro a confirmar".
-- Também: bairros podem ser desativados (deixam de ser oferecidos, sem apagar quem já os usa) e juntados.

-- ---------------------------------------------------------------------------
-- Comparação de nomes sem acento, maiúsculas nem pontuação ("Jardim São José" = "jardim sao jose")
-- ---------------------------------------------------------------------------

create or replace function chave_bairro(p_nome text)
returns text
language sql
immutable
as $$
  select trim(regexp_replace(
    translate(lower(coalesce(p_nome, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z0-9]+', ' ', 'g'));
$$;

alter table bairros add column ativo boolean not null default true;

-- Nenhum caminho (admin, sugestão aprovada, SQL) cria dois bairros "iguais" na mesma cidade.
-- É um gatilho (e não um índice único) para não quebrar bases que já tenham nomes parecidos.
create or replace function bairros_sem_duplicata()
returns trigger
language plpgsql
as $$
begin
  if exists (
    select 1 from bairros b
    where b.cidade_id = new.cidade_id and b.id <> new.id and chave_bairro(b.nome) = chave_bairro(new.nome)
  ) then
    raise exception 'bairro_duplicado' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger bairros_duplicata
  before insert or update of nome, cidade_id on bairros
  for each row
  execute function bairros_sem_duplicata();

-- ---------------------------------------------------------------------------
-- Sugestões
-- ---------------------------------------------------------------------------

alter table vendedores
  add column bairro_sugerido text check (bairro_sugerido is null or char_length(bairro_sugerido) between 2 and 60);

create table bairros_sugeridos (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  cidade_id uuid not null references cidades (id) on delete cascade,
  nome text not null check (char_length(nome) between 2 and 60),
  chave text not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'unida', 'recusada', 'cancelada')),
  bairro_id uuid references bairros (id) on delete set null,
  criado_em timestamptz not null default now(),
  tratado_em timestamptz,
  tratado_por uuid references auth.users (id) on delete set null
);

create index bairros_sugeridos_fila_idx on bairros_sugeridos (status, cidade_id, chave);
create index bairros_sugeridos_vendedor_idx on bairros_sugeridos (vendedor_id, criado_em desc);

alter table bairros_sugeridos enable row level security; -- sem policies: só as funções abaixo acessam

-- Escolher um bairro da lista encerra a sugestão que estava esperando.
create or replace function vendedor_limpa_sugestao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.bairro_id is not null then
    new.bairro_sugerido := null;
    update bairros_sugeridos set status = 'cancelada', tratado_em = now()
    where vendedor_id = new.id and status = 'pendente';
  end if;
  return new;
end;
$$;

create trigger vendedores_limpa_sugestao
  before update of bairro_id on vendedores
  for each row
  execute function vendedor_limpa_sugestao();

-- ---------------------------------------------------------------------------
-- O vendedor sugere o bairro dele
-- ---------------------------------------------------------------------------

create or replace function sugerir_bairro(p_nome text, p_cidade uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_vend vendedores%rowtype;
  v_nome text := regexp_replace(trim(regexp_replace(coalesce(p_nome, ''), '[[:cntrl:]]', '', 'g')), '\s+', ' ', 'g');
  v_chave text;
  v_existente bairros%rowtype;
begin
  if v_uid is null then raise exception 'sem_login'; end if;
  select * into v_vend from vendedores where owner_id = v_uid limit 1;
  if not found then raise exception 'sem_perfil'; end if;
  if not exists (select 1 from cidades where id = p_cidade and ativa) then raise exception 'cidade_invalida'; end if;

  if char_length(v_nome) not between 2 and 60 or v_nome ~* '(https?:|www\.|@)' then raise exception 'nome_invalido'; end if;
  v_chave := chave_bairro(v_nome);
  if v_chave = '' then raise exception 'nome_invalido'; end if;

  -- o bairro já existe (talvez escrito diferente): usa o que existe, sem passar pelo administrador
  select * into v_existente from bairros where cidade_id = p_cidade and chave_bairro(nome) = v_chave limit 1;
  if found then
    update vendedores set bairro_id = v_existente.id where id = v_vend.id;
    return json_build_object('resultado', 'ja_existia', 'bairro', v_existente.nome);
  end if;

  -- a mesma sugestão repetida não conta de novo
  if exists (select 1 from bairros_sugeridos where vendedor_id = v_vend.id and status = 'pendente' and cidade_id = p_cidade and chave = v_chave) then
    update vendedores set bairro_id = null, bairro_sugerido = v_nome, cidade_id = p_cidade where id = v_vend.id;
    return json_build_object('resultado', 'pendente', 'bairro', v_nome);
  end if;

  if (select count(*) from bairros_sugeridos where vendedor_id = v_vend.id and criado_em > now() - interval '24 hours') >= 5 then
    raise exception 'limite_diario';
  end if;

  -- cada vendedor tem no máximo uma sugestão esperando: a anterior é substituída pela nova
  update bairros_sugeridos set status = 'cancelada', tratado_em = now() where vendedor_id = v_vend.id and status = 'pendente';
  insert into bairros_sugeridos (vendedor_id, cidade_id, nome, chave) values (v_vend.id, p_cidade, v_nome, v_chave);
  update vendedores set bairro_id = null, bairro_sugerido = v_nome, cidade_id = p_cidade where id = v_vend.id;
  return json_build_object('resultado', 'pendente', 'bairro', v_nome);
end;
$$;

revoke all on function sugerir_bairro(text, uuid) from public, anon;
grant execute on function sugerir_bairro(text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Administração
-- ---------------------------------------------------------------------------

create or replace function admin_bairros_sugeridos()
returns table (
  id uuid,
  nome text,
  cidade_id uuid,
  cidade_nome text,
  vendedor_id uuid,
  vendedor_nome text,
  criado_em timestamptz,
  iguais bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;

  return query
  select s.id, s.nome, s.cidade_id, c.nome, s.vendedor_id, v.nome, s.criado_em,
         (select count(*) from bairros_sugeridos o
          where o.status = 'pendente' and o.cidade_id = s.cidade_id and o.chave = s.chave)
  from bairros_sugeridos s
  join cidades c on c.id = s.cidade_id
  join vendedores v on v.id = s.vendedor_id
  where s.status = 'pendente'
  order by s.criado_em;
end;
$$;

revoke all on function admin_bairros_sugeridos() from public, anon;
grant execute on function admin_bairros_sugeridos() to authenticated;

-- aprovar: cria o bairro (ou usa o que já tem esse nome); unir: usa um bairro existente; recusar: descarta.
-- Vale para todas as sugestões pendentes iguais (mesma cidade, mesmo nome sem acento) de uma só vez.
create or replace function admin_tratar_sugestao(p_id uuid, p_acao text, p_bairro uuid default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  s bairros_sugeridos%rowtype;
  r bairros_sugeridos%rowtype;
  v_bairro uuid;
  v_status text;
  v_n int := 0;
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;

  select * into s from bairros_sugeridos where id = p_id and status = 'pendente' for update;
  if not found then raise exception 'sugestao_nao_encontrada'; end if;

  if p_acao = 'aprovar' then
    select id into v_bairro from bairros where cidade_id = s.cidade_id and chave_bairro(nome) = s.chave;
    if not found then
      insert into bairros (nome, cidade_id) values (s.nome, s.cidade_id) returning id into v_bairro;
    end if;
    v_status := 'aprovada';
  elsif p_acao = 'unir' then
    if p_bairro is null or not exists (select 1 from bairros where id = p_bairro and cidade_id = s.cidade_id) then
      raise exception 'bairro_invalido';
    end if;
    v_bairro := p_bairro;
    v_status := 'unida';
  elsif p_acao = 'recusar' then
    v_status := 'recusada';
  else
    raise exception 'acao_invalida';
  end if;

  for r in
    select * from bairros_sugeridos where status = 'pendente' and cidade_id = s.cidade_id and chave = s.chave for update
  loop
    update bairros_sugeridos
    set status = v_status, bairro_id = v_bairro, tratado_em = now(), tratado_por = auth.uid()
    where id = r.id;

    if v_bairro is not null then
      update vendedores set bairro_id = v_bairro, bairro_sugerido = null where id = r.vendedor_id and bairro_id is null;
    else
      update vendedores set bairro_sugerido = null where id = r.vendedor_id and bairro_id is null;
    end if;
    v_n := v_n + 1;
  end loop;

  return json_build_object('status', v_status, 'vendedores', v_n);
end;
$$;

revoke all on function admin_tratar_sugestao(uuid, text, uuid) from public, anon;
grant execute on function admin_tratar_sugestao(uuid, text, uuid) to authenticated;

-- Junta dois bairros da mesma cidade: quem estava no de origem passa para o de destino, e o de origem sai.
create or replace function admin_unir_bairros(p_origem uuid, p_destino uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_origem bairros%rowtype;
  v_n int;
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;
  if p_origem = p_destino then raise exception 'bairro_invalido'; end if;

  select * into v_origem from bairros where id = p_origem;
  if not found then raise exception 'bairro_invalido'; end if;
  if not exists (select 1 from bairros where id = p_destino and cidade_id = v_origem.cidade_id) then
    raise exception 'bairro_invalido';
  end if;

  update vendedores set bairro_id = p_destino where bairro_id = p_origem;
  get diagnostics v_n = row_count;
  update bairros_sugeridos set bairro_id = p_destino where bairro_id = p_origem;
  delete from bairros where id = p_origem;
  return v_n;
end;
$$;

revoke all on function admin_unir_bairros(uuid, uuid) from public, anon;
grant execute on function admin_unir_bairros(uuid, uuid) to authenticated;
