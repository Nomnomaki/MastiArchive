alter table public.entries
add column if not exists manga_meta text not null default '';

alter table public.entries
add column if not exists current_chapter integer not null default 0;
