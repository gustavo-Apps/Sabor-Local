-- Novo aceite dos Termos de Uso e da Política de Privacidade quando a versão muda.
-- O aceite do cadastro já grava termos_aceitos_em e termos_versao; aqui o vendedor atualiza os dois sozinho,
-- só os do próprio perfil (a tabela perfis_vendedor não tem policy de escrita para ninguém).

create or replace function aceitar_termos(p_versao text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'sem_login'; end if;
  -- formato AAAA-MM com sufixo opcional (ex.: 2026-10, 2027-03-b)
  if p_versao is null or p_versao !~ '^[0-9]{4}-[0-9]{2}(-[a-z0-9]{1,10})?$' then raise exception 'versao_invalida'; end if;

  update perfis_vendedor set termos_aceitos_em = now(), termos_versao = p_versao where user_id = auth.uid();
end;
$$;

revoke all on function aceitar_termos(text) from public, anon;
grant execute on function aceitar_termos(text) to authenticated;
