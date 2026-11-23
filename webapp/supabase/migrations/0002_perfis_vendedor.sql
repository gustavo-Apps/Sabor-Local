-- Conta de vendedor: usuário (login), ramo de atuação e e-mail para login por usuário.

create table perfis_vendedor (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  categoria_id uuid references categorias (id),
  created_at timestamptz not null default now(),
  constraint username_formato check (username ~ '^[a-z0-9_.]{3,30}$')
);

create unique index perfis_vendedor_username_key on perfis_vendedor (username);

alter table perfis_vendedor enable row level security;

-- Cada vendedor lê apenas o próprio perfil
create policy "perfis_select_own" on perfis_vendedor
  for select using (user_id = auth.uid());

-- Cria o perfil automaticamente a partir dos metadados enviados no cadastro
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into perfis_vendedor (user_id, username, categoria_id)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    nullif(new.raw_user_meta_data ->> 'categoria_id', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- Login por usuário: devolve o e-mail do username. Só o backend (service_role)
-- pode chamar, para não expor e-mails publicamente.
create or replace function email_por_username(p_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select u.email::text
  from perfis_vendedor p
  join auth.users u on u.id = p.user_id
  where p.username = lower(p_username);
$$;

revoke all on function email_por_username(text) from public, anon, authenticated;
grant execute on function email_por_username(text) to service_role;
