-- Resumo do admin por cidade: base de vendedores, perfis completos e uso dos últimos 30 dias.
-- Serve para decidir se uma cidade nova está decolando (manual de expansão) sem olhar só o total do site.
--
-- "Perfil completo" segue o manual: vendedor ativo, com bairro, WhatsApp, horários e menu ou cardápio em arquivo.
-- Visitas e toques contam só o que dá para ligar a um vendedor (a visita ao catálogo não tem cidade).

create or replace function admin_resumo_cidades()
returns table (
  cidade_id uuid,
  nome text,
  uf text,
  slug text,
  ativa boolean,
  criada_em timestamptz,
  vendedores_ativos bigint,
  vendedores_pendentes bigint,
  vendedores_suspensos bigint,
  perfis_completos bigint,
  destaques_ativos bigint,
  visitas_perfis_30d bigint,
  toques_whatsapp_30d bigint,
  avaliacoes_publicadas bigint
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
    c.id,
    c.nome,
    c.uf,
    c.slug,
    c.ativa,
    c.created_at,
    (select count(*) from vendedores v where v.cidade_id = c.id and v.ativo),
    (select count(*) from vendedores v where v.cidade_id = c.id and not v.ativo and v.aprovado_em is null),
    (select count(*) from vendedores v where v.cidade_id = c.id and not v.ativo and v.aprovado_em is not null),
    (select count(*) from vendedores v
      where v.cidade_id = c.id and v.ativo
        and v.bairro_id is not null
        and v.whatsapp is not null
        and exists (select 1 from horarios_funcionamento h where h.vendedor_id = v.id)
        and (v.cardapio_url is not null or exists (select 1 from itens_cardapio i where i.vendedor_id = v.id))),
    (select count(*) from vendedores v where v.cidade_id = c.id and v.destaque_ate > now()),
    (select count(*) from eventos e join vendedores v on v.id = e.vendedor_id
      where v.cidade_id = c.id and e.tipo = 'visita_vendedor' and e.created_at > now() - interval '30 days'),
    (select count(*) from eventos e join vendedores v on v.id = e.vendedor_id
      where v.cidade_id = c.id and e.tipo = 'whatsapp' and e.created_at > now() - interval '30 days'),
    (select count(*) from avaliacoes a join vendedores v on v.id = a.vendedor_id
      where v.cidade_id = c.id and a.aprovada)
  from cidades c
  order by c.created_at, c.nome;
end;
$$;

revoke all on function admin_resumo_cidades() from public, anon;
grant execute on function admin_resumo_cidades() to authenticated;
