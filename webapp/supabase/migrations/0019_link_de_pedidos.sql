-- Link de pedidos próprio: quem já tem site, cardápio online ou outro canal de pedidos coloca o link no perfil.
-- O botão "Pedir pelo WhatsApp" continua; o link aparece ao lado, com o texto que o vendedor escolher.
--
-- O banco só aceita endereço http(s) com domínio, sem usuário e senha, de até 300 caracteres (o app valida de forma mais
-- amigável e a administração pode remover um link impróprio). O clique no link é contado como evento 'link_pedido'.

alter table vendedores
  add column link_pedido_url text,
  add column link_pedido_rotulo text,
  add constraint vendedores_link_pedido_fmt check (
    link_pedido_url is null or (
      char_length(link_pedido_url) <= 300
      and link_pedido_url ~* '^https?://[^\s/@?#]+\.[^\s/@?#]+([/?#][^\s]*)?$'
    )
  ),
  add constraint vendedores_link_pedido_rotulo_tam check (
    link_pedido_rotulo is null or char_length(link_pedido_rotulo) between 1 and 30
  ),
  -- o texto do botão só existe quando há link
  add constraint vendedores_link_pedido_coerente check (link_pedido_url is not null or link_pedido_rotulo is null);

alter table eventos drop constraint eventos_tipo_check;
alter table eventos add constraint eventos_tipo_check
  check (tipo in ('visita_site', 'visita_vendedor', 'whatsapp', 'link_pedido'));

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
  if p_tipo not in ('visita_site', 'visita_vendedor', 'whatsapp', 'link_pedido') then
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
