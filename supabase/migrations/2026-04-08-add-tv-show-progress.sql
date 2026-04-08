alter table public.entries
add column if not exists show_meta text not null default '';

alter table public.entries
add column if not exists current_season integer not null default 0;

alter table public.entries
add column if not exists current_episode integer not null default 0;
