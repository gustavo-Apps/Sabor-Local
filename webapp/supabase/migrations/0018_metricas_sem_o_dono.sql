-- Métricas sem o próprio dono: quando o vendedor está logado e abre ou toca na própria loja,
-- o evento é descartado (o site também esconde o botão de pedir na loja dele, mas esta é a garantia no banco).

create or replace function registrar_evento(p_tipo text, p_vendedor uuid default null, p_origem text default null)
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

  -- O dono olhando a própria loja (logado) não é cliente: não conta visita nem toque,
  -- para as métricas dele refletirem só quem veio de fora.
  if p_tipo <> 'visita_site' and auth.uid() is not null
     and exists (select 1 from vendedores where id = p_vendedor and owner_id = auth.uid()) then
    return;
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
