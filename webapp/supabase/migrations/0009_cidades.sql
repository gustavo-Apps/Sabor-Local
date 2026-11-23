-- Fase 4: estrutura para várias cidades.
-- Cada bairro pertence a uma cidade; o vendedor herda a cidade do bairro escolhido.
-- Quem já existe é associado a uma "Cidade piloto" (o admin renomeia em /admin → Cidades).

create table cidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 2 and 60),
  uf text check (uf ~ '^[A-Z]{2}$'),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);

alter table cidades enable row level security;

-- Visitante só enxerga cidades ativas; o admin vê e gerencia todas
create policy "cidades_select_public" on cidades
  for select using (ativa or is_admin());

create policy "cidades_admin_all" on cidades
  for all using (is_admin()) with check (is_admin());

insert into cidades (nome, slug) values ('Cidade piloto', 'cidade-piloto');

-- Cidade usada quando nada é informado (a mais antiga)
create or replace function cidade_padrao()
returns uuid
language sql
stable
as $$
  select id from cidades order by created_at, id limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Bairros pertencem a uma cidade
-- ---------------------------------------------------------------------------

alter table bairros add column cidade_id uuid references cidades (id) on delete restrict;
update bairros set cidade_id = cidade_padrao();
alter table bairros
  alter column cidade_id set not null,
  alter column cidade_id set default cidade_padrao();

-- O mesmo nome pode existir em cidades diferentes, mas não repetir dentro da cidade
alter table bairros drop constraint bairros_nome_key;
create unique index bairros_cidade_nome_key on bairros (cidade_id, lower(nome));
create index bairros_cidade_idx on bairros (cidade_id);
alter table bairros add constraint bairros_nome_tam check (char_length(nome) between 2 and 60);

create policy "bairros_admin_all" on bairros
  for all using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Vendedores herdam a cidade do bairro
-- ---------------------------------------------------------------------------

alter table vendedores add column cidade_id uuid references cidades (id) on delete restrict;
update vendedores v
set cidade_id = coalesce((select b.cidade_id from bairros b where b.id = v.bairro_id), cidade_padrao());
alter table vendedores
  alter column cidade_id set not null,
  alter column cidade_id set default cidade_padrao();
create index vendedores_cidade_idx on vendedores (cidade_id);

-- A cidade nunca é escolhida direto: vem sempre do bairro (bairro inexistente
-- continua dando erro de chave estrangeira, não de "cidade nula").
create or replace function vendedor_define_cidade()
returns trigger
language plpgsql
as $$
declare
  v_cidade uuid;
begin
  if new.bairro_id is not null then
    select cidade_id into v_cidade from bairros where id = new.bairro_id;
    if found then
      new.cidade_id := v_cidade;
    end if;
  end if;
  return new;
end;
$$;

create trigger vendedores_cidade
  before insert or update of bairro_id on vendedores
  for each row
  execute function vendedor_define_cidade();

-- ---------------------------------------------------------------------------
-- Funções do admin
-- ---------------------------------------------------------------------------

create or replace function admin_cidades()
returns table (
  id uuid,
  nome text,
  uf text,
  slug text,
  ativa boolean,
  created_at timestamptz,
  bairros bigint,
  vendedores bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;

  return query
  select c.id, c.nome, c.uf, c.slug, c.ativa, c.created_at,
         (select count(*) from bairros b where b.cidade_id = c.id),
         (select count(*) from vendedores v where v.cidade_id = c.id)
  from cidades c
  order by c.created_at, c.nome;
end;
$$;

-- A lista de vendedores do admin passa a mostrar a cidade (muda o tipo de retorno)
drop function admin_vendedores();

create function admin_vendedores()
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
  cliques_30d bigint,
  destaque_ate timestamptz,
  cidade text
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
    (select count(*) from eventos e where e.vendedor_id = v.id and e.tipo = 'whatsapp' and e.created_at > now() - interval '30 days'),
    v.destaque_ate,
    c.nome
  from vendedores v
  left join bairros b on b.id = v.bairro_id
  left join cidades c on c.id = v.cidade_id
  left join perfis_vendedor p on p.user_id = v.owner_id
  left join auth.users u on u.id = v.owner_id
  order by (not v.ativo and v.aprovado_em is null) desc, v.created_at desc;
end;
$$;

revoke all on function admin_cidades() from public;
revoke all on function admin_vendedores() from public;
grant execute on function admin_cidades() to authenticated;
grant execute on function admin_vendedores() to authenticated;
