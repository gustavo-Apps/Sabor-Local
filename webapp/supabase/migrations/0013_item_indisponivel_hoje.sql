-- "Indisponível hoje": o item continua no perfil, mas marcado como indisponível.
--   disponivel = false e indisponivel_ate nulo ... indisponível até o vendedor reativar
--   disponivel = false e indisponivel_ate = data ... indisponível até essa data (inclusive); no dia seguinte
--                                                    o app volta a tratar o item como disponível, sem precisar de tarefa agendada

alter table itens_cardapio add column indisponivel_ate date;

-- só faz sentido ter data quando o item está indisponível
alter table itens_cardapio
  add constraint itens_indisponivel_ate_coerente check (indisponivel_ate is null or disponivel = false);
