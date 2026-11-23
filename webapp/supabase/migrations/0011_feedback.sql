-- Fale conosco: problemas, sugestões e dúvidas enviados por qualquer pessoa.
--
-- Nada vira issue no GitHub sozinho: o administrador lê, decide e, se aceitar, abre a issue
-- (o painel monta o link já preenchido). Assim só o que vale a pena chega ao repositório.
--
-- Qualquer pessoa envia pela função enviar_feedback (sem login); só administradores leem e tratam.

create table feedbacks (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('problema', 'sugestao', 'duvida')),
  mensagem text not null check (char_length(mensagem) between 10 and 1000),
  pagina text check (char_length(pagina) <= 200),
  contato text check (char_length(contato) <= 100),
  status text not null default 'novo' check (status in ('novo', 'aceito', 'recusado', 'resolvido')),
  issue_url text check (char_length(issue_url) <= 300),
  ip_hash text,
  created_at timestamptz not null default now(),
  tratado_em timestamptz
);

create index feedbacks_status_idx on feedbacks (status, created_at desc);
create index feedbacks_ip_idx on feedbacks (ip_hash, created_at);

alter table feedbacks enable row level security;

-- Sem política de insert: só a função abaixo grava. Quem lê e trata é o administrador.
create policy "feedbacks_admin_all" on feedbacks
  for all using (is_admin()) with check (is_admin());

create or replace function enviar_feedback(
  p_tipo text,
  p_mensagem text,
  p_pagina text,
  p_contato text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ip text := ip_da_requisicao();
  v_hash text;
  v_msg text := trim(coalesce(p_mensagem, ''));
begin
  if p_tipo is null or p_tipo not in ('problema', 'sugestao', 'duvida') then
    raise exception 'tipo_invalido';
  end if;
  if char_length(v_msg) < 10 then raise exception 'mensagem_curta'; end if;
  if char_length(v_msg) > 1000 then raise exception 'mensagem_longa'; end if;

  -- por pessoa: no máximo 5 por hora
  if v_ip is not null then
    v_hash := md5(v_ip);
    if (
      select count(*) from feedbacks
      where ip_hash = v_hash and created_at > now() - interval '1 hour'
    ) >= 5 then
      raise exception 'muitos_feedbacks';
    end if;
  end if;

  -- no total: se a fila de "novos" encheu, pede para tentar mais tarde (evita inundar o admin)
  if (select count(*) from feedbacks where status = 'novo') >= 300 then
    raise exception 'caixa_cheia';
  end if;

  insert into feedbacks (tipo, mensagem, pagina, contato, ip_hash)
  values (
    p_tipo,
    v_msg,
    nullif(left(trim(coalesce(p_pagina, '')), 200), ''),
    nullif(left(trim(coalesce(p_contato, '')), 100), ''),
    v_hash
  );
end;
$$;

revoke all on function enviar_feedback(text, text, text, text) from public;
grant execute on function enviar_feedback(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retenção (Política de Privacidade): mesma limpeza da 0010 + o que é novo daqui
--   IP em feedbacks ........................ 7 dias
--   contato de quem escreveu ............... 180 dias depois de tratado
--   feedbacks tratados ..................... 12 meses
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

  update feedbacks set ip_hash = null where ip_hash is not null and created_at < now() - interval '7 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('feedbacks_ip_removido', n);

  update feedbacks set contato = null
  where contato is not null and status <> 'novo' and created_at < now() - interval '180 days';
  get diagnostics n = row_count; r := r || jsonb_build_object('feedbacks_contato_removido', n);

  delete from feedbacks where status <> 'novo' and created_at < now() - interval '12 months';
  get diagnostics n = row_count; r := r || jsonb_build_object('feedbacks_apagados', n);

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
