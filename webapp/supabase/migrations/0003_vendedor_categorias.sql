-- Um vendedor pode ter vários ramos (ex.: pizzaria + sushi, hamburgueria + bar).

create table vendedor_categorias (
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  categoria_id uuid not null references categorias (id) on delete cascade,
  primary key (vendedor_id, categoria_id)
);

create index vendedor_categorias_categoria_idx on vendedor_categorias (categoria_id);

insert into vendedor_categorias (vendedor_id, categoria_id)
select id, categoria_id from vendedores where categoria_id is not null;

alter table vendedores drop column categoria_id;

alter table vendedor_categorias enable row level security;

create policy "vendedor_categorias_select_public" on vendedor_categorias
  for select using (
    exists (
      select 1 from vendedores v
      where v.id = vendedor_categorias.vendedor_id
        and (v.ativo or v.owner_id = auth.uid())
    )
  );

create policy "vendedor_categorias_manage_own" on vendedor_categorias
  for all using (
    exists (
      select 1 from vendedores v
      where v.id = vendedor_categorias.vendedor_id and v.owner_id = auth.uid()
    )
  );

-- Perfil da conta: lista de ramos escolhidos no cadastro
alter table perfis_vendedor add column categoria_ids uuid[] not null default '{}';
update perfis_vendedor set categoria_ids = array[categoria_id] where categoria_id is not null;
alter table perfis_vendedor drop column categoria_id;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfis_vendedor (user_id, username, categoria_ids)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(
      (select array_agg(x::uuid)
         from jsonb_array_elements_text(new.raw_user_meta_data -> 'categoria_ids') x),
      '{}'
    )
  );
  return new;
end;
$$;
