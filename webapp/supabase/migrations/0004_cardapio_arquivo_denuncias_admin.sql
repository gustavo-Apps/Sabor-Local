-- Painel simples do vendedor (menu com disponibilidade + arquivo de cardápio),
-- denúncias e administração/moderação.

-- Menu: o vendedor marca o que está disponível hoje
alter table itens_cardapio add column disponivel boolean not null default true;

-- Cardápio em arquivo (PDF ou foto), guardado no Storage
alter table vendedores
  add column cardapio_url text,
  add column cardapio_tipo text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cardapios', 'cardapios', true, 5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "cardapios_read_public" on storage.objects
  for select using (bucket_id = 'cardapios');

-- Cada vendedor só mexe na própria pasta: <user_id>/arquivo
create policy "cardapios_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'cardapios' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cardapios_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'cardapios' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "cardapios_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cardapios' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Administradores (concedido manualmente via SQL; sem tela de cadastro)
-- ---------------------------------------------------------------------------

create table admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table admins enable row level security;

create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;
grant execute on function is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Denúncias
-- ---------------------------------------------------------------------------

create type motivo_denuncia as enum
  ('informacao_falsa', 'conteudo_improprio', 'golpe', 'avaliacao_falsa', 'outro');

create table denuncias (
  id uuid primary key default gen_random_uuid(),
  vendedor_id uuid not null references vendedores (id) on delete cascade,
  avaliacao_id uuid references avaliacoes (id) on delete cascade,
  motivo motivo_denuncia not null,
  descricao text check (char_length(descricao) <= 500),
  contato text check (char_length(contato) <= 100),
  status text not null default 'aberta' check (status in ('aberta', 'resolvida', 'descartada')),
  created_at timestamptz not null default now()
);

create index denuncias_status_idx on denuncias (status, created_at desc);

alter table denuncias enable row level security;

-- Qualquer pessoa pode denunciar (sem login); só administradores leem e tratam
create policy "denuncias_insert_public" on denuncias
  for insert with check (status = 'aberta');

create policy "denuncias_admin_all" on denuncias
  for all using (is_admin()) with check (is_admin());

-- Administrador enxerga e modera tudo
create policy "vendedores_admin_all" on vendedores
  for all using (is_admin()) with check (is_admin());

create policy "avaliacoes_admin_all" on avaliacoes
  for all using (is_admin()) with check (is_admin());
