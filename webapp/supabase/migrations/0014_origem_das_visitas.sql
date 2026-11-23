-- Origem das visitas: de onde veio quem abriu o perfil (WhatsApp, Facebook, QR code...).
-- O vendedor compartilha um link com ?origem=whatsapp; o site guarda só esse rótulo (nunca dado pessoal)
-- e a aba Compartilhar mostra quantas visitas vieram de cada canal.

alter table eventos add column origem text check (origem is null or origem in ('whatsapp', 'facebook', 'instagram', 'link', 'qr'));

-- Troca a função para aceitar a origem (parâmetro opcional: quem chama como antes continua funcionando).
drop function registrar_evento(text, uuid);

create function registrar_evento(p_tipo text, p_vendedor uuid default null, p_origem text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := ip_da_requisicao();
  v_hash text;
  -- origem fora da lista vira "sem origem" (nunca derruba a visita)
  v_origem text := case when p_origem in ('whatsapp', 'facebook', 'instagram', 'link', 'qr') then p_origem else null end;
begin
  if p_tipo not in ('visita_site', 'visita_vendedor', 'whatsapp') then
    raise exception 'tipo_invalido';
  end if;
  if p_tipo <> 'visita_site' and not exists (select 1 from vendedores where id = p_vendedor) then
    raise exception 'vendedor_invalido';
  end if;

  if v_ip is not null then
    v_hash := md5(v_ip);
    -- acima do limite, descarta em silêncio (não vale a pena avisar quem inunda)
    if (select count(*) from eventos where ip_hash = v_hash and created_at > now() - interval '1 minute') >= 60 then
      return;
    end if;
  end if;

  insert into eventos (tipo, vendedor_id, ip_hash, origem)
  values (
    p_tipo,
    case when p_tipo = 'visita_site' then null else p_vendedor end,
    v_hash,
    case when p_tipo = 'visita_vendedor' then v_origem else null end
  );
end;
$$;

revoke all on function registrar_evento(text, uuid, text) from public;
grant execute on function registrar_evento(text, uuid, text) to anon, authenticated;

-- Visitas ao perfil do próprio vendedor, por origem, nos últimos dias (1 a 90).
create or replace function visitas_por_origem(p_dias int default 30)
returns table (origem text, visitas bigint)
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(e.origem, 'direto') as origem, count(*) as visitas
  from eventos e
  join vendedores v on v.id = e.vendedor_id
  where v.owner_id = auth.uid()
    and e.tipo = 'visita_vendedor'
    and e.created_at > now() - make_interval(days => least(greatest(coalesce(p_dias, 30), 1), 90))
  group by 1
  order by 2 desc, 1;
$$;

revoke all on function visitas_por_origem(int) from public, anon;
grant execute on function visitas_por_origem(int) to authenticated;
