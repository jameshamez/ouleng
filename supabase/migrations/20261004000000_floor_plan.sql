-- Floor plan: table positions, landmarks, and one booking per table per 2-hour window.

alter table tables
  add column x int not null default 0,
  add column y int not null default 0,
  add column w int not null default 2 check (w between 1 and 24),
  add column h int not null default 2 check (h between 1 and 18),
  add column shape text not null default 'square' check (shape in ('round','square')),
  add column active boolean not null default true;

-- Codes only need to be unique among tables still on the floor.
alter table tables drop constraint tables_code_key;
create unique index tables_active_code on tables (code) where active;

create table floor_decor (
  id text primary key,
  kind text not null check (kind in ('area','canal','stage','screen','counter','kitchen','entrance')),
  label text not null default '',
  x int not null,
  y int not null,
  w int not null check (w between 1 and 24),
  h int not null check (h between 1 and 18)
);
alter table floor_decor enable row level security;

-- Two live bookings may not hold the same table in overlapping 2-hour windows.
create extension if not exists btree_gist;
create function booking_window(d date, t text) returns tsrange
  language sql immutable as $$ select tsrange(d + t::time, d + t::time + interval '2 hours') $$;
alter table bookings add constraint bookings_no_overlap
  exclude using gist (table_id with =, booking_window(date, time) with &&)
  where (status in ('pending', 'confirmed', 'seated'));
