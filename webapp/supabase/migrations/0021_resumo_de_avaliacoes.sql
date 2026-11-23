-- Nota média e total de avaliações publicadas (só as aprovadas pela equipe) de cada loja.
-- Serve o catálogo e o perfil sem baixar todas as notas. Só números agregados: nenhum comentário sai daqui.

create view avaliacoes_resumo as
select
  vendedor_id,
  round(avg(nota)::numeric, 1) as media,
  count(*)::int as total
from avaliacoes
where aprovada
group by vendedor_id;

grant select on avaliacoes_resumo to anon, authenticated;
