-- LGPD, direito de acesso e portabilidade: o vendedor baixa os próprios dados em um arquivo.
--
-- Só devolve o que pertence a quem está logado (auth.uid()). Fica de fora, de propósito:
--   * denúncias recebidas (identificam e dão contato de terceiros), inclusive a linha delas no histórico;
--   * código de verificação das avaliações (é um segredo de quem comprou);
--   * IP, mesmo embaralhado, e os dados de outros vendedores.

create or replace function exportar_meus_dados()
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_perfil perfis_vendedor%rowtype;
  v_vend vendedores%rowtype;
  v_usuario record;
begin
  if v_uid is null then raise exception 'sem_login'; end if;

  select * into v_perfil from perfis_vendedor where user_id = v_uid;
  select * into v_vend from vendedores where owner_id = v_uid limit 1;
  select email, created_at, last_sign_in_at into v_usuario from auth.users where id = v_uid;

  return jsonb_build_object(
    'gerado_em', now(),
    'sobre_este_arquivo',
      'Dados da sua conta no Sabor Local (Lei 13.709/2018, LGPD). Não inclui denúncias recebidas, o código secreto das avaliações nem dados de outras pessoas.',
    'conta', jsonb_build_object(
      'email', v_usuario.email,
      'usuario', v_perfil.username,
      'criada_em', v_usuario.created_at,
      'ultimo_acesso', v_usuario.last_sign_in_at,
      'termos_aceitos_em', v_perfil.termos_aceitos_em,
      'termos_versao', v_perfil.termos_versao
    ),
    'perfil', case when v_vend.id is null then null else
      (to_jsonb(v_vend) - 'owner_id' - 'bairro_id' - 'cidade_id')
      || jsonb_build_object(
        'bairro', (select nome from bairros where id = v_vend.bairro_id),
        'cidade', (select nome from cidades where id = v_vend.cidade_id)
      ) end,
    'ramos', coalesce((
      select jsonb_agg(c.nome order by c.nome)
      from vendedor_categorias vc join categorias c on c.id = vc.categoria_id
      where vc.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'horarios', coalesce((
      select jsonb_agg(jsonb_build_object('dia_semana', h.dia_semana, 'abre', h.abre, 'fecha', h.fecha) order by h.dia_semana, h.abre)
      from horarios_funcionamento h where h.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'datas_especiais', coalesce((
      select jsonb_agg(jsonb_build_object('data', e.data, 'fechado', e.fechado, 'abre', e.abre, 'fecha', e.fecha, 'motivo', e.motivo) order by e.data)
      from excecoes_horario e where e.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'menu', coalesce((
      select jsonb_agg(jsonb_build_object(
        'nome', i.nome, 'descricao', i.descricao, 'preco', i.preco, 'foto_url', i.foto_url,
        'disponivel', i.disponivel, 'indisponivel_ate', i.indisponivel_ate
      ) order by i.ordem, i.created_at)
      from itens_cardapio i where i.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'avaliacoes_recebidas', coalesce((
      select jsonb_agg(jsonb_build_object('nota', a.nota, 'comentario', a.comentario, 'publicada', a.aprovada, 'data', a.created_at) order by a.created_at)
      from avaliacoes a where a.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'codigos_de_avaliacao', coalesce((
      select jsonb_agg(jsonb_build_object('codigo', p.codigo, 'criado_em', p.criado_em, 'expira_em', p.expira_em, 'usado_em', p.usado_em) order by p.criado_em)
      from codigos_pedido p where p.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'pagamentos_do_destaque', coalesce((
      select jsonb_agg(jsonb_build_object(
        'valor', g.valor, 'forma', g.forma, 'dias', g.dias, 'destaque_de', g.destaque_de,
        'destaque_ate', g.destaque_ate, 'observacao', g.observacao, 'registrado_em', g.created_at
      ) order by g.created_at)
      from pagamentos g where g.vendedor_id = v_vend.id
    ), '[]'::jsonb),
    'uso_do_perfil', jsonb_build_object(
      'visitas_ao_perfil', (select count(*) from eventos where vendedor_id = v_vend.id and tipo = 'visita_vendedor'),
      'toques_no_whatsapp', (select count(*) from eventos where vendedor_id = v_vend.id and tipo = 'whatsapp')
    ),
    'historico_de_alteracoes', coalesce((
      select jsonb_agg(jsonb_build_object('data', h.created_at, 'o_que', h.entidade, 'acao', h.acao) order by h.created_at)
      from historico h where h.vendedor_id = v_vend.id and h.entidade <> 'denuncias'
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function exportar_meus_dados() from public, anon;
grant execute on function exportar_meus_dados() to authenticated;
