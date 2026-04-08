alter table public.entries
drop constraint if exists entries_kind_check;

alter table public.entries
add constraint entries_kind_check
check (kind in ('Book', 'Movie', 'TV Show', 'Anime', 'Manga', 'Article'));
