-- Fase 3: plano destaque com cobrança manual (Pix/dinheiro) registrada pelo admin.
-- O destaque continua sendo `vendedores.destaque_ate`; cada pagamento estende esse
-- prazo e fica registrado (valor, forma, período) para o controle financeiro.

create table pagamentos (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  valor numeric(10, 2) not null check (valor >= 0 and valor <= 99999),
  forma text not null check (forma in ('pix', 'dinheiro', 'cortesia')),
  dias int not null check (dias between 1 and 365),
  observacao text check (char_length(observacao) <= 200),
  destaque_de timestamptz not null,
  destaque_ate timestamptz not null,
  registrado_por uuid,
  created_at timestamptz not null default now(),
  constraint cortesia_sem_valor check (forma <> 'cortesia' or valor = 0)
);

create index pagamentos_vendedor_idx on pagamentos (vendedor_id, created_at desc);
create index pagamentos_data_idx on pagamentos (created_at desc);

alter table pagamentos enable row level security;

-- O vendedor vê só o próprio histórico; ninguém grava direto (só pela função de admin)
create policy "pagamentos_select_own" on pagamentos
  for select using (
    exists (select 1 from vendedores v where v.id = pagamentos.vendedor_id and v.owner_id = auth.uid())
  );

create policy "pagamentos_admin_all" on pagamentos
  for all using (is_admin()) with check (is_admin());

create trigger pagamentos_historico after insert or update or delete on pagamentos
  for each row execute function log_historico();

-- Registra o pagamento e estende o destaque a partir do fim do período atual
-- (renovar antes de vencer não perde dias).
create or replace function admin_registrar_pagamento(
  p_vendedor uuid,
  p_dias int,
  p_valor numeric,
  p_forma text,
  p_observacao text
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_de timestamptz;
  v_ate timestamptz;
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;
  if not exists (select 1 from vendedores where id = p_vendedor) then
    raise exception 'vendedor_invalido';
  end if;

  select greatest(now(), coalesce(destaque_ate, now())) into v_de
  from vendedores where id = p_vendedor for update;
  v_ate := v_de + make_interval(days => p_dias);

  insert into pagamentos (vendedor_id, valor, forma, dias, observacao, destaque_de, destaque_ate, registrado_por)
  values (
    p_vendedor, p_valor, p_forma, p_dias,
    nullif(left(trim(p_observacao), 200), ''),
    v_de, v_ate, auth.uid()
  );

  update vendedores set destaque_ate = v_ate where id = p_vendedor;
  return v_ate;
end;
$$;

create or replace function admin_remover_destaque(p_vendedor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;
  update vendedores set destaque_ate = null where id = p_vendedor;
end;
$$;

create or replace function admin_pagamentos(p_limite int default 100)
returns table (
  id uuid,
  created_at timestamptz,
  vendedor_id uuid,
  vendedor_nome text,
  valor numeric,
  forma text,
  dias int,
  destaque_ate timestamptz,
  observacao text,
  registrado_por text
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;

  return query
  select p.id, p.created_at, p.vendedor_id, v.nome, p.valor, p.forma, p.dias, p.destaque_ate,
         p.observacao, coalesce(pf.username, u.email::text, 'sistema')
  from pagamentos p
  left join vendedores v on v.id = p.vendedor_id
  left join perfis_vendedor pf on pf.user_id = p.registrado_por
  left join auth.users u on u.id = p.registrado_por
  order by p.created_at desc
  limit least(coalesce(p_limite, 100), 500);
end;
$$;

-- Lista de vendedores do admin ganha a data do destaque (muda o tipo de retorno)
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
  destaque_ate timestamptz
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
    v.destaque_ate
  from vendedores v
  left join bairros b on b.id = v.bairro_id
  left join perfis_vendedor p on p.user_id = v.owner_id
  left join auth.users u on u.id = v.owner_id
  order by (not v.ativo and v.aprovado_em is null) desc, v.created_at desc;
end;
$$;

-- Resumo ganha os indicadores da Fase 3 (meta: 5+ vendedores pagantes)
create or replace function admin_resumo()
returns json
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not is_admin() then raise exception 'sem_permissao'; end if;

  return json_build_object(
    'visitas_site_30d', (select count(*) from eventos where tipo = 'visita_site' and created_at > now() - interval '30 days'),
    'visitas_vendedor_30d', (select count(*) from eventos where tipo = 'visita_vendedor' and created_at > now() - interval '30 days'),
    'cliques_whatsapp_30d', (select count(*) from eventos where tipo = 'whatsapp' and created_at > now() - interval '30 days'),
    'vendedores_ativos', (select count(*) from vendedores where ativo),
    'vendedores_pendentes', (select count(*) from vendedores where not ativo and aprovado_em is null),
    'vendedores_suspensos', (select count(*) from vendedores where not ativo and aprovado_em is not null),
    'denuncias_abertas', (select count(*) from denuncias where status = 'aberta'),
    'avaliacoes_pendentes', (select count(*) from avaliacoes where not aprovada),
    'avaliacoes_total', (select count(*) from avaliacoes where aprovada),
    'destaques_ativos', (select count(*) from vendedores where destaque_ate > now()),
    'pagantes_ativos', (
      select count(distinct p.vendedor_id) from pagamentos p
      where p.valor > 0 and p.destaque_de <= now() and p.destaque_ate > now()
    ),
    'receita_30d', (select coalesce(sum(valor), 0) from pagamentos where created_at > now() - interval '30 days')
  );
end;
$$;

revoke all on function admin_registrar_pagamento(uuid, int, numeric, text, text) from public;
revoke all on function admin_remover_destaque(uuid) from public;
revoke all on function admin_pagamentos(int) from public;
revoke all on function admin_vendedores() from public;
grant execute on function admin_registrar_pagamento(uuid, int, numeric, text, text) to authenticated;
grant execute on function admin_remover_destaque(uuid) to authenticated;
grant execute on function admin_pagamentos(int) to authenticated;
grant execute on function admin_vendedores() to authenticated;
