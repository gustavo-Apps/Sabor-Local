-- Sabor Local — schema inicial do MVP (Fase 1 do roadmap)
-- Catálogo de vendedores, cardápio, avaliações com verificação de compra.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tabelas de apoio
-- ---------------------------------------------------------------------------

create table bairros (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  slug text not null unique
);

-- ---------------------------------------------------------------------------
-- Vendedores
-- ---------------------------------------------------------------------------

create type modo_atendimento as enum ('entrega', 'retirada', 'ambos');

create table vendedores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  nome text not null,
  descricao text,
  categoria_id uuid references categorias (id),
  bairro_id uuid references bairros (id),
  whatsapp text not null,
  modo_atendimento modo_atendimento not null default 'ambos',
  foto_capa_url text,
  ativo boolean not null default true,
  destaque_ate timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index vendedores_categoria_idx on vendedores (categoria_id);
create index vendedores_bairro_idx on vendedores (bairro_id);
create index vendedores_ativo_idx on vendedores (ativo);

-- Horário de funcionamento por dia da semana (0 = domingo ... 6 = sábado)
create table horarios_funcionamento (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  abre time not null,
  fecha time not null
);

create index horarios_vendedor_idx on horarios_funcionamento (vendedor_id);

-- Itens do cardápio (fotos tiradas do próprio celular)
create table itens_cardapio (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  nome text not null,
  descricao text,
  preco numeric(10, 2),
  foto_url text,
  ordem int not null default 0,
  created_at timestamptz not null default now()
);

create index itens_cardapio_vendedor_idx on itens_cardapio (vendedor_id);

-- ---------------------------------------------------------------------------
-- Avaliações com verificação de compra
-- ---------------------------------------------------------------------------

create table avaliacoes (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  nota smallint not null check (nota between 1 and 5),
  comentario text,
  codigo_verificacao text not null unique,
  aprovada boolean not null default false,
  created_at timestamptz not null default now()
);

create index avaliacoes_vendedor_idx on avaliacoes (vendedor_id);

-- ---------------------------------------------------------------------------
-- updated_at automático em vendedores
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger vendedores_set_updated_at
  before update on vendedores
  for each row
  execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table bairros enable row level security;
alter table categorias enable row level security;
alter table vendedores enable row level security;
alter table horarios_funcionamento enable row level security;
alter table itens_cardapio enable row level security;
alter table avaliacoes enable row level security;

-- Leitura pública de bairros e categorias
create policy "bairros_select_public" on bairros for select using (true);
create policy "categorias_select_public" on categorias for select using (true);

-- Vendedores: leitura pública apenas de ativos; dono gerencia o próprio perfil
create policy "vendedores_select_public" on vendedores
  for select using (ativo or owner_id = auth.uid());

create policy "vendedores_insert_own" on vendedores
  for insert with check (owner_id = auth.uid());

create policy "vendedores_update_own" on vendedores
  for update using (owner_id = auth.uid());

-- Horários e itens de cardápio seguem a visibilidade do vendedor dono
create policy "horarios_select_public" on horarios_funcionamento
  for select using (
    exists (
      select 1 from vendedores v
      where v.id = horarios_funcionamento.vendedor_id
        and (v.ativo or v.owner_id = auth.uid())
    )
  );

create policy "horarios_manage_own" on horarios_funcionamento
  for all using (
    exists (
      select 1 from vendedores v
      where v.id = horarios_funcionamento.vendedor_id
        and v.owner_id = auth.uid()
    )
  );

create policy "itens_cardapio_select_public" on itens_cardapio
  for select using (
    exists (
      select 1 from vendedores v
      where v.id = itens_cardapio.vendedor_id
        and (v.ativo or v.owner_id = auth.uid())
    )
  );

create policy "itens_cardapio_manage_own" on itens_cardapio
  for all using (
    exists (
      select 1 from vendedores v
      where v.id = itens_cardapio.vendedor_id
        and v.owner_id = auth.uid()
    )
  );

-- Avaliações: qualquer um lê as aprovadas; qualquer um pode enviar uma nova
-- (a aprovação/moderação acontece via painel administrativo, fora do MVP público)
create policy "avaliacoes_select_aprovadas" on avaliacoes
  for select using (aprovada or
    exists (
      select 1 from vendedores v
      where v.id = avaliacoes.vendedor_id
        and v.owner_id = auth.uid()
    )
  );

create policy "avaliacoes_insert_public" on avaliacoes
  for insert with check (true);
