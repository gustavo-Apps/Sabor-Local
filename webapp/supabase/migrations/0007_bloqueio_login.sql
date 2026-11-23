-- Bloqueio de login por tentativas erradas (força bruta de senha).
-- 10 erros por conta e 30 por IP em 15 minutos. Só o backend (service_role) usa.

create table tentativas_login (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo in ('conta', 'ip')),
  chave text not null, -- md5 do identificador digitado ou do IP
  created_at timestamptz not null default now()
);

create index tentativas_login_idx on tentativas_login (tipo, chave, created_at);
alter table tentativas_login enable row level security; -- sem policies: ninguém acessa pela API

create or replace function login_bloqueado(p_conta text, p_ip text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*) from tentativas_login
      where tipo = 'conta' and chave = md5(lower(trim(p_conta)))
        and created_at > now() - interval '15 minutes') >= 10
    or (coalesce(p_ip, '') <> '' and (
      select count(*) from tentativas_login
      where tipo = 'ip' and chave = md5(p_ip)
        and created_at > now() - interval '15 minutes') >= 30);
$$;

create or replace function registrar_falha_login(p_conta text, p_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from tentativas_login where created_at < now() - interval '1 day';
  insert into tentativas_login (tipo, chave) values ('conta', md5(lower(trim(p_conta))));
  if coalesce(p_ip, '') <> '' then
    insert into tentativas_login (tipo, chave) values ('ip', md5(p_ip));
  end if;
end;
$$;

create or replace function limpar_falhas_login(p_conta text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from tentativas_login where tipo = 'conta' and chave = md5(lower(trim(p_conta)));
$$;

revoke all on function login_bloqueado(text, text) from public, anon, authenticated;
revoke all on function registrar_falha_login(text, text) from public, anon, authenticated;
revoke all on function limpar_falhas_login(text) from public, anon, authenticated;
grant execute on function login_bloqueado(text, text) to service_role;
grant execute on function registrar_falha_login(text, text) to service_role;
grant execute on function limpar_falhas_login(text) to service_role;
