create table if not exists public.users (
  id text primary key,
  email text not null unique,
  password_hash text not null,
  salt text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.entries (
  id text primary key,
  user_id text not null references public.users(id) on delete cascade,
  title text not null,
  creator text not null default '',
  release_year text not null default '',
  imdb_rating text not null default '',
  show_meta text not null default '',
  current_season integer not null default 0,
  current_episode integer not null default 0,
  manga_meta text not null default '',
  current_chapter integer not null default 0,
  kind text not null check (kind in ('Book', 'Movie', 'TV Show', 'Anime', 'Manga', 'Article')),
  status text not null check (status in ('To start', 'In progress', 'Done')),
  favorite boolean not null default false,
  page_number integer not null default 0,
  url text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists entries_user_id_idx on public.entries(user_id);
create index if not exists entries_updated_at_idx on public.entries(updated_at desc);
