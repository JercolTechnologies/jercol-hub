-- ======================================================================
-- 003_adjuntos_ideas.sql
-- ======================================================================
-- Archivos adjuntos en Ideas de proyecto: tabla idea_attachments,
-- políticas RLS y bucket privado idea-attachments.
-- ======================================================================

create table if not exists idea_attachments (
  id uuid primary key default gen_random_uuid(),
  idea_id uuid not null references project_ideas(id) on delete cascade,
  uploaded_by uuid references profiles(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  size_bytes bigint,
  content_type text,
  created_at timestamptz not null default now()
);
alter table idea_attachments enable row level security;

drop policy if exists "idea_attach_admin_all" on idea_attachments;
create policy "idea_attach_admin_all" on idea_attachments for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists "idea_attach_select_own_client" on idea_attachments;
create policy "idea_attach_select_own_client" on idea_attachments for select using (
  exists (select 1 from project_ideas i
          where i.id = idea_attachments.idea_id and i.client_id = public.my_client_id())
);

drop policy if exists "idea_attach_insert_own_client" on idea_attachments;
create policy "idea_attach_insert_own_client" on idea_attachments for insert with check (
  exists (select 1 from project_ideas i
          where i.id = idea_attachments.idea_id and i.client_id = public.my_client_id())
  and uploaded_by = auth.uid()
);

drop policy if exists "idea_attach_delete_own" on idea_attachments;
create policy "idea_attach_delete_own" on idea_attachments for delete using (uploaded_by = auth.uid());

-- Bucket privado propio para archivos de ideas
insert into storage.buckets (id, name, public)
values ('idea-attachments', 'idea-attachments', false)
on conflict (id) do nothing;

drop policy if exists "storage_idea_select" on storage.objects;
create policy "storage_idea_select" on storage.objects for select
  using (
    bucket_id = 'idea-attachments'
    and (
      public.is_admin()
      or exists (select 1 from project_ideas i
                 where i.id::text = (storage.foldername(name))[1] and i.client_id = public.my_client_id())
    )
  );

drop policy if exists "storage_idea_insert" on storage.objects;
create policy "storage_idea_insert" on storage.objects for insert
  with check (
    bucket_id = 'idea-attachments'
    and (
      public.is_admin()
      or exists (select 1 from project_ideas i
                 where i.id::text = (storage.foldername(name))[1] and i.client_id = public.my_client_id())
    )
  );

drop policy if exists "storage_idea_delete" on storage.objects;
create policy "storage_idea_delete" on storage.objects for delete
  using (bucket_id = 'idea-attachments' and (public.is_admin() or owner = auth.uid()));

alter publication supabase_realtime add table idea_attachments;
