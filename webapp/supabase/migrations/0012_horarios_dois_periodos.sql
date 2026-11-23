-- Horário de funcionamento: até 2 períodos por dia (ex.: 08:00–12:00 e 18:00–22:00).
-- O app já valida (sobreposição, formato); aqui fica a última barreira, caso alguém grave direto.

create or replace function horarios_limite_periodos()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (
    select count(*) from horarios_funcionamento
    where vendedor_id = new.vendedor_id
      and dia_semana = new.dia_semana
      and id is distinct from new.id
  ) >= 2 then
    raise exception 'maximo_dois_periodos';
  end if;
  return new;
end;
$$;

create trigger horarios_limite_periodos
  before insert or update of vendedor_id, dia_semana on horarios_funcionamento
  for each row
  execute function horarios_limite_periodos();
