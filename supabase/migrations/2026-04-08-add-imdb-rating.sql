alter table public.entries
add column if not exists imdb_rating text not null default '';
