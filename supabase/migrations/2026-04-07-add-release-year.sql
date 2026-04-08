alter table public.entries
add column if not exists release_year text not null default '';
