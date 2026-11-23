-- Produção / LGPD:
--  * registro do aceite dos Termos de Uso e da Política de Privacidade no cadastro
--  * limpeza periódica de dados pessoais e técnicos (retenção mínima)

alter table perfis_vendedor
  add column termos_aceitos_em timestamptz,
  add column termos_versao text;

-- O cadastro envia `termos_versao` nos metadados; o banco grava a data do aceite
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_termos text := nullif(new.raw_user_meta_data ->> 'termos_versao', '');
begin
  insert into perfis_vendedor (user_id, username, categoria_ids, termos_aceitos_em, termos_versao)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(
      (select array_agg(x::uuid)
         from jsonb_array_elements_text(new.raw_user_meta_data -> 'categoria_ids') x),
      '{}'
    ),
    case when v_termos is null then null else now() end,
    v_termos
  );
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Retenção. Prazos (devem bater com a Política de Privacidade):
--   tentativas de login e de código ........ 7 dias
--   hash de IP em métricas ................. 7 dias (a contagem fica, o IP some)
--   contato de quem denunciou .............. 180 dias depois de a denúncia ser tratada
--   métricas (visitas e cliques) ........... 25 meses
--   histórico de alterações ................ 2 anos
--   códigos de avaliação usados/vencidos ... 90 dias
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

-- Agenda a limpeza diária às 03:00 UTC quando a extensão pg_cron estiver disponível.
-- Nunca derruba a migration: se não der, rode manualmente ou agende pelo painel do Supabase.
do $$
begin
  create extension if not exists pg_cron;
  execute $cron$select cron.schedule('limpar-dados-antigos', '0 3 * * *', 'select public.limpar_dados_antigos()')$cron$;
exception when others then
  raise notice 'pg_cron indisponível (%): agende limpar_dados_antigos() manualmente.', sqlerrm;
end;
$$;
